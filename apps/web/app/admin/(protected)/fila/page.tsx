import Link from 'next/link';
import { getAdminQueue } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';

interface FilaPageProps {
  searchParams: { page?: string; ai_status?: string };
}

export const dynamic = 'force-dynamic';

const AI_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  done: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const AI_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  processing: 'Processando',
  done: 'Concluído',
  error: 'Erro',
};

export default async function FilaPage({ searchParams }: FilaPageProps) {
  const page = Number(searchParams.page || 1);
  const ai_status = searchParams.ai_status;

  let queue;
  try {
    queue = await getAdminQueue({ page, per_page: 25, ai_status });
  } catch {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Fila de Revisão</h1>
        <p className="text-destructive">Erro ao carregar fila.</p>
      </div>
    );
  }

  const statusFilters = ['', 'pending', 'processing', 'done', 'error'];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Fila de Revisão</h1>
        <p className="text-sm text-muted-foreground">
          {queue.total.toLocaleString('pt-BR')} itens
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {statusFilters.map((s) => (
          <Link
            key={s || 'all'}
            href={s ? `/admin/fila?ai_status=${s}` : '/admin/fila'}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${
              (s === '' && !ai_status) || s === ai_status
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {s ? AI_STATUS_LABELS[s] : 'Todos'}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-semibold">Título</th>
              <th className="text-left p-3 font-semibold">Órgão</th>
              <th className="text-left p-3 font-semibold">IA Status</th>
              <th className="text-left p-3 font-semibold">Fonte</th>
              <th className="text-left p-3 font-semibold">Criado em</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {queue.data.map((item) => (
              <tr key={item.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3 max-w-xs">
                  <p className="font-medium line-clamp-1">{item.titulo}</p>
                  {item.ai_error && (
                    <p className="text-xs text-destructive mt-1 line-clamp-1">{item.ai_error}</p>
                  )}
                </td>
                <td className="p-3 text-muted-foreground text-xs">{item.orgao || '-'}</td>
                <td className="p-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      AI_STATUS_COLORS[item.ai_status] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {AI_STATUS_LABELS[item.ai_status] || item.ai_status}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground text-xs">{item.source_name || '-'}</td>
                <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                  {formatDate(item.created_at)}
                </td>
                <td className="p-3">
                  {item.slug && (
                    <Link
                      href={`/concurso/${item.slug}`}
                      target="_blank"
                      className="text-primary hover:opacity-70"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {queue.total_pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {page > 1 && (
            <Link
              href={`/admin/fila?page=${page - 1}${ai_status ? `&ai_status=${ai_status}` : ''}`}
              className="px-4 py-2 rounded-md border text-sm hover:bg-muted"
            >
              Anterior
            </Link>
          )}
          <span className="px-4 py-2 text-sm text-muted-foreground">
            {page} / {queue.total_pages}
          </span>
          {page < queue.total_pages && (
            <Link
              href={`/admin/fila?page=${page + 1}${ai_status ? `&ai_status=${ai_status}` : ''}`}
              className="px-4 py-2 rounded-md border text-sm hover:bg-muted"
            >
              Próxima
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
