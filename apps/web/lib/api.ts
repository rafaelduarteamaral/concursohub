/**
 * API client for ConcursoHub.
 * Server-side: uses API_URL (Docker internal).
 * Client-side: uses NEXT_PUBLIC_API_URL (browser-reachable).
 */
function getApiBase(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

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

export interface Cargo {
  nome: string;
  nivel: string;
  vagas: number | null;
  salario_base: number | null;
}

export interface Concurso {
  id: string;
  source_id: string | null;
  original_url: string;
  slug: string;
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
  ai_status: string;
  ai_error: string | null;
  relevance_score: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  source_name?: string | null;
  source_type?: string | null;
  source_url?: string | null;
  similar?: Concurso[];
}

export interface Source {
  id: string;
  name: string;
  url: string;
  type: string;
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
  by_status: Record<string, number>;
  by_area: Array<{ area: string; count: number }>;
  by_estado: Array<{ estado: string; count: number }>;
  inscricoes_abertas: number;
  novos_hoje: number;
  novos_7d: number;
}

export interface AdminStats {
  total_concursos: number;
  inscricoes_abertas: number;
  previstos: number;
  pending_ai: number;
  novos_hoje: number;
  novos_7d: number;
  novos_30d: number;
  by_status: Record<string, number>;
  by_area: Array<{ area: string; count: number }>;
  by_estado: Array<{ estado: string; count: number }>;
  top_sources: Array<{ source_name: string; source_type: string; count: number }>;
  ai_cost_today: number;
  ai_cost_7d: number;
  ai_errors_today: number;
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit & { cache?: RequestCache; next?: { revalidate?: number; tags?: string[] } },
): Promise<T> {
  const url = `${getApiBase()}/api/v1${path}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!response.ok) {
    const error = await response.text().catch(() => 'Erro desconhecido');
    throw new Error(`API error ${response.status}: ${error}`);
  }

  return response.json();
}

// ---- Concursos ----

export async function getConcursos(params: {
  page?: number;
  per_page?: number;
  estado?: string;
  esfera?: Esfera;
  area?: string;
  status?: StatusConcurso;
  salario_min?: number;
  salario_max?: number;
  nivel?: string;
  banca?: string;
} = {}): Promise<PaginatedResponse<Concurso>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.per_page) query.set('per_page', String(params.per_page));
  if (params.estado) query.set('estado', params.estado);
  if (params.esfera) query.set('esfera', params.esfera);
  if (params.area) query.set('area', params.area);
  if (params.status) query.set('status', params.status);
  if (params.salario_min != null) query.set('salario_min', String(params.salario_min));
  if (params.salario_max != null) query.set('salario_max', String(params.salario_max));
  if (params.nivel) query.set('nivel', params.nivel);
  if (params.banca) query.set('banca', params.banca);

  return apiFetch(`/concursos?${query.toString()}`, {
    next: { revalidate: 60, tags: ['concursos'] },
  });
}

export async function getConcurso(slug: string): Promise<Concurso> {
  return apiFetch(`/concursos/${slug}`, {
    next: { revalidate: 300, tags: [`concurso-${slug}`] },
  });
}

export async function searchConcursos(params: {
  q: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedResponse<Concurso> & { query: string }> {
  const query = new URLSearchParams({ q: params.q });
  if (params.page) query.set('page', String(params.page));
  if (params.per_page) query.set('per_page', String(params.per_page));
  return apiFetch(`/concursos/search?${query.toString()}`, { cache: 'no-store' });
}

export async function getStats(): Promise<ConcursoStats> {
  return apiFetch('/stats', { next: { revalidate: 300 } });
}

export async function updateConcursoStatus(
  slug: string,
  status: StatusConcurso,
): Promise<{ id: string; slug: string; status: string }> {
  return apiFetch(`/concursos/${slug}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// ---- Sources ----

export async function getSources(): Promise<Source[]> {
  return apiFetch('/sources', { cache: 'no-store' });
}

export async function createSource(
  data: Omit<Source, 'id' | 'created_at' | 'last_crawled_at' | 'error_count' | 'concurso_count'>,
): Promise<Source> {
  return apiFetch('/sources', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateSource(id: string, data: Partial<Source>): Promise<Source> {
  return apiFetch(`/sources/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteSource(id: string): Promise<void> {
  return apiFetch(`/sources/${id}`, { method: 'DELETE' });
}

export async function triggerSource(id: string): Promise<{ message: string }> {
  return apiFetch(`/sources/${id}/trigger`, { method: 'POST' });
}

// ---- Admin ----

export async function getAdminStats(): Promise<AdminStats> {
  return apiFetch('/admin/stats', { cache: 'no-store' });
}

export async function getAdminQueue(params: {
  page?: number;
  per_page?: number;
  ai_status?: string;
} = {}): Promise<PaginatedResponse<Concurso>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.per_page) query.set('per_page', String(params.per_page));
  if (params.ai_status) query.set('ai_status', params.ai_status);
  return apiFetch(`/admin/fila?${query.toString()}`, { cache: 'no-store' });
}

// ---- Prompts ----

export async function getPrompts(): Promise<AiPrompt[]> {
  return apiFetch('/admin/prompts', { cache: 'no-store' });
}

export async function getPrompt(key: string): Promise<AiPrompt> {
  return apiFetch(`/admin/prompts/${key}`, { cache: 'no-store' });
}

export async function createPrompt(
  data: Omit<AiPrompt, 'id' | 'updated_at'>,
): Promise<AiPrompt> {
  return apiFetch('/admin/prompts', { method: 'POST', body: JSON.stringify(data) });
}

export async function updatePrompt(key: string, data: Partial<AiPrompt>): Promise<AiPrompt> {
  return apiFetch(`/admin/prompts/${key}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deletePrompt(key: string): Promise<void> {
  return apiFetch(`/admin/prompts/${key}`, { method: 'DELETE' });
}
