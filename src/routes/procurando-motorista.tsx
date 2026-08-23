import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { getCorrida, cancelarCorrida, verificarTimeoutCorrida } from '@/lib/user.functions';
import { supabase } from '@/integrations/supabase/client';
import { 
  Bike, 
  MapPin, 
  CreditCard, 
  Banknote, 
  QrCode, 
  X, 
  Search,
  SearchX,
  ChevronLeft,
  Navigation,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const RIDE_SEARCH_TIMEOUT_SECONDS = 120;

const searchSchema = z.object({
  rideId: z.string(),
});

export const Route = createFileRoute('/procurando-motorista')({
  validateSearch: (search) => searchSchema.parse(search),
  component: ProcurandoMotorista,
});

function ProcurandoMotorista() {
  const { rideId } = Route.useSearch();
  const navigate = useNavigate();
  const [corrida, setCorrida] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [motoristaEncontrado, setMotoristaEncontrado] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [semMotorista, setSemMotorista] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  
  const getCorridaFn = useServerFn(getCorrida);
  const cancelarCorridaFn = useServerFn(cancelarCorrida);
  const verificarTimeoutCorridaFn = useServerFn(verificarTimeoutCorrida);

  // Proteção contra chamadas duplicadas de verificarTimeoutCorrida
  const timeoutCheckInFlightRef = useRef(false);
  // Timer de retry controlado
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Interval da contagem regressiva
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref para evitar stale closure do motoristaEncontrado no callback do Realtime
  const motoristaEncontradoRef = useRef(false);

  // Ref estável para a função de verificação de timeout (usa closure sempre atual)
  const runTimeoutCheck = useRef(async () => {});

  runTimeoutCheck.current = async () => {
    if (timeoutCheckInFlightRef.current) return;
    timeoutCheckInFlightRef.current = true;

    try {
      const result = await verificarTimeoutCorridaFn({ data: { rideId } }) as any;

      const assignedStatuses = ["aceita", "motorista_a_caminho", "motorista_chegou", "em_andamento"];

      if (result.expired === true || result.status === 'sem_motorista') {
        // Servidor confirmou expiração — limpar retry pendente antes do estado final
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        setSemMotorista(true);
      } else if (assignedStatuses.includes(result.status)) {
        // MICROCORREÇÃO 3.8-C2-A: reconciliação server-side.
        // O servidor é autoritativo — não depender exclusivamente do Realtime.
        // Evita passageiro preso em 00:00 caso o evento Realtime seja perdido/atrasado.
        motoristaEncontradoRef.current = true;
        setMotoristaEncontrado(true);
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        navigate({ to: '/acompanhamento', search: { rideId } });
      } else if (result.status === 'solicitada') {
        // Servidor diz que ainda não expirou (diferença de relógio)
        // Não declarar sem_motorista localmente. Aguardar e verificar novamente.
        retryTimeoutRef.current = setTimeout(() => {
          runTimeoutCheck.current();
        }, 3000);
      }
      // else: qualquer outro status — Realtime trata como caminho rápido
    } catch (err) {
      console.error('Timeout check failed:', err);
      toast.error('Não foi possível confirmar o status da corrida. Tentando novamente.');
      retryTimeoutRef.current = setTimeout(() => {
        runTimeoutCheck.current();
      }, 5000);
    } finally {
      timeoutCheckInFlightRef.current = false;
    }
  };

  // Effect principal: carregar dados iniciais + inscrição Realtime
  useEffect(() => {
    let channel: any;

    async function fetchInitialData() {
      try {
        const data = await getCorridaFn({ data: { rideId } });
        setCorrida(data);

        const assignedStatuses = ["aceita", "motorista_a_caminho", "motorista_chegou", "em_andamento"];
        // Caso B: já atribuída — navegar para acompanhamento
        if (data && data.motorista_id && assignedStatuses.includes(data.status)) {
          motoristaEncontradoRef.current = true;
          setMotoristaEncontrado(true);
          navigate({ to: '/acompanhamento', search: { rideId } });
          return;
        }

        // Caso A: já sem_motorista — mostrar estado final imediatamente
        if (data.status === 'sem_motorista') {
          setSemMotorista(true);
        }
        // Caso C/D: solicitada — o effect de contagem cuida do timeout
      } catch (err) {
        console.error(err);
        toast.error("Não foi possível carregar os dados da corrida.");
        navigate({ to: '/' });
      } finally {
        setIsLoading(false);
      }
    }

    fetchInitialData();

    async function setupRealtime() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }

      channel = supabase
        .channel(`corrida_${rideId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'corridas',
            filter: `id=eq.${rideId}`,
          },
          (payload) => {
            const updatedRide = payload.new as any;
            setCorrida(updatedRide);

            // Tratamento explícito de sem_motorista via Realtime
            if (updatedRide.status === 'sem_motorista') {
              setSemMotorista(true);
              return; // Não navegar para acompanhamento
            }

            // Preservar fluxo de aceite do motorista
            const assignedStatuses = ["aceita", "motorista_a_caminho", "motorista_chegou", "em_andamento"];
            if (updatedRide.motorista_id && assignedStatuses.includes(updatedRide.status) && !motoristaEncontradoRef.current) {
              motoristaEncontradoRef.current = true;
              setMotoristaEncontrado(true);
              toast.success("Motorista encontrou você!");
              navigate({ to: '/acompanhamento', search: { rideId } });
            }
          }
        )
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            try {
              const data = await getCorridaFn({ data: { rideId } });
              const assignedStatuses = ["aceita", "motorista_a_caminho", "motorista_chegou", "em_andamento"];
              
              if (data && data.motorista_id && assignedStatuses.includes(data.status) && !motoristaEncontradoRef.current) {
                motoristaEncontradoRef.current = true;
                setMotoristaEncontrado(true);
                navigate({ to: '/acompanhamento', search: { rideId } });
              }
            } catch (err) {
              console.error('Erro na checagem extra pós-subscribe:', err);
            }
          }
        });
    }

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [rideId, getCorridaFn, navigate]);

  // Effect de contagem regressiva baseada no created_at real da corrida
  useEffect(() => {
    if (!corrida || semMotorista || motoristaEncontrado) return;
    if (corrida.status !== 'solicitada') return;

    const createdMs = new Date(corrida.created_at).getTime();
    if (isNaN(createdMs)) return;

    const computeRemaining = () => {
      const elapsed = Date.now() - createdMs;
      return Math.max(0, RIDE_SEARCH_TIMEOUT_SECONDS - Math.floor(elapsed / 1000));
    };

    let remaining = computeRemaining();
    setRemainingSeconds(remaining);

    // Caso C: já vencida na entrada — chamar servidor imediatamente
    if (remaining <= 0) {
      runTimeoutCheck.current();
      return;
    }

    // Caso D: dentro do prazo — iniciar contagem regressiva
    countdownIntervalRef.current = setInterval(() => {
      const r = computeRemaining();
      setRemainingSeconds(r);

      if (r <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        // Servidor é autoridade — não declarar sem_motorista localmente
        runTimeoutCheck.current();
      }
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [corrida, semMotorista, motoristaEncontrado]);

  // Cleanup de timers órfãos no unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, []);

  if (isLoading || !corrida) {
    return (
      <div className="min-h-[100dvh] bg-zuvvi-indigo flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 border-4 border-zuvvi-volt/20 border-t-zuvvi-volt rounded-full animate-spin mb-6" />
        <p className="text-white font-bold uppercase tracking-widest animate-pulse">
          Localizando sua corrida...
        </p>
      </div>
    );
  }

  const formatPagamento = (metodo: string) => {
    const map: Record<string, { label: string; icon: any }> = {
      pix: { label: 'Pix', icon: QrCode },
      cartao: { label: 'Cartão', icon: CreditCard },
      dinheiro: { label: 'Dinheiro', icon: Banknote },
    };
    return map[metodo] || { label: metodo, icon: CreditCard };
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const pgto = formatPagamento(corrida.forma_pagamento);
  const PgtoIcon = pgto.icon;

  const assignedStatuses = ["aceita", "motorista_a_caminho", "motorista_chegou", "em_andamento"];

  return (
    <div className="relative min-h-[100dvh] w-full bg-zuvvi-indigo text-foreground overflow-y-auto font-poppins pb-10">
      
      {/* Header */}
      <div className="p-6 flex items-center justify-between">
        <button 
          onClick={() => navigate({ to: '/' })}
          className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center transition-transform active:scale-90"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <div className="text-center">
          <p className="text-[10px] text-zuvvi-volt font-black uppercase tracking-[0.2em]">Zuvvi Moto</p>
          <h1 className="text-sm font-bold text-white uppercase tracking-wider">
            {semMotorista ? "Busca Encerrada" : "Buscando Motorista"}
          </h1>
        </div>
        <div className="w-12" /> {/* Spacer */}
      </div>

      <main className="px-6 space-y-8 max-w-md mx-auto">
        
        {semMotorista ? (
          <>
            {/* Estado final: Nenhum motorista disponível */}
            <div className="relative py-10 flex justify-center">
              <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center">
                <SearchX className="w-12 h-12 text-white/40" />
              </div>
            </div>

            {/* Mensagem de estado final — anunciável por tecnologia assistiva */}
            <div className="text-center space-y-2" aria-live="polite" aria-atomic="true">
              <h2 className="text-xl font-black text-white uppercase tracking-tight">
                NENHUM MOTORISTA DISPONÍVEL
              </h2>
              <p className="text-sm text-muted-foreground">
                Não encontramos um piloto disponível para esta corrida.
              </p>
              <p className="text-sm text-zuvvi-volt font-bold">
                Você pode tentar novamente agora.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Animação de Busca */}
            <div className="relative py-10 flex justify-center">
              <div className="relative w-48 h-48 flex items-center justify-center">
                {/* Círculos de pulso */}
                <div className="absolute inset-0 bg-zuvvi-volt/20 rounded-full animate-ping" />
                <div className="absolute inset-4 bg-zuvvi-volt/10 rounded-full animate-pulse" />
                
                {/* Ícone Central */}
                <div className="relative z-10 w-24 h-24 bg-zuvvi-volt rounded-3xl flex items-center justify-center zuvvi-glow shadow-[0_0_50px_rgba(198,255,61,0.3)]">
                  <Bike className="w-12 h-12 text-zuvvi-indigo" />
                </div>
                
                {/* Pontos de "radar" flutuantes */}
                <div className="absolute top-0 right-0 w-3 h-3 bg-white rounded-full animate-bounce delay-75" />
                <div className="absolute bottom-10 left-0 w-2 h-2 bg-zuvvi-volt rounded-full animate-bounce delay-300" />
                <div className="absolute top-20 left-40 w-2.5 h-2.5 bg-white/50 rounded-full animate-bounce delay-150" />
              </div>
            </div>

            {/* Status Text — anunciável por tecnologia assistiva */}
            <div className="text-center space-y-2" aria-live="polite" aria-atomic="true">
              <h2 className="text-xl font-black text-white uppercase tracking-tight">
                {motoristaEncontrado ? "Motorista a caminho!" : "Procurando pilotos próximos"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {motoristaEncontrado 
                  ? "Aguarde, seu piloto já está vindo ao seu encontro."
                  : "Estamos enviando seu pedido para os melhores pilotos da região."}
              </p>
            </div>

            {/* Contagem regressiva — sem aria-live para não anunciar a cada segundo */}
            {remainingSeconds !== null && !motoristaEncontrado && (
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Tempo de busca</p>
                <p className="text-2xl font-black text-zuvvi-volt tabular-nums">
                  {formatTime(remainingSeconds)}
                </p>
              </div>
            )}
          </>
        )}

        {/* Card de Resumo da Corrida */}
        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center py-1">
              <div className="w-2 h-2 rounded-full bg-white/40" />
              <div className="w-0.5 h-8 border-l border-dashed border-white/20 my-1" />
              <div className="w-2 h-2 rounded-full bg-zuvvi-volt zuvvi-glow" />
            </div>
            <div className="flex-1 space-y-4 min-w-0">
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">Origem</p>
                <p className="text-xs font-medium truncate opacity-60 italic">{(corrida as any).origem_nome || 'Sua localização'}</p>
              </div>
              <div>
                <p className="text-[9px] text-zuvvi-volt uppercase tracking-widest mb-0.5">Destino</p>
                <p className="text-xs font-bold truncate">{(corrida as any).destino_nome || 'Endereço de destino'}</p> 
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
            <div className="bg-white/5 rounded-2xl p-3 space-y-1">
              <p className="text-[8px] text-muted-foreground uppercase tracking-widest">Valor Estimado</p>
              <p className="text-lg font-black text-zuvvi-volt">
                R$ {(corrida as any).valor_estimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 space-y-1">
              <p className="text-[8px] text-muted-foreground uppercase tracking-widest">Pagamento</p>
              <div className="flex items-center gap-2">
                <PgtoIcon className="w-3 h-3 text-zuvvi-volt" />
                <p className="text-xs font-bold text-white uppercase">{pgto.label}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="space-y-4 pt-4">
          {semMotorista ? (
            // Estado final: TENTAR NOVAMENTE
            <button 
              onClick={() => navigate({ to: '/' })}
              className="w-full bg-zuvvi-volt text-zuvvi-indigo py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs transition-all hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-3"
            >
              <Search className="w-4 h-4" />
              TENTAR NOVAMENTE
            </button>
          ) : (
            // Buscando: CANCELAR CORRIDA
            <button 
              onClick={() => setShowCancelDialog(true)}
              disabled={isCancelling}
              className="w-full bg-white/5 text-white/60 py-5 rounded-[1.5rem] font-bold uppercase tracking-[0.2em] text-xs border border-white/5 transition-all hover:bg-white/10 active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              {isCancelling ? "CANCELANDO..." : "CANCELAR CORRIDA"}
            </button>
          )}
        </div>

        {/* Modal de Confirmação de Cancelamento — somente enquanto busca */}
        {!semMotorista && (
          <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
            <DialogContent className="bg-zuvvi-indigo border-white/10 text-white rounded-[2rem] sm:max-w-[400px]">
              <DialogHeader className="items-center text-center space-y-4 pt-4">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black uppercase tracking-tight text-white">
                    Cancelar Corrida?
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground pt-2">
                    Deseja realmente cancelar esta solicitação? Seus pilotos próximos deixarão de ver seu pedido.
                  </DialogDescription>
                </div>
              </DialogHeader>
              <DialogFooter className="flex flex-col gap-3 sm:flex-col sm:space-x-0 pt-6">
                <Button 
                  onClick={async () => {
                    try {
                      setIsCancelling(true);
                      await cancelarCorridaFn({ data: { rideId } });
                      toast.success("Corrida cancelada com sucesso.");
                      navigate({ to: '/' });
                    } catch (err) {
                      console.error(err);
                      toast.error("Erro ao cancelar a corrida. Tente novamente.");
                      setShowCancelDialog(false);
                    } finally {
                      setIsCancelling(false);
                    }
                  }}
                  disabled={isCancelling}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest py-6 rounded-2xl border-none"
                >
                  {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cancelar Corrida
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowCancelDialog(false)}
                  disabled={isCancelling}
                  className="w-full bg-transparent border-white/10 hover:bg-white/5 text-white font-bold uppercase tracking-widest py-6 rounded-2xl"
                >
                  Continuar buscando
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </main>

      {/* Footer Info */}
      <div className="mt-10 px-10 text-center">
        <p className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] leading-relaxed">
          ZUVVI MOBILIDADE URBANA • CNPJ 00.000.000/0001-00
        </p>
      </div>

      {motoristaEncontrado && (
        <div className="fixed bottom-0 left-0 right-0 p-6 z-50 animate-rise">
          <div className="bg-zuvvi-volt text-zuvvi-indigo p-6 rounded-[2rem] zuvvi-glow flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zuvvi-indigo/10 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider">Motorista aceitou!</p>
                <p className="text-[10px] font-bold opacity-80 uppercase tracking-tight">Preparando viagem...</p>
              </div>
            </div>
            <button 
              className="bg-zuvvi-indigo text-zuvvi-volt px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform"
              onClick={() => navigate({ to: '/acompanhamento', search: { rideId } })}
            >
              Ver Mapa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
