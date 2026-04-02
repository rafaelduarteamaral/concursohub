import type { Metadata } from 'next';
import Link from 'next/link';
import { getConcursos } from '@/lib/api';
import { InfiniteConcursoGrid } from '@/components/infinite-concurso-grid';
import { Button } from '@/components/ui/button';

interface AreaPageProps {
  params: { slug: string };
}

const AREAS = [
  'Tecnologia da Informação',
  'Fiscal e Tributária',
  'Saúde',
  'Educação',
  'Segurança Pública',
  'Jurídica',
  'Administrativa',
  'Engenharia',
  'Controle e Auditoria',
  'Diplomacia',
  'Meio Ambiente',
];

function slugToArea(slug: string): string {
  // Try to find matching area by normalizing to slug
  return AREAS.find(
    (a) =>
      a
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '') === slug,
  ) || decodeURIComponent(slug);
}

function areaToSlug(area: string): string {
  return area
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export async function generateMetadata({ params }: AreaPageProps): Promise<Metadata> {
  const area = slugToArea(params.slug);
  return {
    title: `Concursos em ${area} — ConcursoHub`,
    description: `Concursos públicos na área de ${area}. Inscrições abertas, editais e datas de provas.`,
  };
}

export const dynamic = 'force-dynamic';

export default async function AreaPage({ params }: AreaPageProps) {
  const area = slugToArea(params.slug);

  const { data: concursos, total, total_pages } = await getConcursos({
    page: 1,
    per_page: 12,
    area,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{area}</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{area}</h1>
        <p className="text-muted-foreground">
          {total.toLocaleString('pt-BR')} concursos encontrados
        </p>
      </div>

      {/* Area navigation */}
      <div className="flex flex-wrap gap-2 mb-8">
        {AREAS.map((a) => (
          <Link key={a} href={`/area/${areaToSlug(a)}`}>
            <Button variant={a === area ? 'default' : 'outline'} size="sm" className="text-xs">
              {a}
            </Button>
          </Link>
        ))}
      </div>

      {concursos.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">Nenhum concurso encontrado na área de {area}.</p>
          <p className="mt-2">
            <Link href="/" className="text-primary hover:underline">
              Ver todos os concursos
            </Link>
          </p>
        </div>
      ) : (
        <InfiniteConcursoGrid
          initialConcursos={concursos}
          initialTotalPages={total_pages}
          totalConcursos={total}
          area={area}
        />
      )}
    </div>
  );
}
