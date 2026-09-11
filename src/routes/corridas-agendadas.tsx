import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarMinhasCorridasAgendadas, cancelarCorridaAgendada } from "@/lib/corridas-agendadas.functions";
import { CalendarClock, MapPin, CreditCard, Loader2, X, ChevronLeft } from "lucide-react";
import { resolveDestinationForLoader } from "@/lib/auth-status.functions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PassengerBottomNav } from "@/components/passageiro/PassengerBottomNav";

export const Route = createFileRoute("/corridas-agendadas")({
  loader: async () => {
    const dest = await resolveDestinationForLoader();
    const canAccess = dest.isPassageiro === true && dest.redirectTo === "/" && !dest.isAdmin && !dest.isMotorista;

    if (!canAccess) {
      throw redirect({ to: (dest.redirectTo || "/auth/login") as any });
    }
  },
  component: MinhasCorridasAgendadas,
});

function MinhasCorridasAgendadas() {
  const listarFn = useServerFn(listarMinhasCorridasAgendadas);
  const cancelarFn = useServerFn(cancelarCorridaAgendada);
  const queryClient = useQueryClient();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const { data: agendamentos, isLoading, error } = useQuery({
    queryKey: ["corridas-agendadas"],
    queryFn: () => listarFn(),
    enabled: isHydrated,
  });

  const cancelarMutation = useMutation({
    mutationFn: (id: string) => cancelarFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corridas-agendadas"] });
      toast.success("Agendamento cancelado.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Não foi possível cancelar este agendamento.");
    },
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      agendada: "Agendada",
      convertida: "Solicitada",
      cancelada: "Cancelada",
      falhou: "Não foi possível agendar",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    if (status === "convertida") return "text-green-400";
    if (status === "cancelada" || status === "falhou") return "text-red-400";
    return "text-zuvvi-volt";
  };

  return (
    <div className="min-h-screen bg-zuvvi-indigo-dark text-foreground flex flex-col pb-28">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zuvvi-indigo/90 backdrop-blur-xl border-b border-white/10 px-5 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link
            to="/corridas"
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Corridas agendadas</h1>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-5 py-6 space-y-4">
        {isLoading || !isHydrated ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-zuvvi-volt animate-spin" />
            <p className="text-sm font-medium opacity-60">Carregando seus agendamentos...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 text-red-400">
            <p className="text-sm font-medium">Erro ao carregar agendamentos.</p>
          </div>
        ) : !agendamentos || agendamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-60">
            <CalendarClock className="w-12 h-12 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhuma corrida agendada ainda.</p>
            <p className="text-xs text-muted-foreground max-w-[240px]">
              Ao pedir uma corrida, escolha "Agendar" para marcar um horário futuro.
            </p>
          </div>
        ) : (
          agendamentos.map((agendamento) => (
            <div
              key={agendamento.id}
              className="bg-zuvvi-indigo/40 border border-white/5 rounded-3xl p-5 space-y-4"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <CalendarClock className="w-3 h-3" />
                  {format(new Date(agendamento.horarioAgendado), "dd 'de' MMMM, HH:mm", { locale: ptBR })}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${getStatusColor(agendamento.status)}`}>
                  {getStatusLabel(agendamento.status)}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-5 flex flex-col items-center pt-1 shrink-0">
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                    <div className="w-[1px] h-4 bg-white/10 my-1" />
                    <div className="w-2 h-2 rounded-full bg-zuvvi-volt" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-sm font-medium truncate opacity-60">
                      {agendamento.origemNome || "Origem"}
                    </p>
                    <p className="text-sm font-bold truncate">{agendamento.destinoNome || "Destino"}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest leading-none mb-1">Pagamento</p>
                      <p className="text-[11px] font-bold uppercase">{agendamento.formaPagamento}</p>
                    </div>
                  </div>

                  {agendamento.status === "agendada" && (
                    <button
                      onClick={() => cancelarMutation.mutate(agendamento.id)}
                      disabled={cancelarMutation.isPending}
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-400 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancelar
                    </button>
                  )}

                  {agendamento.status === "convertida" && agendamento.corridaId && (
                    <Link
                      to="/acompanhamento"
                      search={{ rideId: agendamento.corridaId }}
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-zuvvi-volt"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      Ver corrida
                    </Link>
                  )}
                </div>

                {agendamento.status === "falhou" && agendamento.motivoFalha && (
                  <p className="text-[10px] text-red-400/80 pt-2 border-t border-white/5">
                    {agendamento.motivoFalha}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </main>

      <PassengerBottomNav active="corridas" />
    </div>
  );
}
