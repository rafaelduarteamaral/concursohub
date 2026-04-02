'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

const ESTADOS = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];

const ESFERAS = [
  { value: 'federal', label: 'Federal' },
  { value: 'estadual', label: 'Estadual' },
  { value: 'municipal', label: 'Municipal' },
  { value: 'distrital', label: 'Distrital' },
];

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

const STATUS_OPTIONS = [
  { value: 'inscricoes_abertas', label: 'Inscrições Abertas' },
  { value: 'previsto', label: 'Previsto' },
  { value: 'inscricoes_encerradas', label: 'Inscrições Encerradas' },
  { value: 'aguardando_prova', label: 'Aguardando Prova' },
  { value: 'concluido', label: 'Concluído' },
];

const NIVEL_OPTIONS = [
  { value: 'fundamental', label: 'Fundamental' },
  { value: 'médio', label: 'Ensino Médio' },
  { value: 'técnico', label: 'Técnico' },
  { value: 'superior', label: 'Superior' },
];

interface FilterBarProps {
  className?: string;
}

export function FilterBar({ className }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page'); // reset pagination
      router.push(`/?${params.toString()}`);
    },
    [router, searchParams],
  );

  const currentEstado = searchParams.get('estado') || '';
  const currentEsfera = searchParams.get('esfera') || '';
  const currentArea = searchParams.get('area') || '';
  const currentStatus = searchParams.get('status') || '';
  const currentNivel = searchParams.get('nivel') || '';

  const selectClass =
    'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className={`flex flex-wrap gap-2 items-center ${className ?? ''}`}>
      {/* Estado */}
      <select
        className={selectClass}
        value={currentEstado}
        onChange={(e) => updateFilter('estado', e.target.value)}
        aria-label="Filtrar por estado"
      >
        <option value="">Todos os estados</option>
        {ESTADOS.map((e) => (
          <option key={e.value} value={e.value}>
            {e.label} ({e.value})
          </option>
        ))}
      </select>

      {/* Esfera */}
      <select
        className={selectClass}
        value={currentEsfera}
        onChange={(e) => updateFilter('esfera', e.target.value)}
        aria-label="Filtrar por esfera"
      >
        <option value="">Todas as esferas</option>
        {ESFERAS.map((e) => (
          <option key={e.value} value={e.value}>
            {e.label}
          </option>
        ))}
      </select>

      {/* Área */}
      <select
        className={selectClass}
        value={currentArea}
        onChange={(e) => updateFilter('area', e.target.value)}
        aria-label="Filtrar por área"
      >
        <option value="">Todas as áreas</option>
        {AREAS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      {/* Status */}
      <select
        className={selectClass}
        value={currentStatus}
        onChange={(e) => updateFilter('status', e.target.value)}
        aria-label="Filtrar por status"
      >
        <option value="">Todos os status</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      {/* Nível */}
      <select
        className={selectClass}
        value={currentNivel}
        onChange={(e) => updateFilter('nivel', e.target.value)}
        aria-label="Filtrar por nível de escolaridade"
      >
        <option value="">Todos os níveis</option>
        {NIVEL_OPTIONS.map((n) => (
          <option key={n.value} value={n.value}>
            {n.label}
          </option>
        ))}
      </select>

      {/* Clear filters */}
      {(currentEstado || currentEsfera || currentArea || currentStatus || currentNivel) && (
        <button
          onClick={() => router.push('/')}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
