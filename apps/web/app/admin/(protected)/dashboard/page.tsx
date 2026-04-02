import { getAdminStats } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, Clock, AlertCircle, DollarSign, BarChart3 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let stats;
  try {
    stats = await getAdminStats();
  } catch {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <p className="text-destructive">Erro ao carregar estatísticas. Verifique a conexão com a API.</p>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total de Concursos',
      value: stats.total_concursos.toLocaleString('pt-BR'),
      icon: BarChart3,
      description: `${stats.novos_hoje} novos hoje`,
    },
    {
      title: 'Inscrições Abertas',
      value: stats.inscricoes_abertas.toLocaleString('pt-BR'),
      icon: TrendingUp,
      description: 'Concursos ativos',
      highlight: true,
    },
    {
      title: 'Aguardando IA',
      value: stats.pending_ai.toLocaleString('pt-BR'),
      icon: Clock,
      description: 'Pendentes de processamento',
    },
    {
      title: 'Novos (7 dias)',
      value: stats.novos_7d.toLocaleString('pt-BR'),
      icon: Users,
      description: `${stats.novos_30d} no último mês`,
    },
    {
      title: 'Custo IA Hoje',
      value: `$${stats.ai_cost_today.toFixed(4)}`,
      icon: DollarSign,
      description: `$${stats.ai_cost_7d.toFixed(2)} esta semana`,
    },
    {
      title: 'Erros IA Hoje',
      value: stats.ai_errors_today.toLocaleString('pt-BR'),
      icon: AlertCircle,
      description: 'Falhas de processamento',
    },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((card) => (
          <Card key={card.title} className={card.highlight ? 'border-green-500 dark:border-green-600' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${card.highlight ? 'text-green-600 dark:text-green-400' : ''}`}>
                {card.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.by_status).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground capitalize">
                    {status.replace(/_/g, ' ')}
                  </span>
                  <span className="font-semibold">{(count as number).toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top areas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Áreas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.by_area.slice(0, 8).map((item) => (
                <div key={item.area} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.area}</span>
                  <span className="font-semibold">{item.count.toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top sources */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Fontes com Mais Concursos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.top_sources.map((source) => (
                <div key={source.source_name} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{source.source_name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({source.source_type})</span>
                  </div>
                  <span className="font-semibold">{source.count.toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
