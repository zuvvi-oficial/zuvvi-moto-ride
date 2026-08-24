import { createFileRoute, redirect, useNavigate, Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useSuspenseQuery } from '@tanstack/react-query';

import { getAdminStats } from '@/lib/admin.functions';
import { Users, Bike, MapPin, CheckCircle, Clock, AlertCircle, LogOut } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { queryOptions } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { ZuvviLogo } from '@/components/brand/ZuvviLogo';

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
    <div className="min-h-[100dvh] overflow-x-hidden bg-zuvvi-indigo text-white flex flex-col">
      {/* Top Bar Premium */}
      <nav className="sticky top-0 z-40 w-full bg-zuvvi-indigo/90 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <ZuvviLogo surface="dark" className="h-6 sm:h-7 w-auto" />
            <div className="h-4 w-px bg-white/10 hidden sm:block" />
            <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] text-white/40 uppercase hidden sm:block">
              Administrativo
            </span>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSignOut}
            className="h-9 px-3 sm:px-4 rounded-xl text-white/40 hover:text-white hover:bg-white/5 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all active:scale-95"
          >
            <LogOut className="w-3 h-3" />
            <span className="hidden xs:inline">Sair</span>
          </Button>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <header className="space-y-1.5 sm:space-y-2">
          <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight tracking-tight text-white">
            Dashboard Administrativo
          </h1>
          <div className="text-[10px] sm:text-xs text-white/35 font-medium tracking-wide flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-zuvvi-volt animate-pulse" />
            Última atualização: {new Date(stats.lastUpdate).toLocaleString('pt-BR')}
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="bg-white/[0.025] border-white/10 text-white rounded-2xl min-w-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
                <CardTitle className="text-sm sm:text-base font-semibold">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                <div className="text-2xl sm:text-3xl font-bold tracking-tight">{stat.value}</div>
                <p className="text-sm text-white/45 mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button asChild className="w-full h-12 rounded-xl font-semibold bg-zuvvi-violet hover:bg-zuvvi-violet/80">
            <Link to="/admin/motoristas">Gerenciar Motoristas</Link>
          </Button>
          <Button asChild className="w-full h-12 rounded-xl font-semibold bg-zuvvi-violet hover:bg-zuvvi-violet/80">
            <Link to="/admin/veiculos">Gerenciar Veículos</Link>
          </Button>
          <Button asChild className="w-full h-12 rounded-xl font-semibold bg-zuvvi-violet hover:bg-zuvvi-violet/80">
            <Link to="/admin/cidades">Gerenciar Cidades</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
