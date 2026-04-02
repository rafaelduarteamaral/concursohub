"""ConcursoHub AI Processor Worker — polls concursos with ai_status='pending'."""
import asyncio
import datetime
import logging
import os
import sys

import psycopg2
import redis as redis_lib
import sentry_sdk
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger('ai_processor')

SENTRY_DSN = os.getenv('SENTRY_DSN')
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=os.getenv('ENV', 'production'),
        traces_sample_rate=0.1,
    )

DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://concursohub:concursohub@localhost:5432/concursohub',
)
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
POLL_INTERVAL = int(os.getenv('AI_POLL_INTERVAL', '15'))
BATCH_SIZE = int(os.getenv('AI_BATCH_SIZE', '3'))

from pipeline import ConcursoProcessingPipeline


def get_db_connection():
    return psycopg2.connect(DATABASE_URL)


def get_redis_client():
    return redis_lib.from_url(REDIS_URL, decode_responses=True)


async def process_batch():
    conn = get_db_connection()
    redis_client = get_redis_client()
    try:
        # Atomically claim pending concursos
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE concursos
                SET ai_status = 'processing', updated_at = NOW()
                WHERE id IN (
                    SELECT id FROM concursos
                    WHERE ai_status = 'pending'
                      AND raw_title IS NOT NULL
                    ORDER BY created_at ASC
                    LIMIT %s
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING id, raw_title, original_url, raw_content
                """,
                (BATCH_SIZE,),
            )
            rows = cur.fetchall()
            conn.commit()

        if not rows:
            return

        logger.info(f"Claimed {len(rows)} concursos for AI processing")

        for concurso_id, raw_title, original_url, raw_content in rows:
            logger.info(f"Processing concurso {concurso_id}: {(raw_title or '')[:60]}")
            try:
                pipeline = ConcursoProcessingPipeline(
                    db_conn=conn,
                    redis_client=redis_client,
                )
                result = await pipeline.process(
                    concurso_id=concurso_id,
                    raw_title=raw_title or '',
                    original_url=original_url or '',
                    raw_content=raw_content or '',
                )
                if result.success:
                    logger.info(f"Concurso {concurso_id} processed: slug={result.slug}")
                else:
                    logger.warning(f"Concurso {concurso_id} failed: {result.error}")

            except Exception as e:
                logger.error(f"Unexpected error processing concurso {concurso_id}: {e}")
                if SENTRY_DSN:
                    sentry_sdk.capture_exception(e)
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE concursos SET ai_status = 'error', ai_error = %s, updated_at = NOW() WHERE id = %s",
                        (str(e)[:500], concurso_id),
                    )
                    conn.commit()
    finally:
        try:
            conn.close()
        except Exception:
            pass
        try:
            redis_client.close()
        except Exception:
            pass


async def main():
    logger.info("Starting ConcursoHub AI Processor Worker (DB polling mode)")
    logger.info(f"Polling every {POLL_INTERVAL}s for pending concursos")

    try:
        while True:
            try:
                await process_batch()
            except Exception as e:
                logger.error(f"Poll cycle error: {e}")
                if SENTRY_DSN:
                    sentry_sdk.capture_exception(e)
            await asyncio.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        logger.info("Shutting down AI Processor worker...")


if __name__ == '__main__':
    asyncio.run(main())
