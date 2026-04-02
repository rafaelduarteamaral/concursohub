"""RSS/Atom feed spider for ConcursoHub.

Parses RSS feeds from concurso portals and extracts:
- titulo (from feed entry title)
- orgao (from entry tags or title heuristics)
- inscricoes_fim (from feed entry date fields or content)
- edital_url (detected from links in content)
- raw_content (full text of entry for AI processing)
"""
from __future__ import annotations

import logging
import re
import time
from datetime import datetime, date
from email.utils import parsedate_to_datetime
from typing import Optional

import feedparser
import httpx
import trafilatura

from .base import ConcursoData, BaseSpider

logger = logging.getLogger(__name__)

# Patterns to detect edital/notice links
EDITAL_URL_PATTERNS = [
    r'edital', r'aviso', r'notice', r'publicacao', r'dou\.gov\.br',
    r'diariooficial', r'imprensaoficial',
]
_EDITAL_RE = re.compile('|'.join(EDITAL_URL_PATTERNS), re.IGNORECASE)

# Patterns to extract inscricoes_fim from content
_INSCRICOES_FIM_RE = re.compile(
    r'inscri[çc][oõ]es?.*?(?:at[eé]|prazo|encerr[ao].*?dia)\D*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})',
    re.IGNORECASE | re.DOTALL,
)


def _parse_date_from_struct(struct) -> Optional[datetime]:
    if struct:
        try:
            return datetime.fromtimestamp(time.mktime(struct))
        except Exception:
            pass
    return None


def _extract_edital_url(entry: feedparser.FeedParserDict) -> Optional[str]:
    """Try to find a link to the official edital/notice."""
    links = entry.get('links', [])
    for link in links:
        href = link.get('href', '')
        if _EDITAL_RE.search(href):
            return href

    # Check enclosures
    for enc in entry.get('enclosures', []):
        href = enc.get('href', '') or enc.get('url', '')
        if href and _EDITAL_RE.search(href):
            return href

    # Check content for links
    content = ''
    for cf in ['content', 'summary']:
        fd = entry.get(cf)
        if fd:
            if isinstance(fd, list) and fd:
                content = fd[0].get('value', '')
            elif isinstance(fd, str):
                content = fd
            if content:
                break

    if content:
        urls = re.findall(r'href=["\']([^"\']+)["\']', content)
        for url in urls:
            if _EDITAL_RE.search(url):
                return url

    return None


def _extract_inscricoes_fim(content: str) -> Optional[date]:
    """Try to extract the inscricoes_fim date from raw content."""
    if not content:
        return None
    match = _INSCRICOES_FIM_RE.search(content)
    if match:
        day, month, year = match.group(1), match.group(2), match.group(3)
        if len(year) == 2:
            year = '20' + year
        try:
            return date(int(year), int(month), int(day))
        except ValueError:
            pass
    return None


class RssSpider(BaseSpider):
    """Spider for RSS/Atom feeds from concurso portals."""

    async def fetch_concursos(self) -> list[ConcursoData]:
        concursos = []

        try:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                response = await client.get(
                    self.source_url,
                    headers={
                        'User-Agent': 'Mozilla/5.0 (compatible; ConcursoHubBot/1.0)',
                        'Accept': 'application/rss+xml, application/atom+xml, text/xml, */*',
                    },
                )
                response.raise_for_status()
                feed_content = response.text

            feed = feedparser.parse(feed_content)
            if feed.bozo and not feed.entries:
                logger.warning(f"Feed parse error for {self.source_url}: {feed.bozo_exception}")
                return []

            logger.info(f"Found {len(feed.entries)} entries in {self.source_url}")
            max_items = self.config.get('max_articles', 30)

            for entry in feed.entries[:max_items]:
                concurso = await self._parse_entry(entry)
                if concurso and concurso.is_valid():
                    concursos.append(concurso)

        except (httpx.HTTPError, Exception) as e:
            logger.error(f"Error fetching RSS feed {self.source_url}: {e}")

        return concursos

    async def _parse_entry(self, entry: feedparser.FeedParserDict) -> Optional[ConcursoData]:
        url = entry.get('link', '').strip()
        title = entry.get('title', '').strip()
        if not url or not title:
            return None

        # Published date
        published_at = None
        for date_field in ['published', 'updated', 'created']:
            date_str = entry.get(date_field, '')
            if date_str:
                try:
                    published_at = parsedate_to_datetime(date_str)
                    break
                except Exception:
                    dt = _parse_date_from_struct(entry.get(f'{date_field}_parsed'))
                    if dt:
                        published_at = dt
                        break

        # Raw content from feed
        raw_content = None
        for cf in ['content', 'summary']:
            fd = entry.get(cf)
            if fd:
                if isinstance(fd, list) and fd:
                    raw_content = fd[0].get('value', '')
                elif isinstance(fd, str):
                    raw_content = fd
                if raw_content and len(raw_content) > 100:
                    break

        # Fetch full content from URL if feed content is sparse
        if not raw_content or len(raw_content) < 300:
            try:
                async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                    resp = await client.get(
                        url,
                        headers={'User-Agent': 'Mozilla/5.0 (compatible; ConcursoHubBot/1.0)'},
                    )
                    if resp.status_code == 200:
                        fetched = trafilatura.extract(resp.text, include_links=True)
                        if fetched and len(fetched) > len(raw_content or ''):
                            raw_content = fetched
            except Exception as e:
                logger.debug(f"Could not fetch full content for {url}: {e}")

        # Truncate to 8000 chars for AI
        if raw_content and len(raw_content) > 8000:
            raw_content = raw_content[:8000]

        # Edital URL
        edital_url = _extract_edital_url(entry)

        # Inscricoes fim from content
        inscricoes_fim = _extract_inscricoes_fim(raw_content or '')

        # Orgao heuristic: from feed author or first tag
        orgao = None
        authors = entry.get('authors', [])
        if authors:
            orgao = authors[0].get('name', '').strip() or None
        if not orgao:
            tags = entry.get('tags', [])
            if tags:
                orgao = tags[0].get('term', '').strip() or None

        return ConcursoData(
            source_id=self.source_id,
            original_url=url,
            raw_title=title,
            raw_content=raw_content,
            orgao=orgao,
            inscricoes_fim=inscricoes_fim,
            edital_url=edital_url,
            published_at=published_at,
        )
