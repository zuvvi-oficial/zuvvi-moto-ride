import { createFileRoute, redirect, useNavigate, Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useSuspenseQuery } from '@tanstack/react-query';

import { getAdminStats } from '@/lib/admin.functions';
import { Users, Bike, MapPin, CheckCircle, Clock, AlertCircle, LogOut } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { queryOptions } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";

const adminStatsOptions = queryOptions({
  queryKey: ['admin-stats'],
  queryFn: () => getAdminStats(),
});

export const Route = createFileRoute('/admin/')({
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(adminStatsOptions);
    } catch (e) {
      throw redirect({ to: '/' });
    }
  },
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: stats } = useSuspenseQuery(adminStatsOptions);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: '/auth/login' });
  };

  const statCards = [
    {
      title: 'Motoristas Pendentes',
      value: stats.motoristasPendentes,
      description: 'Aguardando preenchimento',
      icon: Clock,
      color: 'text-amber-500',
    },
    {
      title: 'Em Análise',
      value: stats.motoristasEmAnalise,
      description: 'Documentos sendo validados',
      icon: AlertCircle,
      color: 'text-blue-500',
    },
    {
      title: 'Aprovados',
      value: stats.motoristasAprovados,
      description: 'Motoristas ativos',
      icon: CheckCircle,
      color: 'text-green-500',
    },
    {
      title: 'Veículos Pendentes',
      value: stats.veiculosPendentes,
      description: 'Aguardando aprovação',
      icon: Bike,
      color: 'text-purple-500',
    },
    {
      title: 'Corridas Abertas (BSB)',
      value: stats.corridasAbertasBSB,
      description: 'Solicitadas agora',
      icon: MapPin,
      color: 'text-indigo-500',
    },
    {
      title: 'Motoristas Online',
      value: stats.motoristasOnline,
      description: 'Disponíveis no mapa',
      icon: Users,
      color: 'text-volt',
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-zuvvi-indigo min-h-screen text-white">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Administrativo</h1>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSignOut}
            className="text-white/40 hover:text-white hover:bg-white/5 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2"
          >
            <LogOut className="w-3 h-3" />
            Sair
          </Button>
        </div>
        <div className="text-sm text-gray-400">
          Última atualização: {new Date(stats.lastUpdate).toLocaleString('pt-BR')}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title} className="bg-zuvvi-indigo/50 border-white/10 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-gray-400">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-4">
        <Button asChild className="bg-zuvvi-violet hover:bg-zuvvi-violet/80">
          <Link to="/admin/motoristas">Gerenciar Motoristas</Link>
        </Button>
        <Button asChild className="bg-zuvvi-violet hover:bg-zuvvi-violet/80">
          <Link to="/admin/veiculos">Gerenciar Veículos</Link>
        </Button>
        <Button asChild className="bg-zuvvi-violet hover:bg-zuvvi-violet/80">
          <Link to="/admin/cidades">Gerenciar Cidades</Link>
        </Button>
      </div>
    </div>
  );
}
