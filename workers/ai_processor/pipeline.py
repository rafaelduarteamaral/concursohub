"""AI processing pipeline for ConcursoHub concursos."""
from __future__ import annotations

import json
import logging
import os
import re
import time
import unicodedata
from dataclasses import dataclass
from typing import Optional

import httpx
import psycopg2
import redis

logger = logging.getLogger(__name__)

NEXT_PUBLIC_APP_URL = os.getenv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
REVALIDATE_SECRET = os.getenv('REVALIDATE_SECRET', 'change-me')
AI_PROVIDER = os.getenv('AI_PROVIDER', 'ollama')
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'gemma3:4b')
MAX_DAILY_AI_COST = float(os.getenv('MAX_DAILY_AI_COST_USD', '5.0'))

AUTO_PUBLISH_MIN_SCORE = 25


# ---------------------------------------------------------------------------
# JSON helpers
# ---------------------------------------------------------------------------

def _strip_fences(text: str) -> str:
    text = re.sub(r'```(?:json|JSON)?\s*\n?', '', text)
    text = re.sub(r'\n?```', '', text)
    return text.strip()


def _fix_trailing_commas(text: str) -> str:
    return re.sub(r',\s*([}\]])', r'\1', text)


def parse_ai_response(text: str) -> Optional[dict]:
    text = text.strip()
    cleaned = _fix_trailing_commas(_strip_fences(text))
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    brace_match = re.search(r'\{[\s\S]*\}', text)
    if brace_match:
        try:
            return json.loads(_fix_trailing_commas(brace_match.group()))
        except json.JSONDecodeError:
            pass

    for block in re.findall(r'```(?:json|JSON)?\s*([\s\S]*?)```', text):
        try:
            return json.loads(_fix_trailing_commas(block.strip()))
        except json.JSONDecodeError:
            pass

    first_b = text.find('{')
    last_b = text.rfind('}')
    if first_b != -1 and last_b > first_b:
        try:
            return json.loads(_fix_trailing_commas(text[first_b:last_b + 1]))
        except json.JSONDecodeError:
            pass

    logger.warning("Could not parse AI response as JSON. Raw (first 300 chars): %s", text[:300])
    return None


# ---------------------------------------------------------------------------
# Slug helpers
# ---------------------------------------------------------------------------

def _generate_slug(text: str) -> str:
    slug = unicodedata.normalize('NFD', text.lower())
    slug = ''.join(c for c in slug if unicodedata.category(c) != 'Mn')
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')
    return slug[:150]


def ensure_unique_slug(conn, slug: str, concurso_id: str) -> str:
    base = slug
    counter = 1
    while True:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT id FROM concursos WHERE slug = %s AND id != %s LIMIT 1',
                (slug, concurso_id),
            )
            if not cur.fetchone():
                return slug
        slug = f"{base}-{counter}"
        counter += 1
        if counter > 100:
            import uuid as _uuid
            return f"{base}-{str(_uuid.uuid4())[:8]}"


# ---------------------------------------------------------------------------
# AI client
# ---------------------------------------------------------------------------

class CostLimitExceededError(Exception):
    pass


@dataclass
class AIResponse:
    content: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    duration_ms: int


def _call_anthropic(system_prompt: str, user_prompt: str) -> AIResponse:
    import anthropic
    t0 = time.time()
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    msg = client.messages.create(
        model='claude-3-haiku-20240307',
        max_tokens=2048,
        system=system_prompt,
        messages=[{'role': 'user', 'content': user_prompt}],
    )
    duration_ms = int((time.time() - t0) * 1000)
    input_tokens = msg.usage.input_tokens
    output_tokens = msg.usage.output_tokens
    # haiku pricing: $0.25/MTok in, $1.25/MTok out
    cost = (input_tokens / 1_000_000) * 0.25 + (output_tokens / 1_000_000) * 1.25
    return AIResponse(
        content=msg.content[0].text,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost,
        duration_ms=duration_ms,
    )


