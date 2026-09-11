import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Copy, Gift, Hourglass, Loader2, Share2, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { resolveDestinationForLoader } from "@/lib/auth-status.functions";
import { getProgramaIndicacao } from "@/lib/indicacoes.functions";

export const Route = createFileRoute("/convidar-amigos")({
  loader: async () => {
    const dest = await resolveDestinationForLoader();
    const ehPassageiro = dest.isPassageiro === true && dest.redirectTo === "/";
    const ehMotorista = dest.isMotorista === true && dest.redirectTo === "/home-motorista";
    const canAccess = !dest.isAdmin && (ehPassageiro || ehMotorista);

    if (!canAccess) {
      throw redirect({ to: (dest.redirectTo || "/auth/login") as any });
    }

    return { voltarPara: (ehMotorista ? "/perfil-motorista" : "/perfil") as "/perfil" | "/perfil-motorista" };
  },
  head: () => ({
    meta: [
      { title: "Convide amigos — Zuvvi" },
      {
        name: "description",
        content: "Compartilhe seu código e ganhe cupons de desconto quando seus amigos usarem o Zuvvi.",
      },
    ],
  }),
  component: ConvidarAmigos,
});

function formatarData(value: string) {
  return format(new Date(value), "dd 'de' MMM", { locale: ptBR });
}

function ConvidarAmigos() {
  const { voltarPara } = Route.useLoaderData();
  const getFn = useServerFn(getProgramaIndicacao);

  const { data, isLoading } = useQuery({
    queryKey: ["programa-indicacao"],
    queryFn: () => getFn(),
  });

  const codigo = data?.codigo ?? null;
  const mensagemCompartilhar = codigo
    ? `Baixe o Zuvvi e use meu código ${codigo} no cadastro pra ganhar um cupom de R$ 10 na sua primeira corrida!`
    : "";

  const handleCopiar = async () => {
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
      toast.success("Código copiado!");
    } catch {
      toast.error("Não foi possível copiar o código.");
    }
  };

  const handleCompartilhar = async () => {
    if (!codigo) return;
    if (navigator.share) {
      try {
        await navigator.share({ text: mensagemCompartilhar });
      } catch {
        // usuário cancelou o compartilhamento — não é um erro
      }
    } else {
      await handleCopiar();
    }
  };

  return (
    <div className="min-h-screen bg-zuvvi-indigo-dark text-foreground flex flex-col pb-10">
      <header className="sticky top-0 z-50 bg-zuvvi-indigo/90 backdrop-blur-xl border-b border-white/10 px-5 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link
            to={voltarPara}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 transition-colors hover:bg-white/10"
          >
            <ChevronLeft className="w-6 h-6 text-zuvvi-volt" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Convide amigos</h1>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-5 py-8 space-y-6 animate-rise">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-zuvvi-volt" />
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-gradient-to-br from-zuvvi-volt/15 to-zuvvi-volt/5 border border-zuvvi-volt/20 p-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-zuvvi-volt/15 border border-zuvvi-volt/30 flex items-center justify-center">
                <Gift className="w-7 h-7 text-zuvvi-volt" />
              </div>
              <div>
                <p className="font-bold text-lg">Ganhe R$ 10 por indicação</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Compartilhe seu código. Quando seu amigo se cadastrar e completar a primeira corrida, vocês dois ganham um cupom de R$ 10.
                </p>
              </div>

              {codigo ? (
                <div className="bg-zuvvi-indigo/60 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <span className="font-mono font-black text-xl tracking-[0.15em] text-white">{codigo}</span>
                  <button
                    onClick={handleCopiar}
                    aria-label="Copiar código"
                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 hover:bg-white/10 transition-colors"
                  >
                    <Copy className="w-4 h-4 text-zuvvi-volt" />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Seu código ainda está sendo gerado. Tente novamente em instantes.
                </p>
              )}

              {codigo && (
                <button
                  onClick={handleCompartilhar}
                  className="w-full bg-zuvvi-volt hover:bg-zuvvi-volt/90 text-zuvvi-indigo font-bold h-12 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <Share2 className="w-4 h-4" />
                  Compartilhar convite
                </button>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
                Suas indicações
              </p>

              {!data?.indicacoes || data.indicacoes.length === 0 ? (
                <div className="text-center py-10 space-y-2 bg-zuvvi-indigo/40 border border-white/5 rounded-2xl">
                  <p className="text-sm text-muted-foreground">
                    Você ainda não indicou ninguém. Compartilhe seu código pra começar.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.indicacoes.map((i) => {
                    const concluida = i.status === "concluida";
                    return (
                      <div
                        key={i.id}
                        className="bg-zuvvi-indigo/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                              concluida
                                ? "bg-emerald-500/10 border-emerald-500/20"
                                : "bg-white/5 border-white/10"
                            }`}
                          >
                            {concluida ? (
                              <UserCheck className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <Hourglass className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{i.nome}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Cadastro em {formatarData(i.createdAt)}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border shrink-0 ${
                            concluida
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : "bg-white/5 text-muted-foreground border-white/10"
                          }`}
                        >
                          {concluida ? "Cupom liberado" : "Aguardando 1ª corrida"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
