import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, formatCurrency, daysUntil } from '@/lib/utils';
import type { Concurso } from '@/lib/api';
import { MapPin, Users, Calendar, Clock, AlertCircle } from 'lucide-react';

interface ConcursoCardProps {
  concurso: Concurso;
  featured?: boolean;
}

export const STATUS_LABELS: Record<string, string> = {
  previsto: 'Previsto',
  inscricoes_abertas: 'Inscrições Abertas',
  inscricoes_encerradas: 'Inscrições Encerradas',
  aguardando_prova: 'Aguardando Prova',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  suspenso: 'Suspenso',
  cancelado: 'Cancelado',
};

export const STATUS_COLORS: Record<string, string> = {
  previsto: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  inscricoes_abertas: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  inscricoes_encerradas: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  aguardando_prova: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  em_andamento: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  concluido: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  suspenso: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  cancelado: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

export const ESFERA_LABELS: Record<string, string> = {
  federal: 'Federal',
  estadual: 'Estadual',
  municipal: 'Municipal',
  distrital: 'Distrital',
};

export const ESFERA_COLORS: Record<string, string> = {
  federal: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  estadual: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  municipal: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  distrital: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
};

export function ConcursoCard({ concurso, featured = false }: ConcursoCardProps) {
  const statusColor = STATUS_COLORS[concurso.status] || 'bg-gray-100 text-gray-600';
  const statusLabel = STATUS_LABELS[concurso.status] || concurso.status;
  const esferaColor = concurso.esfera ? ESFERA_COLORS[concurso.esfera] : '';
  const esferaLabel = concurso.esfera ? ESFERA_LABELS[concurso.esfera] : null;

  const diasParaFechar =
    concurso.status === 'inscricoes_abertas' ? daysUntil(concurso.inscricoes_fim) : null;

  const salarioRange =
    concurso.salario_min || concurso.salario_max
      ? concurso.salario_min === concurso.salario_max
        ? formatCurrency(concurso.salario_min)
        : `${formatCurrency(concurso.salario_min)} – ${formatCurrency(concurso.salario_max)}`
      : concurso.remuneracao_texto || null;

  const href = `/concurso/${concurso.slug ?? concurso.id}`;

  return (
    <Link href={href} className="group block">
      <Card
        className={`overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 border-l-4 ${
          concurso.status === 'inscricoes_abertas'
            ? 'border-l-green-500'
            : concurso.status === 'previsto'
            ? 'border-l-blue-500'
            : concurso.status === 'aguardando_prova'
            ? 'border-l-orange-500'
            : 'border-l-gray-200 dark:border-l-gray-700'
        } ${featured ? 'h-full' : ''}`}
      >
        <CardContent className="p-4">
          {/* Status + Esfera row */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor}`}>
              {statusLabel}
            </span>
            {esferaLabel && (
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${esferaColor}`}>
                {esferaLabel}
              </span>
            )}
            {concurso.area && (
              <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                {concurso.area}
              </span>
            )}
          </div>

          {/* Title */}
          <h2
            className={`font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2 mb-1 ${
              featured ? 'text-lg' : 'text-sm'
            }`}
          >
            {concurso.titulo}
          </h2>

          {/* Orgao */}
          {concurso.orgao && (
            <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{concurso.orgao}</p>
          )}

          {/* Location */}
          {(concurso.estado || concurso.cidade) && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
              <MapPin className="h-3 w-3 shrink-0" />
              <span>
                {concurso.cidade ? `${concurso.cidade}, ` : ''}
                {concurso.estado ?? ''}
              </span>
            </div>
          )}

          {/* Vagas + Salary */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
            {concurso.vagas_total != null && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {concurso.vagas_total.toLocaleString('pt-BR')} vagas
              </span>
            )}
            {salarioRange && (
              <span className="font-medium text-foreground text-xs truncate">
                {salarioRange}
              </span>
            )}
          </div>

          {/* Inscricoes fim */}
          {concurso.inscricoes_fim && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>Inscrições até {formatDate(concurso.inscricoes_fim)}</span>
            </div>
          )}

          {/* Countdown urgency badge */}
          {diasParaFechar !== null && (
            <div
              className={`mt-2 flex items-center gap-1 text-xs font-semibold rounded px-2 py-0.5 w-fit ${
                diasParaFechar <= 3
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : diasParaFechar <= 7
                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              }`}
            >
              {diasParaFechar <= 0 ? (
                <>
                  <AlertCircle className="h-3 w-3" />
                  Último dia!
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  {diasParaFechar} {diasParaFechar === 1 ? 'dia' : 'dias'} para fechar inscrições
                </>
              )}
            </div>
          )}

          {/* Banca */}
          {concurso.banca_organizadora && (
            <p className="mt-2 text-xs text-muted-foreground">
              Banca: <span className="font-medium">{concurso.banca_organizadora}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
