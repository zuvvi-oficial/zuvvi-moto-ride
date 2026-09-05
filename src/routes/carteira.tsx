import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getResumoCarteira } from "@/lib/carteira.functions";
import { ChevronLeft, Wallet, Banknote, QrCode, Receipt, Loader2 } from "lucide-react";
import { resolveDestinationForLoader } from "@/lib/auth-status.functions";

export const Route = createFileRoute("/carteira")({
  loader: async () => {
    const dest = await resolveDestinationForLoader();
    const canAccess = dest.isPassageiro === true && dest.redirectTo === "/" && !dest.isAdmin && !dest.isMotorista;

    if (!canAccess) {
      throw redirect({ to: (dest.redirectTo || "/auth/login") as any });
    }
  },
  component: Carteira,
});

function formatarMoeda(valor: number) {
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function Carteira() {
  const getResumoFn = useServerFn(getResumoCarteira);

  const { data: resumo, isLoading, error } = useQuery({
    queryKey: ["resumo-carteira"],
    queryFn: () => getResumoFn(),
  });

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
          <h1 className="text-xl font-bold tracking-tight">Carteira</h1>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-5 py-6 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-zuvvi-volt animate-spin" />
            <p className="text-sm font-medium opacity-60">Carregando sua carteira...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 text-red-400">
            <p className="text-sm font-medium">Erro ao carregar resumo da carteira.</p>
          </div>
        ) : (
          <>
            {/* Card principal: total gasto no mês */}
            <div className="bg-zuvvi-indigo/40 border border-white/5 rounded-3xl p-6 space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <Wallet className="w-3 h-3" />
                Gasto no mês atual
              </div>
              <p className="text-3xl font-black text-zuvvi-volt">
                {formatarMoeda(resumo?.totalGastoMes || 0)}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <Receipt className="w-3.5 h-3.5" />
                {resumo?.quantidadeCorridas || 0} corrida{(resumo?.quantidadeCorridas || 0) !== 1 ? "s" : ""} concluída{(resumo?.quantidadeCorridas || 0) !== 1 ? "s" : ""}
              </div>
            </div>

            {/* Cards: dinheiro vs. pix */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zuvvi-indigo/40 border border-white/5 rounded-3xl p-5 space-y-3">
                <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <Banknote className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest leading-none mb-1">Dinheiro</p>
                  <p className="text-lg font-black">{formatarMoeda(resumo?.totalDinheiro || 0)}</p>
                </div>
              </div>

              <div className="bg-zuvvi-indigo/40 border border-white/5 rounded-3xl p-5 space-y-3">
                <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <QrCode className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest leading-none mb-1">Pix</p>
                  <p className="text-lg font-black">{formatarMoeda(resumo?.totalPix || 0)}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
