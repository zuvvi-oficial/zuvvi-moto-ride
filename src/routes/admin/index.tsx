import { createFileRoute, redirect, useNavigate, Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useSuspenseQuery } from '@tanstack/react-query';

import { getAdminStats } from '@/lib/admin.functions';
import { Users, Bike, MapPin, CheckCircle, Clock, AlertCircle, LogOut } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { queryOptions } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminBottomNav } from '@/components/admin/AdminBottomNav';

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
      <AdminHeader 
        action={
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSignOut}
            className="h-9 px-3 sm:px-4 rounded-xl text-white/40 hover:text-white hover:bg-white/5 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all active:scale-95"
          >
            <LogOut className="w-3 h-3" />
            <span className="hidden sm:inline">Sair do Painel</span>
            <span className="sm:hidden">Sair</span>
          </Button>
        }
      />
      <AdminBottomNav />

      {/* 2 — CONTEÚDO DO DASHBOARD (CONGELADO) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 sm:space-y-12">
        <header className="space-y-2 sm:space-y-3">
          <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight tracking-tight text-white/90">
            Dashboard Administrativo
          </h1>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-4 h-4">
              <div className="w-1.5 h-1.5 rounded-full bg-zuvvi-volt animate-pulse shadow-[0_0_8px_rgba(198,255,61,0.5)]" />
            </div>
            <span className="text-[10px] sm:text-xs text-white/30 font-semibold tracking-wider uppercase">
              Última atualização: {new Date(stats.lastUpdate).toLocaleString('pt-BR')}
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="bg-white/[0.025] border-white/10 text-white rounded-2xl min-w-0 transition-all hover:bg-white/[0.04] hover:border-white/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
                <CardTitle className="text-sm sm:text-base font-semibold text-white/70">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{stat.value}</div>
                <p className="text-sm text-white/40 mt-1 font-medium">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pb-10">
          <Button asChild className="w-full h-12 sm:h-14 rounded-2xl font-bold text-sm tracking-wide bg-zuvvi-violet hover:bg-zuvvi-violet/90 transition-all hover:translate-y-[-1px] active:translate-y-[1px] shadow-lg shadow-zuvvi-violet/10">
            <Link to="/admin/motoristas">Gerenciar Motoristas</Link>
          </Button>
          <Button asChild className="w-full h-12 sm:h-14 rounded-2xl font-bold text-sm tracking-wide bg-zuvvi-violet hover:bg-zuvvi-violet/90 transition-all hover:translate-y-[-1px] active:translate-y-[1px] shadow-lg shadow-zuvvi-violet/10">
            <Link to="/admin/veiculos">Gerenciar Veículos</Link>
          </Button>
          <Button asChild className="w-full h-12 sm:h-14 rounded-2xl font-bold text-sm tracking-wide bg-zuvvi-violet hover:bg-zuvvi-violet/90 transition-all hover:translate-y-[-1px] active:translate-y-[1px] shadow-lg shadow-zuvvi-violet/10">
            <Link to="/admin/cidades">Gerenciar Cidades</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
