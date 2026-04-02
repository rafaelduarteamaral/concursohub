'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ConcursoCard } from '@/components/concurso-card';
import { Skeleton } from '@/components/ui/skeleton';
import { getConcursos, searchConcursos } from '@/lib/api';
import type { Concurso, Esfera, StatusConcurso } from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface InfiniteConcursoGridProps {
  initialConcursos: Concurso[];
  initialTotalPages: number;
  totalConcursos: number;
  featured?: boolean;
  // Filters
  estado?: string;
  esfera?: Esfera;
  area?: string;
  status?: StatusConcurso;
  salario_min?: number;
  salario_max?: number;
  nivel?: string;
  banca?: string;
  searchQuery?: string;
}

const PER_PAGE = 12;

function CardSkeleton() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="p-4 space-y-2">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function InfiniteConcursoGrid({
  initialConcursos,
  initialTotalPages,
  totalConcursos,
  featured = false,
  estado,
  esfera,
  area,
  status,
  salario_min,
  salario_max,
  nivel,
  banca,
  searchQuery,
}: InfiniteConcursoGridProps) {
  const [concursos, setConcursos] = useState<Concurso[]>(initialConcursos);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialTotalPages > 1);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      const nextPage = page + 1;
      let data: Concurso[];
      let totalPages: number;

      if (searchQuery) {
        const res = await searchConcursos({ q: searchQuery, page: nextPage, per_page: PER_PAGE });
        data = res.data;
        totalPages = res.total_pages;
      } else {
        const res = await getConcursos({
          page: nextPage, per_page: PER_PAGE,
          estado, esfera, area, status,
          salario_min, salario_max, nivel, banca,
        });
        data = res.data;
        totalPages = res.total_pages;
      }

      setConcursos((prev) => [...prev, ...data]);
      setPage(nextPage);
      setHasMore(nextPage < totalPages);
    } catch {
      // Silent retry on next scroll
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [page, hasMore, estado, esfera, area, status, salario_min, salario_max, nivel, banca, searchQuery]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // Reset when filters change
  useEffect(() => {
    setConcursos(initialConcursos);
    setPage(1);
    setHasMore(initialTotalPages > 1);
  }, [initialConcursos, initialTotalPages]);

  if (concursos.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">Nenhum concurso encontrado.</p>
        <p className="text-sm mt-2">Tente ajustar os filtros para ver mais resultados.</p>
      </div>
    );
  }

  const [first, ...rest] = concursos;

  return (
    <div>
      <div className="mb-4 text-sm text-muted-foreground">
        {totalConcursos.toLocaleString('pt-BR')} concursos encontrados
      </div>

      {featured && first && (
        <div className="mb-6">
          <ConcursoCard concurso={first} featured />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(featured ? rest : concursos).map((c) => (
          <ConcursoCard key={c.id} concurso={c} />
        ))}
      </div>

      <div ref={sentinelRef} className="mt-8">
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        )}
        {!hasMore && !loading && concursos.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 opacity-0" />
            Todos os {concursos.length.toLocaleString('pt-BR')} concursos carregados
          </div>
        )}
      </div>
    </div>
  );
}