def _call_ollama(system_prompt: str, user_prompt: str) -> AIResponse:
    t0 = time.time()
    import httpx as _httpx
    payload = {
        'model': OLLAMA_MODEL,
        'stream': False,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt},
        ],
    }
    resp = _httpx.post(f'{OLLAMA_BASE_URL}/api/chat', json=payload, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    content = data.get('message', {}).get('content', '')
    duration_ms = int((time.time() - t0) * 1000)
    return AIResponse(
        content=content,
        input_tokens=data.get('prompt_eval_count', 0),
        output_tokens=data.get('eval_count', 0),
        cost_usd=0.0,
        duration_ms=duration_ms,
    )


def call_ai(system_prompt: str, user_prompt: str) -> AIResponse:
    if AI_PROVIDER == 'anthropic' and ANTHROPIC_API_KEY:
        return _call_anthropic(system_prompt, user_prompt)
    return _call_ollama(system_prompt, user_prompt)


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_prompt_from_db(conn, redis_client, prompt_key: str) -> Optional[dict]:
    """Load prompt from DB, cached in Redis for 5 minutes."""
    cache_key = f'concursohub:prompt:{prompt_key}'
    if redis_client:
        cached = redis_client.get(cache_key)
        if cached:
            try:
                return json.loads(cached)
            except Exception:
                pass

    with conn.cursor() as cur:
        cur.execute(
            'SELECT system_prompt, user_prompt_template FROM ai_prompts WHERE key = %s AND is_active = true',
            (prompt_key,),
        )
        row = cur.fetchone()
        if not row:
            return None
        result = {'system_prompt': row[0], 'user_prompt_template': row[1]}

    if redis_client:
        redis_client.setex(cache_key, 300, json.dumps(result))
    return result


def _update_concurso_status(conn, concurso_id: str, ai_status: str, error: Optional[str] = None):
    try:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE concursos SET ai_status = %s, ai_error = %s, updated_at = NOW() WHERE id = %s',
                (ai_status, error, concurso_id),
            )
            conn.commit()
    except Exception as e:
        conn.rollback()
        logger.warning("Error updating ai_status for %s: %s", concurso_id, e)


def save_processing_log(conn, concurso_id, prompt_key, ai_response, success, error=None):
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ai_processing_logs
                    (concurso_id, prompt_key, input_tokens, output_tokens,
                     cost_usd, duration_ms, success, error)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    concurso_id, prompt_key,
                    ai_response.input_tokens if ai_response else None,
                    ai_response.output_tokens if ai_response else None,
                    ai_response.cost_usd if ai_response else None,
                    ai_response.duration_ms if ai_response else None,
                    success, error,
                ),
            )
            conn.commit()
    except Exception as e:
        conn.rollback()
        logger.warning("Error saving processing log: %s", e)


