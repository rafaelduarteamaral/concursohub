-- Migration 003: Main concursos table
CREATE TYPE esfera_type AS ENUM ('federal', 'estadual', 'municipal', 'distrital');
CREATE TYPE regiao_type AS ENUM ('Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul', 'Nacional');
CREATE TYPE status_concurso AS ENUM (
  'previsto',
  'inscricoes_abertas',
  'inscricoes_encerradas',
  'aguardando_prova',
  'em_andamento',
  'concluido',
  'suspenso',
  'cancelado'
);
CREATE TYPE ai_status_type AS ENUM ('pending', 'processing', 'done', 'error');

CREATE TABLE IF NOT EXISTS concursos (
  -- Identity
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  original_url TEXT NOT NULL UNIQUE,
  slug TEXT UNIQUE,

  -- Content
  titulo TEXT NOT NULL,
  orgao TEXT,
  banca_organizadora TEXT,
  esfera esfera_type,
  estado CHAR(2),                   -- two-letter BR state code, e.g. 'SP'
  cidade TEXT,
  regiao regiao_type,
  area TEXT,                        -- e.g. 'Tecnologia da Informação', 'Fiscal', 'Saúde'

  -- Cargos (structured job positions)
  cargos JSONB DEFAULT '[]',        -- [{nome, nivel, vagas, salario_base}]
  nivel_escolaridade TEXT[],        -- e.g. {'fundamental', 'médio', 'superior'}
  salario_min NUMERIC(12, 2),
  salario_max NUMERIC(12, 2),
  remuneracao_texto TEXT,           -- free-text salary description from source

  -- Vagas
  vagas_total INTEGER,
  vagas_pcd INTEGER,

  -- Timeline
  inscricoes_inicio DATE,
  inscricoes_fim DATE,
  data_prova DATE,

  -- Status
  status status_concurso NOT NULL DEFAULT 'previsto',

  -- AI-generated fields
  resumo TEXT,                      -- AI summary in PT-BR
  palavras_chave TEXT[],

  -- Links
  edital_url TEXT,

  -- AI processing
  ai_status ai_status_type NOT NULL DEFAULT 'pending',
  ai_error TEXT,

  -- Raw content from scraper (used by AI processor)
  raw_title TEXT,
  raw_content TEXT,

  -- Metrics
  relevance_score INTEGER DEFAULT 0 CHECK (relevance_score >= 0 AND relevance_score <= 100),
  view_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_concursos_status ON concursos(status);
CREATE INDEX IF NOT EXISTS idx_concursos_esfera ON concursos(esfera);
CREATE INDEX IF NOT EXISTS idx_concursos_estado ON concursos(estado);
CREATE INDEX IF NOT EXISTS idx_concursos_regiao ON concursos(regiao);
CREATE INDEX IF NOT EXISTS idx_concursos_area ON concursos(area);
CREATE INDEX IF NOT EXISTS idx_concursos_banca ON concursos(banca_organizadora);
CREATE INDEX IF NOT EXISTS idx_concursos_inscricoes_fim ON concursos(inscricoes_fim);
CREATE INDEX IF NOT EXISTS idx_concursos_data_prova ON concursos(data_prova);
CREATE INDEX IF NOT EXISTS idx_concursos_salario_min ON concursos(salario_min);
CREATE INDEX IF NOT EXISTS idx_concursos_salario_max ON concursos(salario_max);
CREATE INDEX IF NOT EXISTS idx_concursos_ai_status ON concursos(ai_status);
CREATE INDEX IF NOT EXISTS idx_concursos_created_at ON concursos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_concursos_relevance ON concursos(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_concursos_vagas_total ON concursos(vagas_total);
CREATE INDEX IF NOT EXISTS idx_concursos_source_id ON concursos(source_id);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_concursos_titulo_trgm ON concursos USING gin (titulo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_concursos_orgao_trgm ON concursos USING gin (orgao gin_trgm_ops);

-- Composite indexes for common filter+sort queries
CREATE INDEX IF NOT EXISTS idx_concursos_status_inscricoes_fim ON concursos(status, inscricoes_fim);
CREATE INDEX IF NOT EXISTS idx_concursos_estado_status ON concursos(estado, status);
CREATE INDEX IF NOT EXISTS idx_concursos_area_status ON concursos(area, status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER concursos_updated_at
  BEFORE UPDATE ON concursos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
