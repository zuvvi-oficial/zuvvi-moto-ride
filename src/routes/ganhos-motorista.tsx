import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getResumoGanhos } from "@/lib/ganhos.functions";
import { Wallet, Banknote, QrCode, Receipt, Loader2, Bike, User, Clock } from "lucide-react";
import { resolveDestinationForLoader } from "@/lib/auth-status.functions";

export const Route = createFileRoute("/ganhos-motorista")({
  loader: async () => {
    const dest = await resolveDestinationForLoader();
    const canAccess =
      dest.isMotorista === true && dest.redirectTo === "/home-motorista" && !dest.isAdmin;

    if (!canAccess) {
      throw redirect({ to: (dest.redirectTo || "/auth/login") as any });
    }
  },
  component: GanhosMotorista,
});

function formatarMoeda(valor: number) {
  return `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function GanhosMotorista() {
  const getResumoFn = useServerFn(getResumoGanhos);

  const { data: resumo, isLoading, error } = useQuery({
    queryKey: ["resumo-ganhos"],
    queryFn: () => getResumoFn(),
  });

  return (
    <div className="min-h-screen bg-zuvvi-indigo text-white flex flex-col pb-32 font-poppins">
      <header className="sticky top-0 z-50 bg-zuvvi-indigo/90 backdrop-blur-xl border-b border-white/10 px-5 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight">Ganhos</h1>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-5 py-6 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-zuvvi-volt animate-spin" />
            <p className="text-sm font-medium opacity-60">Carregando seus ganhos...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 text-red-400">
            <p className="text-sm font-medium">Erro ao carregar resumo de ganhos.</p>
          </div>
        ) : (
          <>
            {/* Card principal: total ganho no mês */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                <Wallet className="w-3 h-3" />
                Ganho no mês atual
              </div>
              <p className="text-3xl font-black text-zuvvi-volt">
                {formatarMoeda(resumo?.totalGanhoMes || 0)}
              </p>
              <div className="flex items-center gap-2 text-xs text-white/40 pt-1">
                <Receipt className="w-3.5 h-3.5" />
                {resumo?.quantidadeCorridas || 0} corrida
                {(resumo?.quantidadeCorridas || 0) !== 1 ? "s" : ""} paga
                {(resumo?.quantidadeCorridas || 0) !== 1 ? "s" : ""}
              </div>
            </div>

            {/* Cards: dinheiro vs. pix */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-3">
                <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <Banknote className="w-4 h-4 text-white/40" />
                </div>
                <div>
                  <p className="text-[9px] text-white/40 uppercase tracking-widest leading-none mb-1">
                    Dinheiro
                  </p>
                  <p className="text-lg font-black">{formatarMoeda(resumo?.totalDinheiro || 0)}</p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-3">
                <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <QrCode className="w-4 h-4 text-white/40" />
                </div>
                <div>
                  <p className="text-[9px] text-white/40 uppercase tracking-widest leading-none mb-1">
                    Pix
                  </p>
                  <p className="text-lg font-black">{formatarMoeda(resumo?.totalPix || 0)}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 p-6 z-50 pointer-events-none">
        <div className="max-w-md mx-auto bg-zuvvi-indigo/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-4 flex items-center justify-around pointer-events-auto shadow-2xl">
          <a
            href="/home-motorista"
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-white transition-colors"
          >
            <Bike className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase tracking-widest">Corrida</span>
          </a>
          <button className="flex flex-col items-center gap-1 text-zuvvi-volt">
            <Clock className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase tracking-widest">Ganhos</span>
          </button>
          <Link
            to="/perfil-motorista"
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-white transition-colors"
            aria-label="Abrir perfil do motorista"
          >
            <User className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase tracking-widest">Perfil</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
