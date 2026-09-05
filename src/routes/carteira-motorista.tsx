import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, Wallet, Calendar, Bike, Loader2 } from "lucide-react";
import { getCarteiraMotorista } from "@/lib/carteira-motorista.functions";
import { resolveDestinationForLoader } from "@/lib/auth-status.functions";

export const Route = createFileRoute("/carteira-motorista")({
  loader: async () => {
    const dest = await resolveDestinationForLoader();
    if (dest.redirectTo !== "/home-motorista") {
      throw redirect({ to: dest.redirectTo });
    }
    return {};
  },
  component: CarteiraMotorista,
});

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const FORMA_PAGAMENTO_LABEL: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
};

function CarteiraMotorista() {
  const getCarteiraFn = useServerFn(getCarteiraMotorista);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["carteira-motorista"],
    queryFn: () => getCarteiraFn(),
    enabled: isHydrated,
  });

  return (
    <div className="min-h-screen bg-zuvvi-indigo-dark text-foreground flex flex-col pb-10">
      <header className="sticky top-0 z-50 bg-zuvvi-indigo/90 backdrop-blur-xl border-b border-white/10 px-5 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link
            to="/home-motorista"
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 transition-colors hover:bg-white/10"
          >
            <ChevronLeft className="w-6 h-6 text-zuvvi-volt" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Carteira</h1>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-5 py-6 space-y-6">
        {isLoading || !isHydrated ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-zuvvi-volt animate-spin" />
            <p className="text-sm font-medium opacity-60">Carregando sua carteira...</p>
          </div>
        ) : error || !data ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 text-red-400">
            <p className="text-sm font-medium">Erro ao carregar a carteira.</p>
          </div>
        ) : (
          <>
            <div className="bg-zuvvi-volt/5 border border-zuvvi-volt/20 rounded-3xl p-6 space-y-1 text-center">
              <div className="flex justify-center">
                <div className="w-12 h-12 rounded-2xl bg-zuvvi-volt/10 flex items-center justify-center border border-zuvvi-volt/20 mb-2">
                  <Wallet className="w-6 h-6 text-zuvvi-volt" />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Total recebido</p>
              <p className="text-4xl font-black text-zuvvi-volt">R$ {formatarMoeda(data.resumo.total)}</p>
              <p className="text-[11px] text-muted-foreground">
                {data.resumo.totalCorridas} {data.resumo.totalCorridas === 1 ? "corrida paga" : "corridas pagas"}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zuvvi-indigo/40 border border-white/5 rounded-2xl p-4 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Hoje</p>
                <p className="text-base font-black text-white">R$ {formatarMoeda(data.resumo.hoje)}</p>
              </div>
              <div className="bg-zuvvi-indigo/40 border border-white/5 rounded-2xl p-4 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">7 dias</p>
                <p className="text-base font-black text-white">R$ {formatarMoeda(data.resumo.semana)}</p>
              </div>
              <div className="bg-zuvvi-indigo/40 border border-white/5 rounded-2xl p-4 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Mês</p>
                <p className="text-base font-black text-white">R$ {formatarMoeda(data.resumo.mes)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground px-1">
                Últimas corridas pagas
              </h2>

              {data.historico.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 opacity-60">
                  <Bike className="w-10 h-10 text-muted-foreground" />
                  <p className="text-sm font-medium">Nenhum ganho registrado ainda.</p>
                </div>
              ) : (
                data.historico.map((item) => (
                  <div
                    key={item.corridaId}
                    className="bg-zuvvi-indigo/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                        <Calendar className="w-3 h-3 shrink-0" />
                        {item.dataFinalizacao
                          ? format(new Date(item.dataFinalizacao), "dd 'de' MMMM, HH:mm", { locale: ptBR })
                          : "Data não disponível"}
                      </div>
                      <p className="text-sm font-bold truncate">{item.destinoNome || "Destino não informado"}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                        {FORMA_PAGAMENTO_LABEL[item.formaPagamento] || item.formaPagamento}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-black text-zuvvi-volt">R$ {formatarMoeda(item.valorMotorista)}</p>
                      <p className="text-[9px] text-muted-foreground">
                        de R$ {formatarMoeda(item.valorTotal)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
