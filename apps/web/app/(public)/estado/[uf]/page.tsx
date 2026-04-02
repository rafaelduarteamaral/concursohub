import type { Metadata } from 'next';
import Link from 'next/link';
import { getConcursos } from '@/lib/api';
import { InfiniteConcursoGrid } from '@/components/infinite-concurso-grid';
import { Button } from '@/components/ui/button';

interface EstadoPageProps {
  params: { uf: string };
}

const ESTADOS: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo',
  SE: 'Sergipe', TO: 'Tocantins',
};

const ESTADOS_LIST = Object.keys(ESTADOS).sort();

export async function generateMetadata({ params }: EstadoPageProps): Promise<Metadata> {
  const uf = params.uf.toUpperCase();
  const nome = ESTADOS[uf] || uf;
  return {
    title: `Concursos em ${nome} — ConcursoHub`,
    description: `Concursos públicos abertos e previstos no estado de ${nome}. Inscrições, editais e datas de provas.`,
  };
}

export const dynamic = 'force-dynamic';

export default async function EstadoPage({ params }: EstadoPageProps) {
  const uf = params.uf.toUpperCase();
  const nomEstado = ESTADOS[uf] || uf;

  const { data: concursos, total, total_pages } = await getConcursos({
    page: 1,
    per_page: 12,
    estado: uf,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{nomEstado}</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Concursos em {nomEstado}</h1>
        <p className="text-muted-foreground">
          {total.toLocaleString('pt-BR')} concursos encontrados
        </p>
      </div>

      {/* Estado navigation */}
      <div className="flex flex-wrap gap-2 mb-8">
        {ESTADOS_LIST.map((estado) => (
          <Link key={estado} href={`/estado/${estado.toLowerCase()}`}>
            <Button variant={estado === uf ? 'default' : 'outline'} size="sm" className="text-xs">
              {estado}
            </Button>
          </Link>
        ))}
      </div>

      {concursos.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">Nenhum concurso encontrado em {nomEstado}.</p>
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
          estado={uf}
        />
      )}
    </div>
  );
}
