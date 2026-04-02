import type { Metadata } from 'next';
import Link from 'next/link';
import { searchConcursos } from '@/lib/api';
import { InfiniteConcursoGrid } from '@/components/infinite-concurso-grid';
import { SearchBar } from '@/components/search-bar';

interface BuscaPageProps {
  searchParams: { q?: string; page?: string };
}

export async function generateMetadata({ searchParams }: BuscaPageProps): Promise<Metadata> {
  const q = searchParams.q || '';
  return {
    title: q ? `Busca: "${q}" — ConcursoHub` : 'Buscar Concursos — ConcursoHub',
    description: q
      ? `Resultados de busca para "${q}" em concursos públicos brasileiros.`
      : 'Busque concursos públicos por órgão, cargo, banca ou área de atuação.',
  };
}

export const dynamic = 'force-dynamic';

export default async function BuscaPage({ searchParams }: BuscaPageProps) {
  const q = (searchParams.q || '').trim();

  if (!q) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Buscar Concursos</h1>
        <SearchBar />
        <p className="mt-4 text-sm text-muted-foreground">
          Digite o nome do órgão, cargo, banca organizadora ou área de atuação.
        </p>
      </div>
    );
  }

  const { data: concursos, total, total_pages } = await searchConcursos({ q, page: 1, per_page: 12 });

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Busca: &ldquo;{q}&rdquo;</span>
      </nav>

      <div className="mb-6">
        <div className="max-w-md mb-4">
          <SearchBar />
        </div>
        <h1 className="text-2xl font-bold">
          Resultados para &ldquo;{q}&rdquo;
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {total.toLocaleString('pt-BR')} concursos encontrados
        </p>
      </div>

      {total === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">Nenhum concurso encontrado para &ldquo;{q}&rdquo;.</p>
          <p className="mt-2 text-sm">
            Tente buscar por outros termos ou{' '}
            <Link href="/" className="text-primary hover:underline">
              veja todos os concursos
            </Link>
            .
          </p>
        </div>
      ) : (
        <InfiniteConcursoGrid
          initialConcursos={concursos}
          initialTotalPages={total_pages}
          totalConcursos={total}
          searchQuery={q}
        />
      )}
    </div>
  );
}
