-- Migration 002: Sources table
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('rss', 'playwright')),
  cron_expression TEXT NOT NULL DEFAULT '0 * * * *',
  is_active BOOLEAN DEFAULT true,
  last_crawled_at TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,
  crawl_interval_minutes INTEGER DEFAULT 60,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sources_is_active ON sources(is_active);
CREATE INDEX IF NOT EXISTS idx_sources_last_crawled_at ON sources(last_crawled_at);

-- Seed initial concurso sources (RSS feeds from major concurso portals)
INSERT INTO sources (name, url, type, cron_expression, crawl_interval_minutes, config) VALUES
  ('Estratégia Concursos', 'https://www.estrategiaconcursos.com.br/feed/', 'rss', '0 * * * *', 60, '{"max_articles": 30}'),
  ('Gran Cursos Online', 'https://www.grancursosonline.com.br/feed/', 'rss', '0 * * * *', 60, '{"max_articles": 30}'),
  ('QConcursos Blog', 'https://www.qconcursos.com/feed/', 'rss', '0 */2 * * *', 120, '{"max_articles": 20}'),
  ('Concursos no Brasil', 'https://www.concursosnobrasil.com.br/feed/', 'rss', '*/30 * * * *', 30, '{"max_articles": 40}'),
  ('PCIConcursos', 'https://www.pciconcursos.com.br/rss/', 'rss', '*/30 * * * *', 30, '{"max_articles": 40}')
ON CONFLICT (url) DO NOTHING;
