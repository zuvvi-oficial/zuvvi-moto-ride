import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bike, CheckCircle2, ChevronLeft, Clock, Loader2, LogOut, User } from "lucide-react";
import { useState } from "react";
import MercadoPagoConnect from "@/components/motorista/MercadoPagoConnect";
import { supabase } from "@/integrations/supabase/client";
import { resolveDestinationForLoader } from "@/lib/auth-status.functions";
import { getMotoristaStatusHome } from "@/lib/motorista-status.functions";

export const Route = createFileRoute("/perfil-motorista")({
  loader: async () => {
    const dest = await resolveDestinationForLoader();
    if (dest.redirectTo !== "/home-motorista") {
      throw redirect({ to: dest.redirectTo });
    }
    return {};
  },
  component: PerfilMotorista,
});

function PerfilMotorista() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const {
    data: status,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["motorista-status"],
    queryFn: () => getMotoristaStatusHome(),
    refetchOnWindowFocus: true,
  });

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      window.location.href = "/auth/login";
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-zuvvi-indigo text-white font-poppins flex flex-col">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-zuvvi-indigo/95 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-md items-center gap-4 px-5">
          <Link
            to="/home-motorista"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 transition-colors hover:bg-white/10"
            aria-label="Voltar para corrida"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zuvvi-volt">
              Motorista Zuvvi
            </p>
            <h1 className="text-lg font-black">Perfil</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-7 px-5 py-7 pb-32">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6">
          {isLoading ? (
            <div className="flex min-h-28 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-zuvvi-volt" />
            </div>
          ) : error || !status ? (
            <div className="py-4 text-center">
              <p className="font-bold">Não foi possível carregar seu perfil.</p>
              <p className="mt-1 text-xs text-white/50">
                Volte para a tela de corrida e tente novamente.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-zuvvi-volt/20 bg-zuvvi-volt/10">
                <User className="h-8 w-8 text-zuvvi-volt" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                  Minha conta
                </p>
                <h2 className="truncate text-xl font-black">{status.nome || "Motorista Zuvvi"}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {status.status_aprovacao === "aprovado" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-zuvvi-volt/20 bg-zuvvi-volt/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-zuvvi-volt">
                      <CheckCircle2 className="h-3 w-3" />
                      Aprovado
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white/60">
                    {status.is_disponivel ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="px-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zuvvi-volt">
              Recebimentos
            </p>
            <h2 className="mt-1 text-lg font-black">Mercado Pago</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              Gerencie aqui a conta usada para receber pagamentos Pix das corridas.
            </p>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
            <MercadoPagoConnect />
          </div>
        </section>

        <section className="space-y-3">
          <div className="px-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
              Conta e segurança
            </p>
            <h2 className="mt-1 text-lg font-black">Sessão</h2>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex min-h-16 w-full items-center justify-between rounded-2xl border border-red-500/15 bg-red-500/[0.06] px-5 text-left transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10">
                {isLoggingOut ? (
                  <Loader2 className="h-5 w-5 animate-spin text-red-400" />
                ) : (
                  <LogOut className="h-5 w-5 text-red-400" />
                )}
              </div>
              <div>
                <p className="font-black text-red-400">Sair da conta</p>
                <p className="text-[11px] text-red-300/45">Encerrar sessão neste dispositivo</p>
              </div>
            </div>
          </button>
        </section>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/5 bg-zuvvi-indigo/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto grid w-full max-w-md grid-cols-3 rounded-[2rem] border border-white/10 bg-white/[0.025] px-4 py-3">
          <Link
            to="/home-motorista"
            className="flex flex-col items-center gap-1 text-muted-foreground transition-colors hover:text-white"
          >
            <Bike className="h-6 w-6" />
            <span className="text-[8px] font-black uppercase tracking-widest">Corrida</span>
          </Link>
          <button
            type="button"
            disabled
            className="flex flex-col items-center gap-1 text-muted-foreground opacity-50"
          >
            <Clock className="h-6 w-6" />
            <span className="text-[8px] font-black uppercase tracking-widest">Ganhos</span>
          </button>
          <div className="flex flex-col items-center gap-1 text-zuvvi-volt" aria-current="page">
            <User className="h-6 w-6" />
            <span className="text-[8px] font-black uppercase tracking-widest">Perfil</span>
          </div>
        </div>
      </nav>
    </div>
  );
}
