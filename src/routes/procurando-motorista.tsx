import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { getCorrida, cancelarCorrida } from '@/lib/user.functions';
import { supabase } from '@/integrations/supabase/client';
import { 
  Bike, 
  MapPin, 
  CreditCard, 
  Banknote, 
  QrCode, 
  X, 
  Search,
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
  
  const getCorridaFn = useServerFn(getCorrida);
  const cancelarCorridaFn = useServerFn(cancelarCorrida);

  useEffect(() => {
    async function fetchInitialData() {
      try {
        const data = await getCorridaFn({ data: { rideId } });
        setCorrida(data);
        
        const assignedStatuses = ["aceita", "motorista_a_caminho", "motorista_chegou", "em_andamento"];
        if (data && data.motorista_id && assignedStatuses.includes(data.status)) {
          setMotoristaEncontrado(true);
          navigate({ to: '/acompanhamento', search: { rideId } });
        }
      } catch (err) {
        console.error(err);
        toast.error("Não foi possível carregar os dados da corrida.");
        navigate({ to: '/' });
      } finally {
        setIsLoading(false);
      }
    }

    fetchInitialData();

    // Inscrição Realtime para monitorar a corrida específica
    let channel: any;
    
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
            
            const assignedStatuses = ["aceita", "motorista_a_caminho", "motorista_chegou", "em_andamento"];
            if (updatedRide.motorista_id && assignedStatuses.includes(updatedRide.status) && !motoristaEncontrado) {
              setMotoristaEncontrado(true);
              toast.success("Motorista encontrou você!");
              navigate({ to: '/acompanhamento', search: { rideId } });
            }
          }
        )
        .subscribe();
    }

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [rideId, getCorridaFn, navigate]);

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

  const pgto = formatPagamento(corrida.forma_pagamento);
  const PgtoIcon = pgto.icon;

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
          <h1 className="text-sm font-bold text-white uppercase tracking-wider">Buscando Motorista</h1>
        </div>
        <div className="w-12" /> {/* Spacer */}
      </div>

      <main className="px-6 space-y-8 max-w-md mx-auto">
        
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

        {/* Status Text */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            {motoristaEncontrado ? "Motorista a caminho!" : "Procurando pilotos próximos"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {motoristaEncontrado 
              ? "Aguarde, seu piloto já está vindo ao seu encontro."
              : "Estamos enviando seu pedido para os melhores pilotos da região."}
          </p>
        </div>

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

                {/* Nota: No MVP, não salvamos o NOME do destino no banco, apenas as coordenadas. 
                    Em uma fase real, buscaríamos o reverse geocode ou salvaríamos o nome. */}
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
          <button 
            onClick={() => setShowCancelDialog(true)}
            disabled={isCancelling}
            className="w-full bg-white/5 text-white/60 py-5 rounded-[1.5rem] font-bold uppercase tracking-[0.2em] text-xs border border-white/5 transition-all hover:bg-white/10 active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            {isCancelling ? "CANCELANDO..." : "CANCELAR CORRIDA"}
          </button>
        </div>

        {/* Modal de Confirmação de Cancelamento */}
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