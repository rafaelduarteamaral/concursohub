import type { Metadata } from 'next';
import Link from 'next/link';
import { getConcurso } from '@/lib/api';
import { formatDate, formatCurrency, daysUntil } from '@/lib/utils';
import { ConcursoCard } from '@/components/concurso-card';
import { STATUS_LABELS, STATUS_COLORS, ESFERA_LABELS, ESFERA_COLORS } from '@/components/concurso-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MapPin, Users, Calendar, ExternalLink, Clock, AlertCircle,
  ChevronRight, Building2, Award
} from 'lucide-react';

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const c = await getConcurso(params.slug);
    return {
      title: c.titulo,
      description: c.resumo?.slice(0, 160) ?? `Concurso público: ${c.titulo}`,
    };
  } catch {
    return { title: 'Concurso não encontrado' };
  }
}

export const dynamic = 'force-dynamic';

export default async function ConcursoPage({ params }: PageProps) {
  let concurso;
  try {
    concurso = await getConcurso(params.slug);
  } catch {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Concurso não encontrado</h1>
        <Link href="/" className="text-primary hover:underline">
          Ver todos os concursos
        </Link>
      </div>
    );
  }

  const statusLabel = STATUS_LABELS[concurso.status] || concurso.status;
  const statusColor = STATUS_COLORS[concurso.status] || 'bg-gray-100 text-gray-600';
  const esferaLabel = concurso.esfera ? ESFERA_LABELS[concurso.esfera] : null;
  const esferaColor = concurso.esfera ? ESFERA_COLORS[concurso.esfera] : '';
  const diasParaFechar =
    concurso.status === 'inscricoes_abertas' ? daysUntil(concurso.inscricoes_fim) : null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-1">
        <Link href="/" className="hover:text-primary transition-colors">
          Concursos
        </Link>
        <ChevronRight className="h-3 w-3" />
        {concurso.area && (
          <>
            <Link
              href={`/?area=${encodeURIComponent(concurso.area)}`}
              className="hover:text-primary transition-colors"
            >
              {concurso.area}
            </Link>
            <ChevronRight className="h-3 w-3" />
          </>
        )}
        <span className="text-foreground line-clamp-1">{concurso.titulo}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>
            {statusLabel}
          </span>
          {esferaLabel && (
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${esferaColor}`}>
              {esferaLabel}
            </span>
          )}
          {concurso.area && (
            <Badge variant="outline">{concurso.area}</Badge>
          )}
        </div>

        <h1 className="text-2xl md:text-3xl font-bold mb-2">{concurso.titulo}</h1>

        {concurso.orgao && (
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="text-base">{concurso.orgao}</span>
          </div>
        )}

        {(concurso.estado || concurso.cidade) && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>
              {concurso.cidade ? `${concurso.cidade}, ` : ''}
              {concurso.estado ?? ''}
              {concurso.regiao ? ` (${concurso.regiao})` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Countdown urgency */}
      {diasParaFechar !== null && (
        <div
          className={`mb-6 flex items-center gap-2 p-3 rounded-lg text-sm font-semibold ${
            diasParaFechar <= 3
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : diasParaFechar <= 7
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          }`}
        >
          {diasParaFechar <= 0 ? (
            <><AlertCircle className="h-4 w-4" /> Último dia de inscrição!</>
          ) : (
            <><Clock className="h-4 w-4" /> {diasParaFechar} {diasParaFechar === 1 ? 'dia' : 'dias'} para fechar as inscrições</>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 p-4 rounded-xl bg-muted/50 border">
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Início das inscrições</p>
          <p className="font-semibold">{formatDate(concurso.inscricoes_inicio) || 'A definir'}</p>
        </div>
        <div className="text-center border-x border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Fim das inscrições</p>
          <p className={`font-semibold ${concurso.status === 'inscricoes_abertas' ? 'text-green-600 dark:text-green-400' : ''}`}>
            {formatDate(concurso.inscricoes_fim) || 'A definir'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Data da prova</p>
          <p className="font-semibold">{formatDate(concurso.data_prova) || 'A definir'}</p>
        </div>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {concurso.vagas_total != null && (
          <div className="rounded-lg border p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{concurso.vagas_total.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground">Vagas totais</p>
          </div>
        )}
        {concurso.vagas_pcd != null && (
          <div className="rounded-lg border p-4 text-center">
            <Award className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{concurso.vagas_pcd}</p>
            <p className="text-xs text-muted-foreground">Vagas PCD</p>
          </div>
        )}
        {(concurso.salario_min || concurso.salario_max) && (
          <div className="rounded-lg border p-4 text-center col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Remuneração</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {concurso.salario_min === concurso.salario_max
                ? formatCurrency(concurso.salario_min)
                : `${formatCurrency(concurso.salario_min)} – ${formatCurrency(concurso.salario_max)}`}
            </p>
            {concurso.remuneracao_texto && (
              <p className="text-xs text-muted-foreground mt-1">{concurso.remuneracao_texto}</p>
            )}
          </div>
        )}
      </div>

      {/* Cargos table */}
      {concurso.cargos && concurso.cargos.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Cargos</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-semibold">Cargo</th>
                  <th className="text-left p-3 font-semibold">Nível</th>
                  <th className="text-right p-3 font-semibold">Vagas</th>
                  <th className="text-right p-3 font-semibold">Salário Base</th>
                </tr>
              </thead>
              <tbody>
                {concurso.cargos.map((cargo, i) => (
                  <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium">{cargo.nome}</td>
                    <td className="p-3 text-muted-foreground capitalize">{cargo.nivel}</td>
                    <td className="p-3 text-right">
                      {cargo.vagas != null ? cargo.vagas.toLocaleString('pt-BR') : '-'}
                    </td>
                    <td className="p-3 text-right text-green-600 dark:text-green-400 font-medium">
                      {formatCurrency(cargo.salario_base)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Resumo */}
      {concurso.resumo && (
        <div className="mb-8 p-5 rounded-xl bg-primary/5 border border-primary/20">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span>Resumo</span>
            <Badge variant="outline" className="text-xs">Gerado por IA</Badge>
          </h2>
          <div className="text-sm leading-relaxed text-foreground whitespace-pre-line">
            {concurso.resumo}
          </div>
        </div>
      )}

      {/* Banca + details */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        {concurso.banca_organizadora && (
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-1">Banca Organizadora</p>
            <p className="font-semibold">{concurso.banca_organizadora}</p>
          </div>
        )}
        {concurso.nivel_escolaridade && concurso.nivel_escolaridade.length > 0 && (
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-2">Níveis de Escolaridade</p>
            <div className="flex flex-wrap gap-1">
              {concurso.nivel_escolaridade.map((n) => (
                <Badge key={n} variant="secondary" className="capitalize">{n}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edital link */}
      {concurso.edital_url && (
        <div className="mb-8">
          <a
            href={concurso.edital_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="w-full md:w-auto gap-2" size="lg">
              <ExternalLink className="h-4 w-4" />
              Acessar Edital Oficial
            </Button>
          </a>
        </div>
      )}

      {/* Source */}
      {concurso.source_name && (
        <div className="mb-8 text-xs text-muted-foreground">
          Fonte: {concurso.source_name}
          {' · '}
          <a
            href={concurso.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Ver original
          </a>
        </div>
      )}

      {/* Similar */}
      {concurso.similar && concurso.similar.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-bold mb-4">Concursos Similares</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {concurso.similar.map((c) => (
              <ConcursoCard key={c.id} concurso={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
