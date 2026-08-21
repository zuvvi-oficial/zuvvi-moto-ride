import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMapboxToken, getAcompanhamentoPassageiro } from "@/lib/user.functions";
import {
  carregarChat,
  enviarMensagemChat,
  marcarMensagensEntregues,
  marcarMensagensLidas,
  atualizarPresencaChat,
} from "@/lib/chat.functions";
import { supabase } from "@/integrations/supabase/client";
import { Bike, Loader2, ChevronLeft, User, Star, XCircle, MessageCircle } from "lucide-react";
import { z } from "zod";
import { MapView } from "@/components/MapView";
import { ChatConversation } from "@/components/chat/ChatConversation";
import { toast } from "sonner";

const searchSchema = z.object({
  rideId: z.string(),
});

export const Route = createFileRoute("/acompanhamento")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: AcompanhamentoCorrida,
});

interface ChatMensagem {
  id: string;
  clientMessageId: string;
  remetenteId: string;
  conteudo: string;
  createdAt: string;
  entregueAt: string | null;
  lidoAt: string | null;
}

interface ChatData {
  meuUsuarioId: string;
  interlocutor: {
    id: string;
    nome: string;
  };
  mensagens: ChatMensagem[];
  presenca: {
    ultimoVistoAt: string;
    digitandoAte: string | null;
  } | null;
  podeEnviar: boolean;
}

