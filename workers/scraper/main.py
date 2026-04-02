"""ConcursoHub Scraper Worker — polls sources table, scrapes concurso feeds."""
import asyncio
import logging
import os
import sys
import uuid
from typing import Optional

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
logger = logging.getLogger('scraper')

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
DEFAULT_CRAWL_INTERVAL_MINUTES = int(os.getenv('DEFAULT_CRAWL_INTERVAL_MINUTES', '60'))
POLL_INTERVAL = int(os.getenv('SCRAPER_POLL_INTERVAL', '60'))

from spiders import RssSpider
from spiders.base import ConcursoData

SPIDER_MAP = {
    'rss': RssSpider,
}


def get_db_connection():
    return psycopg2.connect(DATABASE_URL)


def get_redis_client():
    return redis_lib.from_url(REDIS_URL, decode_responses=True)


def is_duplicate_url(redis_client, url: str) -> bool:
    """Check if URL has been seen recently (Redis bloom-filter-like set)."""
    key = f'concursohub:seen:{url}'
    return redis_client.exists(key) > 0


def mark_url_as_seen(redis_client, url: str) -> None:
    key = f'concursohub:seen:{url}'
    redis_client.setex(key, 86400 * 30, '1')  # 30 days TTL


def is_duplicate_in_db(conn, url: str) -> bool:
    with conn.cursor() as cur:
        cur.execute('SELECT 1 FROM concursos WHERE original_url = %s LIMIT 1', (url,))
        return cur.fetchone() is not None


def save_concurso_to_db(conn, concurso: ConcursoData) -> Optional[str]:
    """Save scraped concurso. ai_status='pending' triggers AI processor."""
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO concursos (
                    id, source_id, original_url, titulo, raw_content,
                    orgao, inscricoes_fim, edital_url, ai_status, status
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, 'pending', 'previsto'
                )
                ON CONFLICT (original_url) DO NOTHING
                RETURNING id
                """,
                (
                    str(uuid.uuid4()),
                    concurso.source_id,
                    concurso.original_url,
                    concurso.raw_title[:500] if concurso.raw_title else None,
                    concurso.raw_content,
                    concurso.orgao,
                    concurso.inscricoes_fim,
                    concurso.edital_url,
                ),
            )
            result = cur.fetchone()
            conn.commit()
            return result[0] if result else None
    except Exception as e:
        conn.rollback()
        logger.error(f"Error saving concurso {concurso.original_url}: {e}")
        return None


def update_source_last_crawled(conn, source_id: str) -> None:
    try:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE sources SET last_crawled_at = NOW(), error_count = 0 WHERE id = %s',
                (source_id,),
            )
            conn.commit()
    except Exception as e:
        conn.rollback()
        logger.warning(f"Error updating source last_crawled_at: {e}")


def increment_source_error(conn, source_id: str) -> None:
    try:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE sources SET error_count = error_count + 1 WHERE id = %s',
                (source_id,),
            )
            conn.commit()
    except Exception as e:
        conn.rollback()
        logger.warning(f"Error incrementing source error count: {e}")


def get_sources_due_for_crawl(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, type, url, name, config,
                   COALESCE(crawl_interval_minutes, %s) AS interval_minutes
            FROM sources
            WHERE is_active = true
              AND (
                last_crawled_at IS NULL
                OR last_crawled_at < NOW() - (COALESCE(crawl_interval_minutes, %s) * INTERVAL '1 minute')
              )
            ORDER BY last_crawled_at ASC NULLS FIRST
            LIMIT 10
            """,
            (DEFAULT_CRAWL_INTERVAL_MINUTES, DEFAULT_CRAWL_INTERVAL_MINUTES),
        )
        return cur.fetchall()


async def crawl_source(conn, redis_client, source_id, source_type, source_url, source_name, config):
    spider_class = SPIDER_MAP.get(source_type)
    if not spider_class:
        logger.error(f"Unknown source type: {source_type}")
        return

    spider = spider_class(source_id=source_id, source_url=source_url, config=config or {})

    try:
        items = await spider.fetch_concursos()
        logger.info(f"Fetched {len(items)} items from {source_name}")

        new_count = 0
        dup_count = 0

        for concurso in items:
            if not concurso.is_valid():
                continue

            if is_duplicate_url(redis_client, concurso.original_url):
                dup_count += 1
                continue

            if is_duplicate_in_db(conn, concurso.original_url):
                mark_url_as_seen(redis_client, concurso.original_url)
                dup_count += 1
                continue

            concurso_id = save_concurso_to_db(conn, concurso)
            if concurso_id:
                new_count += 1
                mark_url_as_seen(redis_client, concurso.original_url)
                logger.debug(f"Saved concurso for AI processing: {concurso.raw_title[:60]}")

        update_source_last_crawled(conn, source_id)
        logger.info(
            f"Source {source_name}: {new_count} new, {dup_count} duplicates "
            f"out of {len(items)} total"
        )

    except Exception as e:
        increment_source_error(conn, source_id)
        logger.error(f"Error crawling source {source_name}: {e}")
        if SENTRY_DSN:
            sentry_sdk.capture_exception(e)


async def poll_and_crawl():
    conn = get_db_connection()
    redis_client = get_redis_client()
    try:
        sources = get_sources_due_for_crawl(conn)
        if not sources:
            return

        logger.info(f"Found {len(sources)} sources due for crawl")
        for row in sources:
            source_id, source_type, source_url, source_name, config, _ = row
            await crawl_source(
                conn, redis_client, source_id, source_type,
                source_url, source_name, config,
            )
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
    logger.info("Starting ConcursoHub Scraper Worker (DB polling mode)")
    logger.info(f"Polling every {POLL_INTERVAL}s for sources due for crawl")

    try:
        while True:
            try:
                await poll_and_crawl()
            except Exception as e:
                logger.error(f"Poll cycle error: {e}")
                if SENTRY_DSN:
                    sentry_sdk.capture_exception(e)
            await asyncio.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        logger.info("Shutting down Scraper worker...")


if __name__ == '__main__':
    asyncio.run(main())
