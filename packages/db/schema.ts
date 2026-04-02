// ConcursoHub — TypeScript interfaces for database types

export type Esfera = 'federal' | 'estadual' | 'municipal' | 'distrital';
export type Regiao = 'Norte' | 'Nordeste' | 'Centro-Oeste' | 'Sudeste' | 'Sul' | 'Nacional';
export type StatusConcurso =
  | 'previsto'
  | 'inscricoes_abertas'
  | 'inscricoes_encerradas'
  | 'aguardando_prova'
  | 'em_andamento'
  | 'concluido'
  | 'suspenso'
  | 'cancelado';
export type AiStatus = 'pending' | 'processing' | 'done' | 'error';

export interface Cargo {
  nome: string;
  nivel: 'fundamental' | 'médio' | 'técnico' | 'superior';
  vagas: number | null;
  salario_base: number | null;
}

export interface Concurso {
  id: string;
  source_id: string | null;
  original_url: string;
  slug: string | null;
  titulo: string;
  orgao: string | null;
  banca_organizadora: string | null;
  esfera: Esfera | null;
  estado: string | null;
  cidade: string | null;
  regiao: Regiao | null;
  area: string | null;
  cargos: Cargo[];
  nivel_escolaridade: string[];
  salario_min: number | null;
  salario_max: number | null;
  remuneracao_texto: string | null;
  vagas_total: number | null;
  vagas_pcd: number | null;
  inscricoes_inicio: string | null;
  inscricoes_fim: string | null;
  data_prova: string | null;
  status: StatusConcurso;
  resumo: string | null;
  palavras_chave: string[];
  edital_url: string | null;
  ai_status: AiStatus;
  ai_error: string | null;
  raw_title: string | null;
  raw_content: string | null;
  relevance_score: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  // Joined from sources
  source_name?: string | null;
  source_type?: string | null;
  source_url?: string | null;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  type: 'rss' | 'playwright';
  cron_expression: string;
  is_active: boolean;
  last_crawled_at: string | null;
  error_count: number;
  crawl_interval_minutes: number;
  config: Record<string, unknown>;
  created_at: string;
  concurso_count?: number;
}

export interface AiPrompt {
  id: string;
  key: string;
  system_prompt: string;
  user_prompt_template: string;
  description: string | null;
  is_active: boolean;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ConcursoStats {
  total: number;
  by_status: Record<StatusConcurso, number>;
  by_esfera: Record<string, number>;
  by_area: Array<{ area: string; count: number }>;
  by_estado: Array<{ estado: string; count: number }>;
  inscricoes_abertas: number;
  novos_hoje: number;
  novos_7d: number;
}