function AcompanhamentoCorrida() {
  const { rideId } = Route.useSearch();
  const navigate = useNavigate();
  const [corrida, setCorrida] = useState<{ status: string; origem_lat: number; origem_lng: number } | null>(null);
  const [motorista, setMotorista] = useState<{ id: string; nome: string; nota_media: number | null } | null>(null);
  const [veiculo, setVeiculo] = useState<{ placa: string; marca: string; modelo: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const hasHandledCancellation = useRef(false);
  const cancellationRedirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [cancellationNotice, setCancellationNotice] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // Estados do Chat
  const [chatOpen, setChatOpen] = useState(false);
  const chatOpenRef = useRef(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [chatSending, setChatSending] = useState(false);
  const digitandoRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getAcompanhamentoFn = useServerFn(getAcompanhamentoPassageiro);
  const getMapboxTokenFn = useServerFn(getMapboxToken);

  // Server Functions do Chat
  const carregarChatFn = useServerFn(carregarChat);
  const enviarMensagemFn = useServerFn(enviarMensagemChat);
  const marcarEntreguesFn = useServerFn(marcarMensagensEntregues);
  const marcarLidasFn = useServerFn(marcarMensagensLidas);
  const atualizarPresencaFn = useServerFn(atualizarPresencaChat);

  useEffect(() => {
    async function init() {
      try {
        const [data, token] = await Promise.all([
          getAcompanhamentoFn({ data: { rideId } }),
          getMapboxTokenFn()
        ]);
        
        setCorrida(data.ride);
        setMotorista(data.driver);
        setVeiculo(data.vehicle);
        setMapboxToken(token);

        if (!data.handoffAvailable) {
          toast.error("Acompanhamento ainda não disponível para esta corrida.");
          navigate({ to: "/" });
        }
      } catch {
        toast.error("Não foi possível carregar os dados do acompanhamento.");
        navigate({ to: "/" });
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [rideId, getAcompanhamentoFn, getMapboxTokenFn, navigate]);

  useEffect(() => {
    if (!rideId) return;

    const channel = supabase
      .channel(`acompanhamento-${rideId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "corridas",
          filter: `id=eq.${rideId}`,
        },
        (payload: { new: { status: string; cancelado_por?: string } }) => {
          if (
            payload.new?.status === "cancelada" &&
            !hasHandledCancellation.current
          ) {
            hasHandledCancellation.current = true;

            const isMotorista = payload.new?.cancelado_por === "motorista";
            setCancellationNotice({
              title: "Corrida cancelada",
              message: isMotorista
                ? "O motorista cancelou a corrida."
                : "Esta corrida foi cancelada.",
            });

            cancellationRedirectTimeoutRef.current = setTimeout(() => {
              void navigate({ to: "/" });
            }, 1800);
          } else if (payload.new?.status === "motorista_a_caminho") {
            setCorrida((current) =>
              current ? { ...current, status: "motorista_a_caminho" } : current,
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (cancellationRedirectTimeoutRef.current) {
        clearTimeout(cancellationRedirectTimeoutRef.current);
      }
    };
  }, [rideId, navigate]);

  const refreshChat = async () => {
    try {
      const data = await carregarChatFn({ data: { corridaId: rideId } });
      setChatData(data as ChatData);
      setChatError(null);

      // Após carregar, marcar como entregue e lida (server-side)
      await Promise.all([
        marcarEntreguesFn({ data: { corridaId: rideId } }),
        marcarLidasFn({ data: { corridaId: rideId } }),
      ]);
    } catch {
      setChatError("Não foi possível carregar o chat.");
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    chatOpenRef.current = chatOpen;

    if (chatOpen) {
      setChatLoading(true);
      refreshChat();

      // Heartbeat a cada 20 segundos
      const heartbeatInterval = setInterval(() => {
        atualizarPresencaFn({
          data: {
            corridaId: rideId,
            digitando: digitandoRef.current,
          },
        }).catch(() => {
          /* Falha silenciosa de presença */
        });
      }, 20000);

      // Subscrever Realtime do Chat
      const chatChannel = supabase
        .channel(`chat-passageiro-${rideId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chat_mensagens",
            filter: `corrida_id=eq.${rideId}`,
          },
          () => {
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
            debounceTimeoutRef.current = setTimeout(() => {
              if (chatOpenRef.current) refreshChat();
            }, 200);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chat_presenca",
            filter: `corrida_id=eq.${rideId}`,
          },
          () => {
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
            debounceTimeoutRef.current = setTimeout(() => {
              if (chatOpenRef.current) refreshChat();
            }, 200);
          }
        )
        .subscribe();

      // Presença inicial
      atualizarPresencaFn({
        data: {
          corridaId: rideId,
          digitando: false,
        },
      }).catch(() => {});

      return () => {
        clearInterval(heartbeatInterval);
        supabase.removeChannel(chatChannel);
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

        // Best effort: avisar que parou de digitar ao fechar
        atualizarPresencaFn({
          data: {
            corridaId: rideId,
            digitando: false,
          },
        }).catch(() => {});
      };
    }
    return undefined;
  }, [chatOpen, rideId, carregarChatFn, atualizarPresencaFn, refreshChat]);

  const handleEnviarMensagem = async (conteudo: string) => {
    setChatSending(true);
    try {
      const clientMessageId = crypto.randomUUID();
      await enviarMensagemFn({
        data: {
          corridaId: rideId,
          clientMessageId,
          conteudo,
        },
      });
      await refreshChat();
    } catch {
      setChatError("Erro ao enviar mensagem.");
      throw new Error("Erro ao enviar"); // ChatConversation manterá o draft
    } finally {
      setChatSending(false);
    }
  };

  const handleDigitandoChange = (digitando: boolean) => {
    digitandoRef.current = digitando;
    atualizarPresencaFn({
      data: {
        corridaId: rideId,
        digitando,
      },
    }).catch(() => {});
  };

  if (isLoading || !corrida) {
    return (
      <div className="min-h-[100dvh] bg-zuvvi-indigo flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-zuvvi-volt animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] bg-zuvvi-indigo overflow-hidden font-poppins">
      {/* Mapa */}
      <div className="absolute inset-0 z-0">
        {mapboxToken && (
          <MapView 
            center={{ lat: corrida.origem_lat, lng: corrida.origem_lng }} 
            token={mapboxToken} 
          />
        )}
      </div>

      {/* Overlay Superior */}
      <div className="relative z-10 p-6 flex items-center justify-between pointer-events-none">
        <button 
          onClick={() => navigate({ to: "/" })}
          className="w-12 h-12 bg-zuvvi-indigo/80 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/10 pointer-events-auto active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="bg-zuvvi-indigo/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 pointer-events-auto">
          <p className="text-[10px] text-zuvvi-volt font-black uppercase tracking-widest text-center">
            {corrida.status === "motorista_a_caminho" ? "Motorista a Caminho" : "Motorista Aceitou"}
          </p>
        </div>
        <div className="w-12" />
      </div>

      {/* Card do Motorista Real - Só exibe se houver motorista e veículo válidos */}
      {motorista && veiculo && (
        <div className="absolute bottom-0 left-0 right-0 p-6 z-10 pointer-events-none">
          <div className="max-w-md mx-auto bg-zuvvi-indigo/90 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-6 shadow-2xl pointer-events-auto animate-rise space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-zuvvi-volt/20 flex items-center justify-center border border-zuvvi-volt/30">
                  <User className="w-8 h-8 text-zuvvi-volt" />
                </div>
                <div>
                  <h3 className="text-white font-bold">{motorista.nome}</h3>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-zuvvi-volt fill-zuvvi-volt" />
                    <span className="text-xs text-zuvvi-volt font-bold">
                      {motorista.nota_media !== null
                        ? motorista.nota_media.toFixed(1)
                        : "Novo na Zuvvi"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Placa</p>
                <p className="text-sm font-black text-white">{veiculo.placa}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zuvvi-volt/10 flex items-center justify-center">
                  <Bike className="w-5 h-5 text-zuvvi-volt" />
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
                    Veículo
                  </p>
                  <p className="text-xs font-bold text-white">
                    {veiculo.marca} {veiculo.modelo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(true)}
                className="bg-zuvvi-volt/10 px-4 py-2 rounded-xl active:scale-95 transition-transform flex items-center gap-2 border border-zuvvi-volt/20 min-h-[44px]"
                aria-label="Chat com motorista"
              >
                <MessageCircle className="w-4 h-4 text-zuvvi-volt" />
                <p className="text-[10px] font-black text-zuvvi-volt uppercase tracking-tighter">
                  Chat
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aviso de Cancelamento */}
      {cancellationNotice && (
        <div className="absolute inset-0 z-[100] bg-zuvvi-indigo/95 backdrop-blur-md flex items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="max-w-xs w-full space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">{cancellationNotice.title}</h2>
              <p className="text-white/70 leading-relaxed">{cancellationNotice.message}</p>
            </div>
            <div className="pt-4 flex flex-col items-center gap-3">
              <Loader2 className="w-5 h-5 text-zuvvi-volt animate-spin" />
              <p className="text-[10px] text-zuvvi-volt font-black uppercase tracking-[0.2em]">
                Voltando para a tela inicial...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Componente de Chat */}
      <ChatConversation
        open={chatOpen}
        onOpenChange={setChatOpen}
        meuUsuarioId={chatData?.meuUsuarioId || ""}
        interlocutor={
          chatData?.interlocutor || {
            id: motorista?.id || "",
            nome: motorista?.nome || "Motorista",
          }
        }
        mensagens={chatData?.mensagens || []}
        presenca={chatData?.presenca || null}
        podeEnviar={chatData?.podeEnviar ?? false}
        loading={chatLoading}
        error={chatError}
        enviando={chatSending}
        onEnviar={handleEnviarMensagem}
        onDigitandoChange={handleDigitandoChange}
        onRetry={refreshChat}
      />

    </div>
  );
}
