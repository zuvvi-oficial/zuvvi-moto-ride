import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronLeft, LifeBuoy, Loader2, MessageSquare, Send, ShieldAlert, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { resolveDestinationForLoader } from "@/lib/auth-status.functions";
import {
  enviarMensagemPassageiro,
  getMeuChamadoDetalhe,
  getMeusChamados,
} from "@/lib/suporte-passageiro.functions";

export const Route = createFileRoute("/meus-chamados")({
  loader: async () => {
    const dest = await resolveDestinationForLoader();
    const canAccess =
      dest.isPassageiro === true && dest.redirectTo === "/" && !dest.isAdmin && !dest.isMotorista;

    if (!canAccess) {
      throw redirect({ to: (dest.redirectTo || "/auth/login") as any });
    }
  },
  head: () => ({
    meta: [
      { title: "Meus Chamados — Zuvvi" },
      {
        name: "description",
        content: "Acompanhe seus chamados de suporte na Zuvvi e converse com a nossa equipe.",
      },
      { property: "og:title", content: "Meus Chamados — Zuvvi" },
      {
        property: "og:description",
        content: "Acompanhe seus chamados de suporte na Zuvvi e converse com a nossa equipe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeusChamados,
});

const TIPO_LABEL: Record<string, string> = {
  duvida: "Dúvida",
  reclamacao: "Reclamação",
  sos: "SOS",
};

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  em_atendimento: "Em atendimento",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

const STATUS_STYLE: Record<string, string> = {
  aberto: "bg-zuvvi-volt/15 text-zuvvi-volt border-zuvvi-volt/30",
  em_atendimento: "bg-zuvvi-violet/20 text-zuvvi-violet border-zuvvi-violet/40",
  resolvido: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  fechado: "bg-white/5 text-muted-foreground border-white/10",
};

function formatarData(value: string) {
  return format(new Date(value), "dd 'de' MMM',' HH:mm", { locale: ptBR });
}

function MeusChamados() {
  const [chamadoAberto, setChamadoAberto] = useState<string | null>(null);
  const listarFn = useServerFn(getMeusChamados);

  const { data: chamados, isLoading } = useQuery({
    queryKey: ["meus-chamados"],
    queryFn: () => listarFn(),
  });

  if (chamadoAberto) {
    return <DetalheChamadoPassageiro chamadoId={chamadoAberto} onVoltar={() => setChamadoAberto(null)} />;
  }

  return (
    <div className="min-h-screen bg-zuvvi-indigo-dark text-foreground flex flex-col pb-10">
      <header className="sticky top-0 z-50 bg-zuvvi-indigo/90 backdrop-blur-xl border-b border-white/10 px-5 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link
            to="/perfil"
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 transition-colors hover:bg-white/10"
          >
            <ChevronLeft className="w-6 h-6 text-zuvvi-volt" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Meus Chamados</h1>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-5 py-8 space-y-4 animate-rise">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-zuvvi-volt" />
          </div>
        ) : !chamados || chamados.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-zuvvi-volt/10 border border-zuvvi-volt/20 flex items-center justify-center">
              <LifeBuoy className="w-8 h-8 text-zuvvi-volt" />
            </div>
            <div>
              <p className="font-bold">Nenhum chamado por aqui</p>
              <p className="text-sm text-muted-foreground mt-1">
                Quando você falar com o suporte, seus chamados aparecem nesta tela.
              </p>
            </div>
            <Link
              to="/perfil"
              className="inline-flex items-center gap-2 text-sm font-bold text-zuvvi-volt hover:underline"
            >
              Abrir um chamado
            </Link>
          </div>
        ) : (
          chamados.map((chamado: any) => {
            const isSos = chamado.tipo === "sos";
            return (
              <button
                key={chamado.id}
                onClick={() => setChamadoAberto(chamado.id)}
                className={`w-full text-left rounded-2xl p-5 border transition-all group ${
                  isSos
                    ? "bg-red-500/5 border-red-500/40 hover:bg-red-500/10"
                    : "bg-zuvvi-indigo/40 border-white/5 hover:bg-zuvvi-indigo/60"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isSos ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/40">
                        <ShieldAlert className="w-3.5 h-3.5" /> SOS
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-white/5 text-muted-foreground border border-white/10">
                        {TIPO_LABEL[chamado.tipo] ?? chamado.tipo}
                      </span>
                    )}
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border ${
                        STATUS_STYLE[chamado.status] ?? STATUS_STYLE["fechado"]
                      }`}
                    >
                      {STATUS_LABEL[chamado.status] ?? chamado.status}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-zuvvi-volt shrink-0" />
                </div>

                <p className="text-sm mt-3 line-clamp-2 text-foreground/90">{chamado.descricao}</p>
                <p className="text-[11px] text-muted-foreground mt-2">{formatarData(chamado.created_at)}</p>
              </button>
            );
          })
        )}
      </main>
    </div>
  );
}

function DetalheChamadoPassageiro({
  chamadoId,
  onVoltar,
}: {
  chamadoId: string;
  onVoltar: () => void;
}) {
  const queryClient = useQueryClient();
  const detalheFn = useServerFn(getMeuChamadoDetalhe);
  const enviarFn = useServerFn(enviarMensagemPassageiro);
  const [texto, setTexto] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["meu-chamado", chamadoId],
    queryFn: () => detalheFn({ data: { chamadoId } }),
  });

  const { mutate: enviar, isPending } = useMutation({
    mutationFn: (mensagem: string) => enviarFn({ data: { chamadoId, mensagem } }),
    onSuccess: () => {
      setTexto("");
      queryClient.invalidateQueries({ queryKey: ["meu-chamado", chamadoId] });
      queryClient.invalidateQueries({ queryKey: ["meus-chamados"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Não foi possível enviar sua mensagem.");
    },
  });

  const chamado = data?.chamado as any;
  const isSos = chamado?.tipo === "sos";
  const podeResponder = chamado?.status === "em_atendimento";

  return (
    <div className="min-h-screen bg-zuvvi-indigo-dark text-foreground flex flex-col">
      <header className="sticky top-0 z-50 bg-zuvvi-indigo/90 backdrop-blur-xl border-b border-white/10 px-5 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <button
            onClick={onVoltar}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 transition-colors hover:bg-white/10"
          >
            <ChevronLeft className="w-6 h-6 text-zuvvi-volt" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Chamado</h1>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-5 py-6 space-y-5">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-zuvvi-volt" />
          </div>
        ) : !chamado ? (
          <p className="text-center text-sm text-muted-foreground py-16">Chamado não encontrado.</p>
        ) : (
          <>
            <div
              className={`rounded-2xl p-5 border ${
                isSos ? "bg-red-500/5 border-red-500/40" : "bg-zuvvi-indigo/40 border-white/5"
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                {isSos ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/40">
                    <ShieldAlert className="w-3.5 h-3.5" /> SOS
                  </span>
                ) : (
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-white/5 text-muted-foreground border border-white/10">
                    {TIPO_LABEL[chamado.tipo] ?? chamado.tipo}
                  </span>
                )}
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border ${
                    STATUS_STYLE[chamado.status] ?? STATUS_STYLE["fechado"]
                  }`}
                >
                  {STATUS_LABEL[chamado.status] ?? chamado.status}
                </span>
              </div>
              <p className="text-sm mt-3 text-foreground/90 whitespace-pre-wrap">{chamado.descricao}</p>
              <p className="text-[11px] text-muted-foreground mt-2">
                Aberto em {formatarData(chamado.created_at)}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold">
                Conversa
              </p>

              {(data?.mensagens ?? []).length === 0 ? (
                <div className="rounded-2xl border border-white/5 bg-zuvvi-indigo/30 p-5 text-center">
                  <MessageSquare className="w-6 h-6 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">
                    Ainda não há mensagens neste chamado.
                  </p>
                </div>
              ) : (
                (data?.mensagens ?? []).map((mensagem: any) => {
                  const doPassageiro = !!mensagem.autor_usuario_id;
                  return (
                    <div
                      key={mensagem.id}
                      className={`flex ${doPassageiro ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 border ${
                          doPassageiro
                            ? "bg-zuvvi-violet/20 border-zuvvi-violet/40"
                            : "bg-zuvvi-indigo/50 border-white/10"
                        }`}
                      >
                        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                          {doPassageiro ? "Você" : "Equipe Zuvvi"}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{mensagem.corpo}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatarData(mensagem.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {podeResponder ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const mensagem = texto.trim();
                  if (!mensagem) {
                    toast.error("Escreva uma mensagem antes de enviar.");
                    return;
                  }
                  enviar(mensagem);
                }}
                className="sticky bottom-0 pt-2 pb-4 bg-zuvvi-indigo-dark"
              >
                <div className="flex items-end gap-2">
                  <textarea
                    value={texto}
                    onChange={(event) => setTexto(event.target.value)}
                    maxLength={2000}
                    rows={2}
                    placeholder="Escreva sua mensagem para a equipe..."
                    className="flex-1 resize-none rounded-2xl bg-zuvvi-indigo/50 border border-white/10 px-4 py-3 text-sm outline-none focus:border-zuvvi-volt/50"
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="h-12 w-12 shrink-0 rounded-2xl bg-zuvvi-volt text-zuvvi-indigo-dark flex items-center justify-center font-bold disabled:opacity-50"
                  >
                    {isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-[11px] text-center text-muted-foreground pb-4">
                {chamado.status === "aberto"
                  ? "Seu chamado está na fila. Assim que a equipe iniciar o atendimento você poderá responder aqui."
                  : "Este chamado não aceita novas mensagens."}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
