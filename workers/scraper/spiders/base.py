"""Base spider and ConcursoData dataclass for ConcursoHub scraper."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional
import abc


@dataclass
class ConcursoData:
    """Represents a scraped concurso, ready to be saved to the DB."""
    source_id: str
    original_url: str
    raw_title: str
    raw_content: Optional[str] = None

    # Fields that may be extracted directly from the feed/page
    orgao: Optional[str] = None
    inscricoes_fim: Optional[date] = None
    edital_url: Optional[str] = None
    published_at: Optional[datetime] = None

    def is_valid(self) -> bool:
        """Minimum validity check before saving."""
        return bool(self.original_url and self.raw_title and len(self.raw_title.strip()) > 5)

    def has_content(self) -> bool:
        return bool(self.raw_content and len(self.raw_content.strip()) > 100)


class BaseSpider(abc.ABC):
    """Base class for all ConcursoHub spiders."""

    def __init__(self, source_id: str, source_url: str, config: dict):
        self.source_id = source_id
        self.source_url = source_url
        self.config = config

    @abc.abstractmethod
    async def fetch_concursos(self) -> list[ConcursoData]:
        """Fetch and return a list of ConcursoData items."""
        ...
