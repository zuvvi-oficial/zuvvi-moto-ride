import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getHistoricoCorridas } from "@/lib/historico.functions";
import { ChevronLeft, Clock, MapPin, User, Calendar, CreditCard, Loader2 } from "lucide-react";
import { resolveDestinationForLoader } from "@/lib/auth-status.functions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/corridas")({
  loader: async () => {
    const dest = await resolveDestinationForLoader();
    const canAccess = dest.isPassageiro === true && dest.redirectTo === "/" && !dest.isAdmin && !dest.isMotorista;
    
    if (!canAccess) {
      throw redirect({ to: (dest.redirectTo || "/auth/login") as any });
    }
  },
  component: HistoricoCorridas,
});

function HistoricoCorridas() {
  const getHistoricoFn = useServerFn(getHistoricoCorridas);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const { data: corridas, isLoading, error } = useQuery({
    queryKey: ["historico-corridas"],
    queryFn: () => getHistoricoFn(),
    enabled: isHydrated,
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      solicitada: "Procurando motorista",
      aceita: "Motorista a caminho",
      motorista_chegou: "Motorista no local",
      em_andamento: "Em curso",
      concluida: "Concluída",
      cancelada: "Cancelada",
      sem_motorista: "Não encontrada",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    if (status === "concluida") return "text-green-400";
    if (status === "cancelada" || status === "sem_motorista") return "text-red-400";
    return "text-zuvvi-volt";
  };

  return (
    <div className="min-h-screen bg-zuvvi-indigo-dark text-foreground flex flex-col pb-10">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zuvvi-indigo/90 backdrop-blur-xl border-b border-white/10 px-5 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link 
            to="/" 
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 transition-colors hover:bg-white/10"
          >
            <ChevronLeft className="w-6 h-6 text-zuvvi-volt" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Minhas Corridas</h1>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-5 py-6 space-y-4">
        {isLoading || !isHydrated ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-zuvvi-volt animate-spin" />
            <p className="text-sm font-medium opacity-60">Carregando suas corridas...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 text-red-400">
            <p className="text-sm font-medium">Erro ao carregar histórico.</p>
          </div>
        ) : !corridas || corridas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-60">
            <Clock className="w-12 h-12 text-muted-foreground" />
            <p className="text-sm font-medium">Você ainda não fez nenhuma corrida.</p>
          </div>
        ) : (
          (corridas as any[]).map((corrida: any) => (
            <div 
              key={corrida.id}
              className="bg-zuvvi-indigo/40 border border-white/5 rounded-3xl p-5 space-y-4 transition-all hover:bg-zuvvi-indigo/60"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(corrida.created_at), "dd 'de' MMMM, HH:mm", { locale: ptBR })}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${getStatusColor(corrida.status)}`}>
                  {getStatusLabel(corrida.status)}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-5 flex flex-col items-center pt-1 shrink-0">
                    <div className="w-2 h-2 rounded-full bg-zuvvi-volt/40" />
                    <div className="w-[1px] h-4 bg-white/10 my-1" />
                    <div className="w-2 h-2 rounded-full bg-zuvvi-volt" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Destino</p>
                    <p className="text-sm font-bold truncate">{corrida.destino_nome || "Destino não informado"}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest leading-none mb-1">Pagamento</p>
                      <p className="text-[11px] font-bold uppercase">{corrida.forma_pagamento}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest leading-none mb-1">Valor</p>
                    <p className="text-lg font-black text-zuvvi-volt">
                      R$ {(corrida.valor_final || corrida.valor_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              {corrida.nome_motorista && (
                <div className="pt-3 border-t border-white/5 flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-zuvvi-volt/10 flex items-center justify-center">
                    <User className="w-3 h-3 text-zuvvi-volt" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Motorista: <span className="text-foreground font-bold">{corrida.nome_motorista}</span>
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </main>


    </div>
  );
}
