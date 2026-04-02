import { getSources } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function FontesPage() {
  let sources;
  try {
    sources = await getSources();
  } catch {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Fontes</h1>
        <p className="text-destructive">Erro ao carregar fontes.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Fontes de Dados</h1>
        <p className="text-sm text-muted-foreground">
          {sources.length} {sources.length === 1 ? 'fonte' : 'fontes'}
        </p>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-semibold">Nome</th>
              <th className="text-left p-3 font-semibold">Tipo</th>
              <th className="text-left p-3 font-semibold">Status</th>
              <th className="text-right p-3 font-semibold">Concursos</th>
              <th className="text-left p-3 font-semibold">Último crawl</th>
              <th className="text-right p-3 font-semibold">Erros</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id} className="border-t border-border hover:bg-muted/30">
                <td className="p-3">
                  <p className="font-medium">{source.name}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-xs">{source.url}</p>
                </td>
                <td className="p-3">
                  <Badge variant="outline" className="uppercase text-xs">
                    {source.type}
                  </Badge>
                </td>
                <td className="p-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      source.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {source.is_active ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="p-3 text-right font-semibold">
                  {(source.concurso_count ?? 0).toLocaleString('pt-BR')}
                </td>
                <td className="p-3 text-muted-foreground text-xs">
                  {source.last_crawled_at ? formatDate(source.last_crawled_at) : 'Nunca'}
                </td>
                <td className="p-3 text-right">
                  {source.error_count > 0 ? (
                    <span className="text-destructive font-semibold">{source.error_count}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