def update_concurso(conn, concurso_id: str, data: dict, status: str, error: Optional[str] = None):
    """Write AI-extracted fields to the concursos table."""
    VALID_STATUSES = (
        'previsto', 'inscricoes_abertas', 'inscricoes_encerradas',
        'aguardando_prova', 'em_andamento', 'concluido', 'suspenso', 'cancelado',
    )
    concurso_status = data.get('status', 'previsto')
    if concurso_status not in VALID_STATUSES:
        concurso_status = 'previsto'

    VALID_ESFERAS = ('federal', 'estadual', 'municipal', 'distrital')
    esfera = data.get('esfera')
    if esfera not in VALID_ESFERAS:
        esfera = None

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE concursos SET
                    titulo       = COALESCE(%s, raw_title),
                    orgao        = COALESCE(orgao, %s),
                    banca_organizadora = %s,
                    esfera       = %s,
                    estado       = %s,
                    cidade       = %s,
                    regiao       = %s,
                    area         = %s,
                    cargos       = %s::jsonb,
                    nivel_escolaridade = %s,
                    salario_min  = %s,
                    salario_max  = %s,
                    remuneracao_texto = %s,
                    vagas_total  = %s,
                    vagas_pcd    = %s,
                    inscricoes_inicio = %s,
                    inscricoes_fim    = COALESCE(inscricoes_fim, %s),
                    data_prova   = %s,
                    status       = %s,
                    resumo       = %s,
                    palavras_chave = %s,
                    edital_url   = COALESCE(edital_url, %s),
                    slug         = %s,
                    relevance_score = %s,
                    ai_status    = %s,
                    ai_error     = %s,
                    updated_at   = NOW()
                WHERE id = %s
                """,
                (
                    data.get('titulo'), data.get('orgao'),
                    data.get('banca_organizadora'), esfera,
                    data.get('estado'), data.get('cidade'), data.get('regiao'),
                    data.get('area'),
                    json.dumps(data.get('cargos', [])),
                    data.get('nivel_escolaridade', []),
                    data.get('salario_min'), data.get('salario_max'),
                    data.get('remuneracao_texto'),
                    data.get('vagas_total'), data.get('vagas_pcd'),
                    data.get('inscricoes_inicio'), data.get('inscricoes_fim'),
                    data.get('data_prova'),
                    concurso_status, data.get('resumo'),
                    data.get('palavras_chave', []),
                    data.get('edital_url'),
                    data.get('slug'),
                    max(0, min(100, int(data.get('relevance_score', 0)))),
                    'done', error,
                    concurso_id,
                ),
            )
            conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error("Error updating concurso %s: %s", concurso_id, e)
        raise


async def revalidate_isr(slug: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f'{NEXT_PUBLIC_APP_URL}/api/revalidate',
                json={'secret': REVALIDATE_SECRET, 'path': f'/concurso/{slug}'},
            )
            await client.post(
                f'{NEXT_PUBLIC_APP_URL}/api/revalidate',
                json={'secret': REVALIDATE_SECRET, 'path': '/'},
            )
    except Exception as e:
        logger.warning("ISR revalidation error: %s", e)


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

@dataclass
class ProcessingResult:
    concurso_id: str
    success: bool
    status: str
    error: Optional[str] = None
    slug: Optional[str] = None


class ConcursoProcessingPipeline:
    """Orchestrates AI extraction for a single concurso."""

    PROMPT_KEY = 'concurso_processor'

    def __init__(self, db_conn, redis_client):
        self.conn = db_conn
        self.redis = redis_client

    async def process(
        self,
        concurso_id: str,
        raw_title: str,
        original_url: str,
        raw_content: str,
    ) -> ProcessingResult:
        ai_response = None
        _update_concurso_status(self.conn, concurso_id, 'processing')

        try:
            # Load prompt
            prompt = get_prompt_from_db(self.conn, self.redis, self.PROMPT_KEY)
            if not prompt:
                # Fallback to defaults
                from prompts.defaults import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE
                prompt = {
                    'system_prompt': SYSTEM_PROMPT,
                    'user_prompt_template': USER_PROMPT_TEMPLATE,
                }

            user_prompt = (
                prompt['user_prompt_template']
                .replace('{raw_title}', raw_title)
                .replace('{original_url}', original_url)
                .replace('{raw_content}', raw_content[:7000])
            )

            ai_response = call_ai(prompt['system_prompt'], user_prompt)

            data = parse_ai_response(ai_response.content)
            if not data:
                raise ValueError("Could not parse AI response as JSON")

            # Ensure slug
            if not data.get('slug'):
                data['slug'] = _generate_slug(
                    data.get('titulo') or raw_title
                )
            else:
                data['slug'] = _generate_slug(str(data['slug']))

            data['slug'] = ensure_unique_slug(self.conn, data['slug'], concurso_id)

            # Normalise titulo
            if data.get('titulo'):
                data['titulo'] = str(data['titulo'])[:300].strip()

            # Save to DB
            update_concurso(self.conn, concurso_id, data, data.get('status', 'previsto'))
            save_processing_log(self.conn, concurso_id, self.PROMPT_KEY, ai_response, True)

            slug = data['slug']
            logger.info(
                "Concurso %s processed: status=%s score=%s slug=%s",
                concurso_id, data.get('status'), data.get('relevance_score'), slug,
            )

            # ISR revalidation (best-effort, non-blocking)
            try:
                await revalidate_isr(slug)
            except Exception:
                pass

            return ProcessingResult(
                concurso_id=concurso_id, success=True, status='done', slug=slug,
            )

        except Exception as e:
            error_msg = str(e)[:500]
            logger.error("Error processing concurso %s: %s", concurso_id, e)
            save_processing_log(
                self.conn, concurso_id, self.PROMPT_KEY, ai_response, False, error_msg,
            )
            _update_concurso_status(self.conn, concurso_id, 'error', error_msg)
            return ProcessingResult(
                concurso_id=concurso_id, success=False, status='error', error=error_msg,
            )
