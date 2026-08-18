import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSessionUser } from "@/lib/user.functions";
import { useEffect, useState } from "react";
import { Bike, Loader2, User, Power, MapPin, Navigation, Clock, CheckCircle2, X, FileText, Shield, CreditCard } from "lucide-react";
import { toggleDisponibilidade, updateLocalizacaoMotorista, getOfertasDisponiveis, aceitarCorrida, recusarCorrida } from "@/lib/motorista.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { checkUserProfileStatus } from "@/lib/auth-status.functions";
import { Button } from "@/components/ui/button";
import OnboardingForm from "@/components/motorista/OnboardingForm";

import { resolveDestinationForLoader } from "@/lib/auth-status.functions";
import { redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/onboarding-motorista")({
  loader: async () => {
    const dest = await resolveDestinationForLoader();
    if (dest.redirectTo && dest.redirectTo !== "/onboarding-motorista") {
      throw redirect({ to: dest.redirectTo as any });
    }
  },
  component: HomeMotoristaPage,
});

function HomeMotoristaPage() {
  const getSessionUserFn = useServerFn(getSessionUser);
  const toggleDispFn = useServerFn(toggleDisponibilidade);
  const updateLocFn = useServerFn(updateLocalizacaoMotorista);
  const getOfertasFn = useServerFn(getOfertasDisponiveis);
  const aceitarFn = useServerFn(aceitarCorrida);
  const recusarCorridaFn = useServerFn(recusarCorrida);

  const { data: user, refetch: refetchUser } = useSuspenseQuery({
    queryKey: ["session-user"],
    queryFn: () => getSessionUserFn(),
  });

  const [isOnline, setIsOnline] = useState(user.motorista?.is_disponivel || false);
  const [isToggling, setIsToggling] = useState(false);
  const [ofertas, setOfertas] = useState<any[]>([]);
  const [corridaAceita, setCorridaAceita] = useState<any>(null);
  const [isAccepting, setIsAccepting] = useState<string | null>(null);

  const checkStatus = useServerFn(checkUserProfileStatus);
  const navigate = useNavigate();

  // Redirecionamento de segurança (guarda client-side em adição ao loader)
  useEffect(() => {
    checkStatus().then((status: any) => {
      if (status.isAdmin || status.redirectTo) {
        if (status.redirectTo && status.redirectTo !== "/onboarding-motorista") {
          navigate({ to: status.redirectTo || "/admin" });
        }
      }
    });
  }, [checkStatus, navigate]);

  const motorista = user.motorista;
  const statusAprovacao = motorista?.status_aprovacao || "em_preenchimento";
  const isAprovado = statusAprovacao === "aprovado";

  // Sincronizar estado local com o banco ao carregar
  useEffect(() => {
    if (user.motorista) {
      setIsOnline(user.motorista.is_disponivel);
    }
  }, [user.motorista]);

  // GPS e Ofertas Realtime
  useEffect(() => {
    if (!isOnline || !isAprovado) {
      setOfertas([]);
      return;
    }

    // 1. Iniciar loop de GPS
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        updateLocFn({ data: { lat: pos.coords.latitude, lng: pos.coords.longitude } })
          .catch(err => console.error("Erro GPS:", err));
      },
      (err) => console.error("Erro Watch GPS:", err),
      { enableHighAccuracy: true }
    );

    // 2. Carregar ofertas iniciais
    getOfertasFn().then(setOfertas).catch(console.error);

    // 3. Ouvir novas ofertas via Realtime
    const channel = supabase
      .channel('public:corridas')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'corridas',
        filter: `status=eq.solicitada`
      }, () => {
        getOfertasFn().then(setOfertas);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public', 
        table: 'corridas'
      }, (payload) => {
        if (payload.new && (payload.new as any).motorista_id === user.id) {
          setCorridaAceita(payload.new);
          setIsOnline(false);
        }
        getOfertasFn().then(setOfertas);
      })
      .subscribe();

    return () => {
      navigator.geolocation.clearWatch(watchId);
      supabase.removeChannel(channel);
    };
  }, [isOnline, isAprovado, getOfertasFn, updateLocFn]);

  const handleToggleOnline = async () => {
    setIsToggling(true);
    try {
      const nextState = !isOnline;
      await toggleDispFn({ data: { disponivel: nextState } });
      setIsOnline(nextState);
      toast.success(nextState ? "Você está online!" : "Você está offline.");
    } catch (err: any) {
      // Tratamento de erros específicos vindos do servidor (veículo, aprovação, etc)
      toast.error(err.message || "Erro ao mudar status.");
      // Se falhou, garante que o estado local reflita a realidade (offline se erro ao entrar)
      if (!isOnline) setIsOnline(false);
    } finally {
      setIsToggling(false);
    }
  };

  const handleAceitar = async (rideId: string) => {
    setIsAccepting(rideId);
    try {
      await aceitarFn({ data: { rideId } });
      toast.success("Corrida aceita!");
      
      const { data: rideData } = await supabase
        .from("corridas")
        .select("*")
        .eq("id", rideId)
        .single();
      
      setCorridaAceita(rideData);
      setIsOnline(false);
    } catch (err: any) {
      toast.error(err.message || "Não foi possível aceitar.");
    } finally {
      setIsAccepting(null);
    }
  };

  const handleRecusar = async (rideId: string) => {
    try {
      await recusarCorridaFn({ data: { rideId } });
      setOfertas(prev => prev.filter(o => o.id !== rideId));
      toast.info("Oferta removida.");
    } catch (err) {
      toast.error("Erro ao recusar oferta.");
    }
  };

  if (!isAprovado) {
    return (
      <div className="min-h-screen bg-zuvvi-indigo text-white pb-20 font-poppins">
        <header className="p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zuvvi-volt/20 flex items-center justify-center">
              <User className="text-zuvvi-volt w-5 h-5" />
            </div>
            <h1 className="text-sm font-bold uppercase tracking-wider">{user.nome.split(" ")[0]}</h1>
          </div>
          <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-[10px] font-bold uppercase">
            {statusAprovacao === 'em_analise' ? 'Em Análise' : 'Pendente'}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => supabase.auth.signOut().then(() => navigate({ to: '/auth/login' }))}
            className="text-white/40 hover:text-white hover:bg-white/5 font-bold uppercase text-[10px] tracking-widest"
          >
            Sair
          </Button>
        </header>
        <main className="p-6 space-y-6 max-w-md mx-auto">
          {statusAprovacao === 'em_analise' ? (
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-zuvvi-volt/10 rounded-full flex items-center justify-center mx-auto">
                <Clock className="w-8 h-8 text-zuvvi-volt" />
              </div>
              <h2 className="text-xl font-bold">Perfil em análise</h2>
              <p className="text-sm text-muted-foreground">
                Estamos verificando seus documentos. Você receberá um aviso assim que for aprovado para pilotar.
              </p>
            </div>
          ) : (
            <OnboardingForm onSubmitted={() => refetchUser()} />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zuvvi-indigo text-white pb-32 font-poppins transition-colors duration-500">
      <header className={`p-6 flex items-center justify-between border-b border-white/5 sticky top-0 z-50 backdrop-blur-xl ${isOnline ? 'bg-zuvvi-volt/5' : 'bg-zuvvi-indigo/90'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <User className="w-5 h-5 text-zuvvi-volt" />
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
              {(user as any).cidade?.nome || 'Brasília'}, {(user as any).cidade?.estado_uf || 'DF'}
            </p>
            <h1 className="text-sm font-bold uppercase">{user.nome.split(" ")[0]}</h1>
          </div>
        </div>

        <button 
          onClick={handleToggleOnline}
          disabled={isToggling}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all active:scale-95 ${isOnline ? 'bg-zuvvi-volt border-zuvvi-volt text-zuvvi-indigo' : 'bg-white/5 border-white/10 text-white'}`}
        >
          {isToggling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
          <span className="text-[10px] font-black uppercase tracking-widest">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </button>
      </header>

      <main className="p-6 max-w-md mx-auto space-y-6">
        {corridaAceita && (
          <div className="bg-white/5 border border-zuvvi-volt rounded-[2rem] p-6 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-zuvvi-volt uppercase tracking-widest">Corrida em Curso</h2>
              <div className="bg-zuvvi-volt text-zuvvi-indigo px-3 py-1 rounded-full text-[10px] font-black uppercase">
                {corridaAceita.status}
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Destino</p>
                <p className="text-sm font-bold">{corridaAceita.destino_nome}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Origem</p>
                <p className="text-sm opacity-70 italic">{corridaAceita.origem_nome}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Valor</p>
                <p className="text-lg font-black text-zuvvi-volt">R$ {corridaAceita.valor_estimado?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Pagamento</p>
                <p className="text-[10px] font-bold uppercase">{corridaAceita.forma_pagamento}</p>
              </div>
            </div>

            <button 
              className="w-full bg-white/10 hover:bg-white/20 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all"
              onClick={() => {
                // Futura navegação para detalhes/conclusão
                toast.info("Funcionalidade de conclusão em breve.");
              }}
            >
              Ver Detalhes
            </button>
          </div>
        )}

        {!isOnline && !corridaAceita && (
          <div className="py-20 text-center space-y-4 animate-in fade-in duration-700">
            <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto border border-white/5">
              <Bike className="w-10 h-10 text-white/20" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white/40 uppercase">Você está offline</h2>
              <p className="text-xs text-white/20 uppercase tracking-widest">Fique online para receber corridas</p>
            </div>
          </div>
        )}

        {isOnline && ofertas.length === 0 && (
          <div className="py-20 text-center space-y-6 animate-pulse">
            <div className="relative w-32 h-32 mx-auto">
              <div className="absolute inset-0 bg-zuvvi-volt/20 rounded-full animate-ping" />
              <div className="relative z-10 w-full h-full bg-zuvvi-volt/10 rounded-full flex items-center justify-center border border-zuvvi-volt/20">
                <Navigation className="w-10 h-10 text-zuvvi-volt" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-zuvvi-volt uppercase tracking-widest">Aguardando corridas</h2>
              <p className="text-xs text-muted-foreground uppercase">Sua localização está sendo enviada</p>
            </div>
          </div>
        )}

        {isOnline && ofertas.length > 0 && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[10px] text-zuvvi-volt font-black uppercase tracking-[0.2em]">Ofertas próximas ({ofertas.length})</h2>
            </div>
            
            {ofertas.map((ride) => (
              <div key={ride.id} className="bg-white/5 border border-zuvvi-volt/20 rounded-[2rem] p-6 space-y-6 zuvvi-glow shadow-[0_0_30px_rgba(198,255,61,0.05)]">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Ganhos Estimados</p>
                    <p className="text-2xl font-black text-zuvvi-volt">R$ {(ride.valor_estimado * 0.85).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-zuvvi-volt/10 px-3 py-1 rounded-full border border-zuvvi-volt/20">
                    <span className="text-[9px] font-black text-zuvvi-volt uppercase tracking-widest">Dinheiro</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                    <p className="text-xs font-medium truncate opacity-60 italic">{ride.origem_nome}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-zuvvi-volt" />
                    <p className="text-xs font-bold truncate">{ride.destino_nome}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button 
                    onClick={() => handleAceitar(ride.id)}
                    disabled={!!isAccepting}
                    className="bg-zuvvi-volt text-zuvvi-indigo py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    {isAccepting === ride.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    ACEITAR
                  </button>
                  <button 
                    onClick={() => handleRecusar(ride.id)}
                    className="bg-white/5 text-white/60 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] border border-white/5 active:scale-95 transition-all"
                  >
                    RECUSAR
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 p-6 z-50 pointer-events-none">
        <div className="max-w-md mx-auto bg-zuvvi-indigo/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-4 flex items-center justify-around pointer-events-auto shadow-2xl">
          <button className="flex flex-col items-center gap-1 text-zuvvi-volt">
            <Bike className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase tracking-widest">Corrida</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground opacity-50">
            <Clock className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase tracking-widest">Ganhos</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground opacity-50">
            <User className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase tracking-widest">Conta</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
