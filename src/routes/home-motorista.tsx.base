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
  AlertCircle,
  MapPin,
  CircleDollarSign,
  Wallet,
  X,
  AlertTriangle
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  getMotoristaStatusHome, 
  updateMotoristaDisponibilidade 
} from '@/lib/motorista-status.functions';
import { 
  updateLocalizacaoMotorista,
  getOfertasDisponiveis,
  aceitarCorrida,
  recusarCorrida,
  cancelarCorridaMotorista
} from '@/lib/motorista.functions';

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
  const [processingRideId, setProcessingRideId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  
  const watchIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const locationUpdateInFlightRef = useRef(false);

  const getOfertasFn = useServerFn(getOfertasDisponiveis);
  const aceitarCorridaFn = useServerFn(aceitarCorrida);
  const recusarCorridaFn = useServerFn(recusarCorrida);
  const cancelarCorridaFn = useServerFn(cancelarCorridaMotorista);


  const { data: status, isLoading, error } = useQuery({
    queryKey: ['motorista-status'],
    queryFn: () => getMotoristaStatusHome(),
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const activeRide = status?.active_ride ?? null;
  const isOnline = !!status?.is_disponivel;

  const { data: rawOfertas = [] } = useQuery({
    queryKey: ['motorista-ofertas'],
    queryFn: () => getOfertasFn(),
    enabled: isOnline && isGpsActive && !activeRide,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  // Lista visual segura: só exibe se ONLINE, GPS ativo e sem corrida ativa
  const ofertas = (isOnline && isGpsActive && !activeRide) ? rawOfertas : [];

  const mutation = useMutation({
    mutationFn: (disponivel: boolean) => updateMotoristaDisponibilidade({ data: { disponivel } }),
    onSuccess: (data) => {
      queryClient.setQueryData(['motorista-status'], (old: any) => ({
        ...old,
        is_disponivel: data.is_disponivel
      }));
      if (!data.is_disponivel) {
        queryClient.setQueryData(['motorista-ofertas'], []);
      }
      toast.success(data.is_disponivel ? "Você está Online" : "Você está Offline");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao mudar status");
    },
    onSettled: () => {
      setIsToggling(false);
    }
  });

  const handleAceitar = async (rideId: string) => {
    if (processingRideId) return;
    setProcessingRideId(rideId);
    try {
      await aceitarCorridaFn({ data: { rideId } });
      toast.success("Corrida aceita com sucesso.");
      queryClient.invalidateQueries({ queryKey: ['motorista-ofertas'] });
      queryClient.invalidateQueries({ queryKey: ['motorista-status'] });
    } catch (err: any) {
      toast.error(err.message || "Falha ao aceitar corrida.");
      queryClient.invalidateQueries({ queryKey: ['motorista-ofertas'] });
    } finally {
      setProcessingRideId(null);
    }
  };

  const handleRecusar = async (rideId: string) => {
    if (processingRideId) return;
    setProcessingRideId(rideId);
    try {
      await recusarCorridaFn({ data: { rideId } });
      queryClient.invalidateQueries({ queryKey: ['motorista-ofertas'] });
    } catch (err: any) {
      toast.error(err.message || "Falha ao recusar corrida.");
    } finally {
      setProcessingRideId(null);
    }
  };

  const handleCancelarCorrida = async (rideId: string) => {
    if (processingRideId) return;
    
    setProcessingRideId(rideId);
    try {
      await cancelarCorridaFn({ data: { rideId } });
      toast.success("Corrida cancelada com sucesso.");
      setShowCancelModal(false);
      queryClient.invalidateQueries({ queryKey: ['motorista-status'] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao cancelar corrida.");
    } finally {
      setProcessingRideId(null);
    }
  };



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

  const shouldTrackLocation = isOnline || Boolean(activeRide);

  useEffect(() => {
    if (shouldTrackLocation) {
      if (!navigator.geolocation) {
        handleGpsError("Seu navegador não suporta geolocalização.");
        return;
      }

      // Evita recriar se o watchId já existe, mas limpa se shouldTrackLocation mudar
      if (watchIdRef.current === null) {
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
                // Se falhar no servidor, mas estiver em corrida, apenas loga (não desliga)
                if (activeRide) {
                  console.warn("Falha ao atualizar localização durante corrida ativa.");
                } else {
                  handleGpsError("Não foi possível ativar sua localização. Permita o acesso ao GPS para ficar online.");
                }
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
      }
    } else {
      stopGps();
    }

    return () => {
      // Se pararmos de rastrear, limpamos
      if (!shouldTrackLocation) {
        stopGps();
      }
    };
  }, [shouldTrackLocation, activeRide]);

  const handleToggleOnline = () => {
    if (isToggling || activeRide) return;
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

  

  return (
    <div className="min-h-screen bg-zuvvi-indigo text-white pb-32 font-poppins">
      <header className={`p-6 flex items-center justify-between border-b border-white/5 sticky top-0 z-50 backdrop-blur-xl ${(isOnline || activeRide) ? 'bg-zuvvi-volt/5' : 'bg-zuvvi-indigo/90'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <User className="w-5 h-5 text-zuvvi-volt" />
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Motorista Zuvvi</p>
            <h1 className="text-sm font-bold uppercase">{status.nome?.split(" ")[0]}</h1>
          </div>
        </div>

        {activeRide ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl border bg-zuvvi-volt border-zuvvi-volt text-zuvvi-indigo">
            <Bike className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">EM CORRIDA</span>
          </div>
        ) : (
          <button 
            onClick={handleToggleOnline}
            disabled={isToggling}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all active:scale-95 ${isOnline ? 'bg-zuvvi-volt border-zuvvi-volt text-zuvvi-indigo' : 'bg-white/5 border-white/10 text-white'}`}
          >
            {isToggling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
            <span className="text-[10px] font-black uppercase tracking-widest">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </button>
        )}
      </header>

      <main className="p-6 max-w-md mx-auto">
        {activeRide ? (
          <div className="bg-white/5 border border-zuvvi-volt/30 rounded-[2rem] p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 text-zuvvi-volt">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Corrida aceita</span>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center gap-1 mt-1">
                <div className="w-2 h-2 rounded-full bg-zuvvi-volt" />
                <div className="w-0.5 h-8 bg-white/10" />
                <MapPin className="w-4 h-4 text-white/40" />
              </div>
              <div className="flex-1 space-y-4">
                <div className="space-y-0.5">
                  <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest">Origem</p>
                  <p className="text-sm font-medium">{activeRide.origem_nome || 'Local de embarque'}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest">Destino</p>
                  <p className="text-sm font-medium">{activeRide.destino_nome || 'Local de destino'}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-2xl p-3 flex items-center gap-3">
                <CircleDollarSign className="w-4 h-4 text-zuvvi-volt" />
                <div>
                  <p className="text-[8px] text-white/40 uppercase font-black tracking-tighter">Valor</p>
                  <p className="text-xs font-bold text-zuvvi-volt">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(activeRide.valor_estimado))}
                  </p>
                </div>
              </div>
              <div className="bg-white/5 rounded-2xl p-3 flex items-center gap-3">
                <Wallet className="w-4 h-4 text-white/60" />
                <div>
                  <p className="text-[8px] text-white/40 uppercase font-black tracking-tighter">Pagamento</p>
                  <p className="text-xs font-bold uppercase tracking-tight truncate">{activeRide.forma_pagamento}</p>
                </div>
              </div>
            </div>

            <div className="bg-zuvvi-volt/10 border border-zuvvi-volt/20 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-zuvvi-volt">
                {activeRide.status === 'aceita' && 'MOTORISTA A CAMINHO DO EMBARQUE'}
                {activeRide.status === 'motorista_a_caminho' && 'A CAMINHO DO EMBARQUE'}
                {activeRide.status === 'motorista_chegou' && 'NO LOCAL DE EMBARQUE'}
                {activeRide.status === 'em_andamento' && 'CORRIDA EM ANDAMENTO'}
              </p>
            </div>

            <button
              onClick={() => setShowCancelModal(true)}
              disabled={!!processingRideId}
              className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              CANCELAR CORRIDA
            </button>
          </div>


        ) : !isOnline ? (
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
          <div className="space-y-4">
            {ofertas.length === 0 ? (
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
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {ofertas.map((oferta: any) => (
                  <div key={oferta.id} className="bg-white/5 border border-white/10 rounded-[2rem] p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-zuvvi-volt">
                        <Bike className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Novo pedido de corrida</span>
                      </div>
                      <span className="bg-zuvvi-volt/10 text-zuvvi-volt px-3 py-1 rounded-full text-[9px] font-bold">
                        {oferta.distancia_aprox_m >= 1000 
                          ? `${(oferta.distancia_aprox_m / 1000).toFixed(1)}km` 
                          : `${oferta.distancia_aprox_m}m`}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center gap-1 mt-1">
                          <div className="w-2 h-2 rounded-full bg-zuvvi-volt" />
                          <div className="w-0.5 h-8 bg-white/10" />
                          <MapPin className="w-4 h-4 text-white/40" />
                        </div>
                        <div className="flex-1 space-y-4">
                          <div className="space-y-0.5">
                            <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest">Embarque</p>
                            <p className="text-sm font-medium line-clamp-1">{oferta.origem_nome || 'Local de embarque'}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest">Destino</p>
                            <p className="text-sm font-medium line-clamp-1">{oferta.destino_nome || 'Local de destino'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="bg-white/5 rounded-2xl p-3 flex items-center gap-3">
                          <CircleDollarSign className="w-4 h-4 text-zuvvi-volt" />
                          <div>
                            <p className="text-[8px] text-white/40 uppercase font-black tracking-tighter">Valor</p>
                            <p className="text-xs font-bold text-zuvvi-volt">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(oferta.valor_estimado)}
                            </p>
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-3 flex items-center gap-3">
                          <Wallet className="w-4 h-4 text-white/60" />
                          <div>
                            <p className="text-[8px] text-white/40 uppercase font-black tracking-tighter">Pagamento</p>
                            <p className="text-xs font-bold uppercase tracking-tight truncate">{oferta.forma_pagamento}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleRecusar(oferta.id)}
                        disabled={!!processingRideId}
                        className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        Recusar
                      </button>
                      <button 
                        onClick={() => handleAceitar(oferta.id)}
                        disabled={!!processingRideId}
                        className="flex-[2] py-4 rounded-2xl bg-zuvvi-volt text-zuvvi-indigo text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {processingRideId === oferta.id && <Loader2 className="w-3 h-3 animate-spin" />}
                        {processingRideId === oferta.id ? 'Aceitando...' : 'Aceitar Corrida'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
      {/* Modal de Confirmação de Cancelamento Profissional */}
      {showCancelModal && activeRide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zuvvi-indigo/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-zuvvi-indigo border border-white/10 rounded-[2.5rem] p-8 space-y-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-[2rem] bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white uppercase tracking-tight">Cancelar Corrida?</h2>
                <p className="text-xs text-white/40 leading-relaxed">
                  O cancelamento frequente pode afetar sua nota e prioridade no recebimento de novas ofertas.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleCancelarCorrida(activeRide.id)}
                disabled={!!processingRideId}
                className="w-full py-5 rounded-2xl bg-red-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processingRideId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>CANCELANDO...</span>
                  </>
                ) : (
                  'CONFIRMAR CANCELAMENTO'
                )}
              </button>
              
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={!!processingRideId}
                className="w-full py-5 rounded-2xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                VOLTAR PARA CORRIDA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

