import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getConcursos } from '@/lib/api';
import type { Esfera, StatusConcurso } from '@/lib/api';
import { FilterBar } from '@/components/filter-bar';
import { InfiniteConcursoGrid } from '@/components/infinite-concurso-grid';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'ConcursoHub — Concursos Públicos do Brasil',
  description:
    'Encontre concursos públicos com inscrições abertas, editais e informações completas. Federal, estadual e municipal.',
};

interface HomePageProps {
  searchParams: {
    estado?: string;
    esfera?: string;
    area?: string;
    status?: string;
    salario_min?: string;
    salario_max?: string;
    nivel?: string;
    banca?: string;
    page?: string;
  };
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

async function ConcursoSection({ params }: { params: HomePageProps['searchParams'] }) {
  const { data: concursos, total, total_pages } = await getConcursos({
    page: 1,
    per_page: 12,
    estado: params.estado,
    esfera: params.esfera as Esfera | undefined,
    area: params.area,
    status: params.status as StatusConcurso | undefined,
    salario_min: params.salario_min ? Number(params.salario_min) : undefined,
    salario_max: params.salario_max ? Number(params.salario_max) : undefined,
    nivel: params.nivel,
    banca: params.banca,
  });

  return (
    <InfiniteConcursoGrid
      initialConcursos={concursos}
      initialTotalPages={total_pages}
      totalConcursos={total}
      featured={!params.estado && !params.esfera && !params.area && !params.status}
      estado={params.estado}
      esfera={params.esfera as Esfera | undefined}
      area={params.area}
      status={params.status as StatusConcurso | undefined}
      salario_min={params.salario_min ? Number(params.salario_min) : undefined}
      salario_max={params.salario_max ? Number(params.salario_max) : undefined}
      nivel={params.nivel}
      banca={params.banca}
    />
  );
}

export default function HomePage({ searchParams }: HomePageProps) {
  const hasFilters = Object.values(searchParams).some(Boolean);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero */}
      {!hasFilters && (
        <div className="mb-8 text-center py-8 px-4 rounded-2xl bg-gradient-to-br from-primary/10 via-background to-background border border-primary/20">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Encontre seu concurso ideal
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            Acompanhe concursos públicos abertos, inscrições, editais e datas de provas em
            todo o Brasil — federal, estadual e municipal.
          </p>
        </div>
      )}

      {hasFilters && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Concursos Públicos</h1>
          <p className="text-muted-foreground text-sm">Resultados filtrados</p>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6">
        <Suspense fallback={<div className="h-10" />}>
          <FilterBar />
        </Suspense>
      </div>

      {/* Grid */}
      <Suspense fallback={<GridSkeleton />}>
        <ConcursoSection params={searchParams} />
      </Suspense>
    </div>
  );
}

export const revalidate = 60;
