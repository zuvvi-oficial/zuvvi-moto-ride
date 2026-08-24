import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Loader2,
  Lock,
  MessageSquare,
  Navigation,
  PlayCircle,
  RotateCcw,
  Send,
  User,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  fecharChamadoSuporte,
  getChamadoSuporteDetalhe,
  iniciarAtendimentoSuporte,
  reabrirChamadoSuporte,
  responderChamadoSuporte,
  resolverChamadoSuporte,
} from "@/lib/suporte.functions";

interface DetalheChamadoProps {
  chamado: any;
  isOpen: boolean;
  onClose: () => void;
}

type AdminAction =
  | { type: "iniciar" }
  | { type: "responder"; mensagem: string }
  | { type: "resolver"; mensagem: string }
  | { type: "reabrir" }
  | { type: "fechar" };

type Confirmacao = "resolver" | "fechar" | null;

const feedbackPorAcao: Record<AdminAction["type"], string> = {
  iniciar: "Atendimento iniciado com sucesso.",
  responder: "Resposta enviada com sucesso.",
  resolver: "Chamado resolvido com sucesso.",
  reabrir: "Chamado reaberto com sucesso.",
  fechar: "Chamado fechado com sucesso.",
};

export function DetalheChamado({
  chamado,
  isOpen,
  onClose,
}: DetalheChamadoProps) {
  const queryClient = useQueryClient();
  const chamadoId = chamado?.id as string | undefined;
  const [resposta, setResposta] = useState("");
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const detalheQuery = useQuery({
    queryKey: ["suporte-chamado", chamadoId],
    queryFn: () =>
      getChamadoSuporteDetalhe({
        data: { chamadoId: chamadoId as string },
      }),
    enabled: isOpen && Boolean(chamadoId),
  });

  useEffect(() => {
    setResposta("");
    setConfirmacao(null);
    setFeedback(null);
  }, [chamadoId, isOpen]);

  const actionMutation = useMutation({
    mutationFn: async (action: AdminAction) => {
      if (!chamadoId) throw new Error("Chamado inválido.");

      switch (action.type) {
        case "iniciar":
          return iniciarAtendimentoSuporte({ data: { chamadoId } });
        case "responder":
          return responderChamadoSuporte({
            data: { chamadoId, mensagem: action.mensagem },
          });
        case "resolver":
          return resolverChamadoSuporte({
            data: { chamadoId, mensagem: action.mensagem },
          });
        case "reabrir":
          return reabrirChamadoSuporte({ data: { chamadoId } });
        case "fechar":
          return fecharChamadoSuporte({ data: { chamadoId } });
      }
    },
    onSuccess: async (_result, action) => {
      setFeedback(feedbackPorAcao[action.type]);
      setConfirmacao(null);

      if (action.type === "responder" || action.type === "resolver") {
        setResposta("");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["suporte-chamados"] }),
        queryClient.invalidateQueries({
          queryKey: ["suporte-chamado", chamadoId],
        }),
      ]);
    },
  });

  if (!chamado) return null;

  const chamadoAtual = detalheQuery.data?.chamado ?? chamado;
  const mensagens = detalheQuery.data?.mensagens ?? [];
  const mensagemValida =
    resposta.trim().length >= 1 && resposta.trim().length <= 2000;
  const mutationError =
    actionMutation.error instanceof Error
      ? actionMutation.error.message
      : actionMutation.error
        ? "Não foi possível concluir a ação."
        : null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "aberto":
        return "text-amber-500 bg-amber-500/10";
      case "em_atendimento":
        return "text-blue-500 bg-blue-500/10";
      case "resolvido":
        return "text-green-500 bg-green-500/10";
      case "fechado":
        return "text-white/50 bg-white/5";
      default:
        return "text-white/50 bg-white/5";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "aberto":
        return "Aberto";
      case "em_atendimento":
        return "Em atendimento";
      case "resolvido":
        return "Resolvido";
      case "fechado":
        return "Fechado";
      default:
        return status;
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "duvida":
        return "Dúvida";
      case "reclamacao":
        return "Reclamação";
      case "sos":
        return "SOS";
      default:
        return tipo;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl bg-zuvvi-indigo border-white/10 p-0 h-[100dvh] overflow-y-auto"
      >
        <div className="sticky top-0 z-50 bg-zuvvi-indigo/90 backdrop-blur-md border-b border-white/10 px-4 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Voltar para a lista de chamados"
            className="p-2 -ml-2 text-white/70 hover:text-white transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="text-center flex-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-zuvvi-volt/70">
              Detalhes do Chamado
            </div>
            {chamadoAtual.protocolo && (
              <div className="text-sm font-bold text-white truncate px-4">
                #{chamadoAtual.protocolo}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes"
            className="p-2 -mr-2 text-white/70 hover:text-white transition-colors hidden sm:block"
          >
            <X size={20} />
          </button>
          <div className="w-10 sm:hidden" />
        </div>

        <div className="p-6 space-y-8 pb-[calc(3rem+env(safe-area-inset-bottom))]">
          <div className="flex flex-wrap gap-3">
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusColor(chamadoAtual.status)}`}
            >
              {getStatusLabel(chamadoAtual.status)}
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-white/70">
              {getTipoLabel(chamadoAtual.tipo)}
            </span>
            {chamadoAtual.tipo === "sos" && (
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500 text-white">
                EMERGÊNCIA
              </span>
            )}
          </div>

          <div className="space-y-4">
            {chamadoAtual.assunto && (
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">
                  Assunto
                </div>
                <h2 className="text-xl font-bold text-white">
                  {chamadoAtual.assunto}
                </h2>
              </div>
            )}

            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">
                Descrição
              </div>
              <p className="text-white/70 leading-relaxed whitespace-pre-wrap break-words">
                {chamadoAtual.descricao || "Descrição não informada."}
              </p>
            </div>

            <div className="flex items-center gap-2 text-white/40 text-xs">
              <Clock size={14} />
              <span>
                {format(
                  new Date(chamadoAtual.created_at),
                  "dd 'de' MMMM 'às' HH:mm",
                  { locale: ptBR },
                )}
              </span>
            </div>
          </div>

          {chamadoAtual.usuarios && (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zuvvi-volt/70">
                <User size={12} />
                <span>Solicitante</span>
              </div>
              <div>
                <div className="font-bold text-white">
                  {chamadoAtual.usuarios.nome}
                </div>
                <div className="text-xs text-white/50 break-all">
                  {chamadoAtual.usuarios.email || "E-mail não informado"}
                </div>
                <div className="text-xs text-white/50">
                  {chamadoAtual.usuarios.celular || "Celular não informado"}
                </div>
              </div>
            </div>
          )}

          {chamadoAtual.corridas && (
            <div className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
              <Navigation size={18} className="text-white/30" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/30">
                  Corrida
                </div>
                <div className="text-sm font-medium">
                  #{chamadoAtual.corridas.codigo_embarque}
                </div>
              </div>
            </div>
          )}

          <section className="space-y-4" aria-labelledby="historico-atendimento">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-zuvvi-volt" />
              <h2
                id="historico-atendimento"
                className="text-sm font-bold text-white"
              >
                Histórico do atendimento
              </h2>
            </div>

            {detalheQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-white/50 py-4">
                <Loader2 size={16} className="animate-spin" />
                Carregando histórico...
              </div>
            ) : detalheQuery.isError ? (
              <div
                role="alert"
                className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"
              >
                Não foi possível carregar o histórico. Feche a ficha e tente
                novamente.
              </div>
            ) : mensagens.length === 0 ? (
              <p className="text-sm text-white/40">
                Nenhuma resposta administrativa enviada.
              </p>
            ) : (
              <div className="space-y-3">
                {mensagens.map((mensagem) => (
                  <div
                    key={mensagem.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider">
                      <span
                        className={
                          mensagem.autor_admin_id
                            ? "text-zuvvi-volt"
                            : "text-blue-300"
                        }
                      >
                        {mensagem.autor_admin_id
                          ? "Equipe Zuvvi"
                          : "Passageiro"}
                      </span>
                      <span className="text-white/30">
                        {format(new Date(mensagem.created_at), "dd/MM/yy HH:mm")}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/75">
                      {mensagem.corpo}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 space-y-4"
            aria-labelledby="acoes-atendimento"
          >
            <h2
              id="acoes-atendimento"
              className="text-sm font-bold text-white"
            >
              Ações do atendimento
            </h2>

            {feedback && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-200"
              >
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                <span>{feedback}</span>
              </div>
            )}

            {mutationError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200"
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{mutationError}</span>
              </div>
            )}

            {chamadoAtual.status === "aberto" && (
              <Button
                type="button"
                onClick={() => actionMutation.mutate({ type: "iniciar" })}
                disabled={actionMutation.isPending || detalheQuery.isLoading}
                className="w-full min-h-12 bg-blue-600 text-white hover:bg-blue-500"
              >
                {actionMutation.isPending ? (
                  <Loader2 size={18} className="mr-2 animate-spin" />
                ) : (
                  <PlayCircle size={18} className="mr-2" />
                )}
                Iniciar atendimento
              </Button>
            )}

            {chamadoAtual.status === "em_atendimento" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="resposta-suporte"
                      className="text-xs font-bold text-white/70"
                    >
                      Resposta ao passageiro
                    </label>
                    <span className="text-[10px] text-white/35">
                      {resposta.length}/2000
                    </span>
                  </div>
                  <Textarea
                    id="resposta-suporte"
                    value={resposta}
                    onChange={(event) => {
                      setResposta(event.target.value.slice(0, 2000));
                      setFeedback(null);
                      setConfirmacao(null);
                      actionMutation.reset();
                    }}
                    maxLength={2000}
                    rows={5}
                    placeholder="Escreva uma orientação clara para o passageiro..."
                    disabled={actionMutation.isPending}
                    className="min-h-32 resize-y border-white/10 bg-white/[0.04] text-white placeholder:text-white/25"
                  />
                </div>

                {confirmacao === "resolver" ? (
                  <div className="space-y-3 rounded-xl border border-green-500/20 bg-green-500/10 p-4">
                    <p className="text-sm text-green-100">
                      Confirmar esta mensagem como resposta final e resolver o
                      chamado?
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setConfirmacao(null)}
                        disabled={actionMutation.isPending}
                        className="text-white/70"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        onClick={() =>
                          actionMutation.mutate({
                            type: "resolver",
                            mensagem: resposta,
                          })
                        }
                        disabled={!mensagemValida || actionMutation.isPending}
                        className="bg-green-600 text-white hover:bg-green-500"
                      >
                        {actionMutation.isPending && (
                          <Loader2 size={16} className="mr-2 animate-spin" />
                        )}
                        Confirmar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      type="button"
                      onClick={() =>
                        actionMutation.mutate({
                          type: "responder",
                          mensagem: resposta,
                        })
                      }
                      disabled={!mensagemValida || actionMutation.isPending}
                      className="min-h-12 bg-zuvvi-violet text-white hover:bg-zuvvi-violet/90"
                    >
                      {actionMutation.isPending ? (
                        <Loader2 size={18} className="mr-2 animate-spin" />
                      ) : (
                        <Send size={18} className="mr-2" />
                      )}
                      Enviar resposta
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmacao("resolver")}
                      disabled={!mensagemValida || actionMutation.isPending}
                      className="min-h-12 border-green-500/40 bg-green-500/10 text-green-200 hover:bg-green-500/20"
                    >
                      <CheckCircle2 size={18} className="mr-2" />
                      Resolver chamado
                    </Button>
                  </div>
                )}
              </div>
            )}

            {chamadoAtual.status === "resolvido" && (
              <div className="space-y-3">
                {confirmacao === "fechar" ? (
                  <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm text-white/75">
                      Fechar é a etapa final. Este chamado não poderá ser
                      reaberto depois.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setConfirmacao(null)}
                        disabled={actionMutation.isPending}
                        className="text-white/70"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        onClick={() =>
                          actionMutation.mutate({ type: "fechar" })
                        }
                        disabled={actionMutation.isPending}
                        className="bg-white/15 text-white hover:bg-white/20"
                      >
                        {actionMutation.isPending && (
                          <Loader2 size={16} className="mr-2 animate-spin" />
                        )}
                        Confirmar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      type="button"
                      onClick={() =>
                        actionMutation.mutate({ type: "reabrir" })
                      }
                      disabled={actionMutation.isPending}
                      className="min-h-12 bg-blue-600 text-white hover:bg-blue-500"
                    >
                      {actionMutation.isPending ? (
                        <Loader2 size={18} className="mr-2 animate-spin" />
                      ) : (
                        <RotateCcw size={18} className="mr-2" />
                      )}
                      Reabrir atendimento
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmacao("fechar")}
                      disabled={actionMutation.isPending}
                      className="min-h-12 border-white/15 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]"
                    >
                      <Lock size={18} className="mr-2" />
                      Fechar chamado
                    </Button>
                  </div>
                )}
              </div>
            )}

            {chamadoAtual.status === "fechado" && (
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
                <Lock size={18} className="mt-0.5 shrink-0" />
                <span>
                  Chamado encerrado. Nenhuma nova ação administrativa está
                  disponível.
                </span>
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
