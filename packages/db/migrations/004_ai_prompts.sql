-- Migration 004: AI prompts and processing logs
CREATE TABLE IF NOT EXISTS ai_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_processing_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concurso_id UUID REFERENCES concursos(id) ON DELETE CASCADE,
  prompt_key TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd NUMERIC(10,6),
  duration_ms INTEGER,
  success BOOLEAN,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_concurso_id ON ai_processing_logs(concurso_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON ai_processing_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_success ON ai_processing_logs(success);

-- Seed default prompt for concurso processing
INSERT INTO ai_prompts (key, system_prompt, user_prompt_template, description) VALUES (
  'concurso_processor',
  'Você é um especialista em concursos públicos brasileiros com amplo conhecimento sobre editais, bancas organizadoras, carreiras do serviço público e legislação pertinente.

Sua missão é analisar textos brutos de anúncios e editais de concursos públicos e extrair informações estruturadas e precisas para o portal ConcursoHub.

Regras importantes:
- Extraia APENAS informações que estejam explicitamente presentes no texto fonte
- Para campos não encontrados, retorne null (não invente dados)
- Datas devem estar no formato ISO 8601 (YYYY-MM-DD)
- Salários devem ser números decimais (ex: 5000.00)
- Mantenha siglas e nomes de órgãos exatamente como aparecem
- O resumo deve ser objetivo, informativo e em português brasileiro
- O slug deve ser URL-friendly, sem acentos ou caracteres especiais',
  'Analise o texto abaixo de um anúncio/edital de concurso público e retorne um JSON com os seguintes campos:

- titulo: título oficial do concurso (string, max 300 chars)
- orgao: nome do órgão/entidade que abriu o concurso (string)
- banca_organizadora: banca que organiza o concurso (string, ex: "CESPE/CEBRASPE", "FCC", "VUNESP")
- esfera: âmbito do concurso — "federal", "estadual", "municipal" ou "distrital" (string)
- estado: sigla do estado em 2 letras, ex: "SP", "RJ". Se federal, use null (string|null)
- cidade: cidade do órgão se municipal (string|null)
- regiao: região do Brasil — "Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul" ou "Nacional" (string|null)
- area: área de atuação principal, ex: "Tecnologia da Informação", "Fiscal e Tributária", "Saúde", "Educação", "Segurança Pública", "Jurídica", "Administrativa", "Engenharia", "Controle e Auditoria" (string|null)
- cargos: array de cargos disponíveis, cada um com: nome (string), nivel (string: "fundamental"|"médio"|"técnico"|"superior"), vagas (integer|null), salario_base (number|null) (array)
- nivel_escolaridade: array de níveis de escolaridade exigidos, ex: ["médio", "superior"] (array)
- salario_min: menor salário base entre os cargos em R$ (number|null)
- salario_max: maior salário base entre os cargos em R$ (number|null)
- remuneracao_texto: descrição textual da remuneração como aparece no edital (string|null)
- vagas_total: total de vagas (integer|null)
- vagas_pcd: vagas reservadas para PCD (integer|null)
- inscricoes_inicio: data de início das inscrições no formato YYYY-MM-DD (string|null)
- inscricoes_fim: data de encerramento das inscrições no formato YYYY-MM-DD (string|null)
- data_prova: data da prova objetiva no formato YYYY-MM-DD (string|null)
- status: status atual — "previsto"|"inscricoes_abertas"|"inscricoes_encerradas"|"aguardando_prova"|"em_andamento"|"concluido"|"suspenso"|"cancelado" (string)
- resumo: resumo em português em 2-3 parágrafos descrevendo o concurso, cargos, requisitos e oportunidades (string)
- palavras_chave: array de 5-10 palavras-chave relevantes para busca (array)
- edital_url: URL do edital oficial se disponível (string|null)
- slug: slug URL-friendly sem acentos (ex: "concurso-receita-federal-2025-auditor-fiscal") (string)
- relevance_score: 0-100, score de relevância e interesse para candidatos brasileiros (integer)

Texto do concurso:
Título: {raw_title}
URL: {original_url}
Conteúdo: {raw_content}

Responda APENAS com JSON válido, sem markdown code blocks.',
  'Prompt principal para extrair dados estruturados de editais e anúncios de concursos públicos'
) ON CONFLICT (key) DO NOTHING;
