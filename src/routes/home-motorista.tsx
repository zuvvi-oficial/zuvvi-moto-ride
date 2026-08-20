import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { 
  User, 
  Power, 
  Navigation, 
  Bike, 
  Clock, 
  CheckCircle2, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  getMotoristaStatusHome, 
  updateMotoristaDisponibilidade 
} from '@/lib/motorista-status.functions';
import { updateLocalizacaoMotorista } from '@/lib/motorista.functions';
import { resolveDestinationForLoader } from '@/lib/auth-status.functions';

export const Route = createFileRoute('/home-motorista')({
  loader: async () => {
    const dest = await resolveDestinationForLoader();
    if (dest.redirectTo !== '/home-motorista') {
      throw redirect({ to: dest.redirectTo });
    }
    return {};
  },
  component: HomeMotorista,
});

function HomeMotorista() {
  const queryClient = useQueryClient();
  const [isToggling, setIsToggling] = useState(false);
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  
  const watchIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const locationUpdateInFlightRef = useRef(false);

  const { data: status, isLoading, error } = useQuery({
    queryKey: ['motorista-status'],
    queryFn: () => getMotoristaStatusHome(),
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const mutation = useMutation({
    mutationFn: (disponivel: boolean) => updateMotoristaDisponibilidade({ data: { disponivel } }),
    onSuccess: (data) => {
      queryClient.setQueryData(['motorista-status'], (old: any) => ({
        ...old,
        is_disponivel: data.is_disponivel
      }));
      toast.success(data.is_disponivel ? "Você está Online" : "Você está Offline");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao mudar status");
    },
    onSettled: () => {
      setIsToggling(false);
    }
  });

  const updateLocationFn = useServerFn(updateLocalizacaoMotorista);

  const stopGps = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsGpsActive(false);
    setGpsError(null);
    lastUpdateRef.current = 0;
    locationUpdateInFlightRef.current = false;
  };

  const handleGpsError = (msg: string) => {
    stopGps();
    setGpsError(msg);
    toast.error(msg);
    // Fail-safe: colocar offline
    if (status?.is_disponivel) {
      mutation.mutate(false);
    }
  };

  useEffect(() => {
    if (status?.is_disponivel) {
      if (!navigator.geolocation) {
        handleGpsError("Seu navegador não suporta geolocalização.");
        return;
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

          const now = Date.now();
          // Lógica de Throttle: primeira imediata, depois 10s, sem concorrência
          const isFirstUpdate = lastUpdateRef.current === 0;
          const isTimeElapsed = now - lastUpdateRef.current >= 10000;
          const canUpdate = (isFirstUpdate || isTimeElapsed) && !locationUpdateInFlightRef.current;

          if (canUpdate) {
            locationUpdateInFlightRef.current = true;
            try {
              await updateLocationFn({ data: { lat: latitude, lng: longitude } });
              setIsGpsActive(true);
              setGpsError(null);
              lastUpdateRef.current = now;
            } catch (err: any) {
              handleGpsError("Não foi possível ativar sua localização. Permita o acesso ao GPS para ficar online.");
            } finally {
              locationUpdateInFlightRef.current = false;
            }
          }
        },
        (err) => {
          let msg = "Erro ao obter localização.";
          if (err.code === err.PERMISSION_DENIED) {
            msg = "Não foi possível ativar sua localização. Permita o acesso ao GPS para ficar online.";
          }
          handleGpsError(msg);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      stopGps();
    }

    return () => stopGps();
  }, [status?.is_disponivel]);

  const handleToggleOnline = () => {
    if (isToggling) return;
    setIsToggling(true);
    mutation.mutate(!status?.is_disponivel);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zuvvi-indigo flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-zuvvi-volt animate-spin" />
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="min-h-screen bg-zuvvi-indigo flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-white font-bold mb-2">Erro ao carregar perfil</h1>
        <p className="text-white/60 text-sm mb-6">Não foi possível recuperar seus dados operacionais.</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-white/10 text-white px-6 py-3 rounded-2xl font-bold uppercase text-[10px]"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const isOnline = status.is_disponivel;

  return (
    <div className="min-h-screen bg-zuvvi-indigo text-white pb-32 font-poppins">
      <header className={`p-6 flex items-center justify-between border-b border-white/5 sticky top-0 z-50 backdrop-blur-xl ${isOnline ? 'bg-zuvvi-volt/5' : 'bg-zuvvi-indigo/90'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <User className="w-5 h-5 text-zuvvi-volt" />
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Motorista Zuvvi</p>
            <h1 className="text-sm font-bold uppercase">{status.nome?.split(" ")[0]}</h1>
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

      <main className="p-6 max-w-md mx-auto">
        {!isOnline ? (
          <div className="py-20 text-center space-y-4 animate-in fade-in duration-700">
            <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto border border-white/5">
              <Bike className="w-10 h-10 text-white/20" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white/40 uppercase">Você está offline</h2>
              <p className="text-xs text-white/20 uppercase tracking-widest">Fique online para receber corridas</p>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center space-y-6 animate-pulse">
            <div className="relative w-32 h-32 mx-auto">
              <div className="absolute inset-0 bg-zuvvi-volt/20 rounded-full animate-ping" />
              <div className="relative z-10 w-full h-full bg-zuvvi-volt/10 rounded-full flex items-center justify-center border border-zuvvi-volt/20">
                <Navigation className="w-10 h-10 text-zuvvi-volt" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-zuvvi-volt uppercase tracking-widest">
                {isGpsActive ? 'Aguardando corridas' : 'ATIVANDO LOCALIZAÇÃO...'}
              </h2>
              <p className="text-xs text-muted-foreground uppercase">
                {isGpsActive ? 'LOCALIZAÇÃO ATIVA' : 'Obtendo sinal de GPS'}
              </p>
            </div>
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
          <button 
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-white transition-colors"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/auth/login';
            }}
          >
            <User className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase tracking-widest">Sair</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
