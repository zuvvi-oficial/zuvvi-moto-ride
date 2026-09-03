import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  NotificationBell,
  type NotificationBellItem,
} from "@/components/NotificationBell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import mapboxgl from "mapbox-gl";
import { useSoundStore } from "@/hooks/use-sound";
import {
  User,
  Power,
  Navigation,
  Bike,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  MapPin,
  CircleDollarSign,
  Wallet,
  X,
  AlertTriangle,
  MessageCircle,
  Star,
  Send,
} from "lucide-react";
import { ChatConversation } from "@/components/chat/ChatConversation";
import {
  carregarChat,
  enviarMensagemChat,
  marcarMensagensEntregues,
  marcarMensagensLidas,
  atualizarPresencaChat,
} from "@/lib/chat.functions";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { criarAvaliacao } from "@/lib/avaliacoes.functions";
import { MapView } from "@/components/MapView";

import { getMapboxToken } from "@/lib/user.functions";
import {
  getMotoristaStatusHome,
  updateMotoristaDisponibilidade,
} from "@/lib/motorista-status.functions";
import {
  updateLocalizacaoMotorista,
  getOfertasDisponiveis,
  aceitarCorrida,
  recusarCorrida,
  cancelarCorridaMotorista,
  marcarMotoristaACaminho,
  marcarMotoristaChegou,
  iniciarCorrida,
  finalizarCorrida,
} from "@/lib/motorista.functions";

import { resolveDestinationForLoader } from "@/lib/auth-status.functions";

export const Route = createFileRoute("/home-motorista")({
  loader: async () => {
    const dest = await resolveDestinationForLoader();
    if (dest.redirectTo !== "/home-motorista") {
      throw redirect({ to: dest.redirectTo });
    }
    return {};
  },
  component: HomeMotorista,
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
  corridaId: string;
  meuUsuarioId: string;
  interlocutor: {
    id: string;
    nome: string;
  };
  status: string;
  podeEnviar: boolean;
  naoLidas: number;
  mensagens: ChatMensagem[];
  presenca: {
    ultimoVistoAt: string;
    digitandoAte: string | null;
  } | null;
}

function HomeMotorista() {
  const queryClient = useQueryClient();
  const [isToggling, setIsToggling] = useState(false);
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [processingRideId, setProcessingRideId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [codigoEmbarque, setCodigoEmbarque] = useState("");
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isPickupMapReady, setIsPickupMapReady] = useState(false);
  const [lastOfertasIds, setLastOfertasIds] = useState<Set<string>>(new Set());
  const playSound = useSoundStore((state: any) => state.play);
  const [showFinalizeConfirmation, setShowFinalizeConfirmation] = useState(false);
  const [pixFailureNotice, setPixFailureNotice] = useState<NotificationBellItem | null>(null);

  const handleImportantNotification = useCallback((notification: NotificationBellItem) => {
    if (
      notification.titulo === "Corrida cancelada" &&
      notification.mensagem.includes("pagamento Pix")
    ) {
      setPixFailureNotice(notification);
    }
  }, []);

  const acknowledgePixFailure = useCallback(async () => {
    if (!pixFailureNotice) return;

    const notificationId = pixFailureNotice.id;
    setPixFailureNotice(null);

    const { error: updateError } = await supabase
      .from("notificacoes" as any)
      .update({ lida: true } as any)
      .eq("id", notificationId);

    if (updateError) {
      toast.error("Não foi possível confirmar o aviso.");
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
  }, [pixFailureNotice, queryClient]);
  
  // Estado explícito para corrida finalizada
  const [completedRideNotice, setCompletedRideNotice] = useState<{
    id: string;
    valorEstimado: number;
    formaPagamento: string;
    destinoNome: string;
  } | null>(null);

  const [notaAvaliacao, setNotaAvaliacao] = useState<number>(0);
  const [comentarioAvaliacao, setComentarioAvaliacao] = useState("");
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);
  const [avaliacaoSucesso, setAvaliacaoSucesso] = useState(false);

  const pickupMapInstance = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const routeFittedRideRef = useRef<string | null>(null);
  const lastRouteCoordsRef = useRef<{ 
    driverLat: number; 
    driverLng: number; 
    targetLat: number; 
    targetLng: number; 
    phase: "pickup" | "destination";
  } | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const locationUpdateInFlightRef = useRef(false);
  const hasActiveRideRef = useRef(false);
  const isOnlineRef = useRef(false);
  const handleGpsErrorRef = useRef<(msg: string) => void>(() => {});

  const getOfertasFn = useServerFn(getOfertasDisponiveis);
  const aceitarCorridaFn = useServerFn(aceitarCorrida);
  const recusarCorridaFn = useServerFn(recusarCorrida);
  const cancelarCorridaFn = useServerFn(cancelarCorridaMotorista);
  const marcarACaminhoFn = useServerFn(marcarMotoristaACaminho);
  const marcarChegouFn = useServerFn(marcarMotoristaChegou);
  const getMapboxTokenFn = useServerFn(getMapboxToken);
  const iniciarCorridaFn = useServerFn(iniciarCorrida);
  const finalizarCorridaFn = useServerFn(finalizarCorrida);
  const criarAvaliacaoFn = useServerFn(criarAvaliacao);

  const {
    data: status,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["motorista-status"],
    queryFn: () => getMotoristaStatusHome(),
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const activeRide = status?.active_ride ?? null;
  const isOnline = !!status?.is_disponivel;

  const carregarChatFn = useServerFn(carregarChat);
  const enviarMensagemFn = useServerFn(enviarMensagemChat);
  const marcarEntreguesFn = useServerFn(marcarMensagensEntregues);
  const marcarLidasFn = useServerFn(marcarMensagensLidas);
  const atualizarPresencaFn = useServerFn(atualizarPresencaChat);

  const [chatOpen, setChatOpen] = useState(false);
  const chatOpenRef = useRef(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [chatSending, setChatSending] = useState(false);
  const digitandoRef = useRef(false);
  const chatDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const activeChatRideIdRef = useRef<string | undefined>(undefined);
  const chatSessionRideIdRef = useRef<string | undefined>(undefined);
  const chatRefreshInFlightRef = useRef(false);
  const chatRefreshPendingRef = useRef(false);
  const chatClosedSyncInFlightRef = useRef(false);
  const chatClosedSyncPendingRef = useRef(false);



  const handleChatOpenChange = (open: boolean) => {
    if (open && !activeRide?.id) return;
    
    if (open && activeRide?.id) {
      chatSessionRideIdRef.current = activeRide.id;
      chatOpenRef.current = true;
      setChatOpen(true);
    } else {
      chatSessionRideIdRef.current = undefined;
      chatOpenRef.current = false;
      digitandoRef.current = false;
      setChatOpen(false);
    }
  };

  const refreshChat = useCallback(async () => {
    if (!activeRide?.id) return;
    const currentRideId = activeRide.id;

    if (chatSessionRideIdRef.current !== currentRideId) return;
    
    if (chatRefreshInFlightRef.current) {
      chatRefreshPendingRef.current = true;
      return;
    }

    chatRefreshInFlightRef.current = true;
    try {
      do {
        chatRefreshPendingRef.current = false;

        const inicial = await carregarChatFn({ data: { corridaId: currentRideId } });
        if (activeChatRideIdRef.current !== currentRideId) break;
        setChatData(inicial as ChatData);
        setChatUnreadCount((inicial as ChatData).naoLidas ?? 0);

        await marcarEntreguesFn({ data: { corridaId: currentRideId } });
        if (activeChatRideIdRef.current !== currentRideId) break;
        
        await marcarLidasFn({ data: { corridaId: currentRideId } });
        if (activeChatRideIdRef.current !== currentRideId) break;

        const atualizado = await carregarChatFn({ data: { corridaId: currentRideId } });
        if (activeChatRideIdRef.current !== currentRideId) break;
        
        setChatData(atualizado as ChatData);
        setChatUnreadCount((atualizado as ChatData).naoLidas ?? 0);
        setChatError(null);
      } while (
        chatRefreshPendingRef.current &&
        chatOpenRef.current === true &&
        chatSessionRideIdRef.current === currentRideId &&
        activeChatRideIdRef.current === currentRideId
      );

    } catch {
      if (activeChatRideIdRef.current === currentRideId) {
        setChatError("Não foi possível carregar o chat.");
      }
    } finally {
      chatRefreshInFlightRef.current = false;
      if (activeChatRideIdRef.current !== currentRideId) {
        chatRefreshPendingRef.current = false;
      }
      if (activeChatRideIdRef.current === currentRideId) {
        setChatLoading(false);
      }
    }
  }, [activeRide?.id, carregarChatFn, marcarEntreguesFn, marcarLidasFn]);

  const syncChatFechado = useCallback(async () => {
    if (!activeRide?.id) return;
    const currentRideId = activeRide.id;

    if (chatOpenRef.current === true) return;
    if (activeChatRideIdRef.current !== currentRideId) return;

    if (chatClosedSyncInFlightRef.current) {
      chatClosedSyncPendingRef.current = true;
      return;
    }

    chatClosedSyncInFlightRef.current = true;
    try {
      do {
        chatClosedSyncPendingRef.current = false;

        await marcarEntreguesFn({ data: { corridaId: currentRideId } });
        if (activeChatRideIdRef.current !== currentRideId) break;

        const resultado = await carregarChatFn({ data: { corridaId: currentRideId } });
        if (activeChatRideIdRef.current !== currentRideId) break;

        if (activeChatRideIdRef.current === currentRideId && chatOpenRef.current === false) {
          setChatUnreadCount((resultado as ChatData).naoLidas ?? 0);
        }
      } while (
        chatClosedSyncPendingRef.current &&
        chatOpenRef.current === false &&
        activeChatRideIdRef.current === currentRideId
      );
    } catch {
      // Silently fail for background sync
    } finally {
      chatClosedSyncInFlightRef.current = false;
      if (activeChatRideIdRef.current !== currentRideId) {
        chatClosedSyncPendingRef.current = false;
      }
    }
  }, [activeRide?.id, carregarChatFn, marcarEntreguesFn]);

  useEffect(() => {
    activeChatRideIdRef.current = activeRide?.id;
    chatSessionRideIdRef.current = undefined;
    chatOpenRef.current = false;
    digitandoRef.current = false;
    setChatOpen(false);
    setChatData(null);
    setChatUnreadCount(0);
    setChatError(null);
    setChatLoading(false);
    setChatSending(false);
    chatClosedSyncInFlightRef.current = false;
    chatClosedSyncPendingRef.current = false;
  }, [activeRide?.id]);


  useEffect(() => {
    const corridaId = activeRide?.id;
    if (!corridaId) return;

    let cancelled = false;
    let chatChannel: ReturnType<typeof supabase.channel> | null = null;

    const startRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
        if (cancelled) return;
      }

      chatChannel = supabase
        .channel(`chat-motorista-${corridaId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chat_mensagens",
            filter: `corrida_id=eq.${corridaId}`,
          },
          (payload) => {
            if (chatOpenRef.current) {
              if (chatDebounceRef.current) clearTimeout(chatDebounceRef.current);
              chatDebounceRef.current = setTimeout(() => {
                if (cancelled) return;
                void refreshChat();
              }, 200);
            } else if (payload.eventType === "INSERT") {
              void syncChatFechado();
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chat_presenca",
            filter: `corrida_id=eq.${corridaId}`,
          },
          () => {
            if (!chatOpenRef.current || cancelled) return;

            if (chatDebounceRef.current) clearTimeout(chatDebounceRef.current);
            chatDebounceRef.current = setTimeout(() => {
              if (cancelled) return;
              void refreshChat();
            }, 200);
          },
        )

        .subscribe((status) => {
          if (status === "SUBSCRIBED" && !cancelled) {
            if (chatOpenRef.current) {
              void refreshChat();
            } else {
              void syncChatFechado();
            }
          }
        });
    };

    void startRealtime();

    return () => {
      cancelled = true;
      if (chatChannel) {
        void supabase.removeChannel(chatChannel);
      }
      if (chatDebounceRef.current) clearTimeout(chatDebounceRef.current);
    };
  }, [activeRide?.id, refreshChat, syncChatFechado]);

  useEffect(() => {
    const corridaId = activeRide?.id;
    if (!chatOpen || !corridaId || chatSessionRideIdRef.current !== corridaId) return;

    let cancelled = false;
    setChatLoading(true);

    const safetySyncInterval = setInterval(() => {
      if (
        !cancelled &&
        chatOpenRef.current === true &&
        chatSessionRideIdRef.current === corridaId &&
        activeChatRideIdRef.current === corridaId
      ) {
        void refreshChat();
      }
    }, 10000);

    void atualizarPresencaFn({
      data: {
        corridaId: corridaId,
        digitando: false,
      },
    }).catch(() => {});

    return () => {
      cancelled = true;
      clearInterval(safetySyncInterval);

      void atualizarPresencaFn({
        data: {
          corridaId: corridaId,
          digitando: false,
        },
      }).catch(() => {});
    };
  }, [chatOpen, activeRide?.id, atualizarPresencaFn, refreshChat]);


  useEffect(() => {
    const corridaId = activeRide?.id;
    if (!corridaId) return;

    let heartbeatTimer: NodeJS.Timeout | null = null;

    const runHeartbeat = async () => {
      if (document.visibilityState !== "visible") return;

      const isDigitando = 
        chatOpenRef.current && 
        chatSessionRideIdRef.current === corridaId;

      try {
        await atualizarPresencaFn({
          data: {
            corridaId,
            digitando: isDigitando ? digitandoRef.current : false
          }
        });
      } catch (err) {
        // Silently fail
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runHeartbeat();
        if (
          chatOpenRef.current &&
          chatSessionRideIdRef.current === corridaId &&
          activeChatRideIdRef.current === corridaId
        ) {
          void refreshChat();
        } else if (activeChatRideIdRef.current === corridaId) {
          void syncChatFechado();
        }

      } else {
        // Hidden: send digitando=false best effort
        void atualizarPresencaFn({
          data: {
            corridaId,
            digitando: false
          }
        }).catch(() => {});
      }
    };

    const handlePageShow = () => {
      if (document.visibilityState === "visible") {
        void runHeartbeat();
        if (
          chatOpenRef.current &&
          chatSessionRideIdRef.current === corridaId &&
          activeChatRideIdRef.current === corridaId
        ) {
          void refreshChat();
        } else if (activeChatRideIdRef.current === corridaId) {
          void syncChatFechado();
        }

      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);

    // Initial run
    void runHeartbeat();

    heartbeatTimer = setInterval(() => {
      void runHeartbeat();
    }, 20000);

    return () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [activeRide?.id, atualizarPresencaFn, refreshChat, syncChatFechado]);



  const handleEnviarMensagem = async (conteudo: string) => {
    if (!activeRide?.id || chatSessionRideIdRef.current !== activeRide.id || chatOpenRef.current !== true) {
      throw new Error("Chat não está disponível.");
    }
    
    setChatSending(true);
    try {
      const clientMessageId = crypto.randomUUID();
      await enviarMensagemFn({
        data: {
          corridaId: activeRide.id,
          clientMessageId,
          conteudo,
        },
      });
      await refreshChat();
    } catch {
      setChatError("Erro ao enviar mensagem.");
      throw new Error("Erro ao enviar");
    } finally {
      setChatSending(false);
    }
  };

  const handleDigitandoChange = (digitando: boolean) => {
    digitandoRef.current = digitando;
    if (activeRide?.id && chatSessionRideIdRef.current === activeRide.id && chatOpenRef.current === true) {
      void atualizarPresencaFn({
        data: {
          corridaId: activeRide.id,
          digitando,
        },
      }).catch(() => {});
    }
  };

  const { data: mapboxToken } = useQuery({
    queryKey: ["mapbox-token-motorista"],
    queryFn: () => getMapboxTokenFn(),
    enabled: Boolean(activeRide),
    staleTime: Infinity,
  });

  const { data: rawOfertas = [] } = useQuery({
    queryKey: ["motorista-ofertas"],
    queryFn: () => getOfertasFn(),
    enabled: isOnline && isGpsActive && !activeRide,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  // Lista visual segura: só exibe se ONLINE, GPS ativo e sem corrida ativa
  const ofertas = isOnline && isGpsActive && !activeRide ? rawOfertas : [];

  const dispararSequenciaAlerta = useCallback((oferta: any) => {
    // Alerta Zuvvi: som, vibração e voz começam juntos com a oferta na tela.
    if ("vibrate" in navigator) {
      navigator.vibrate([220, 90, 220]);
    }

    playSound("/sounds/zuvvi_volt_ping.mp3").catch((e: any) =>
      console.error("[HomeMotorista] Erro ao tocar sino:", e)
    );

    if (!("speechSynthesis" in window)) return;

    const valor = Number(oferta.valor_estimado) || 0;
    const valorTexto = valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    const destinoCompleto =
      typeof oferta.destino_nome === "string" ? oferta.destino_nome.trim() : "";
    const destinoFalado =
      destinoCompleto
        .split(",")
        .slice(0, 3)
        .join(",")
        .trim() || "destino informado no aplicativo";
    const frase = `Zuvvi. Nova corrida. Valor ${valorTexto}. Destino: ${destinoFalado}.`;

    const synth = window.speechSynthesis;
    // Uma oferta nova substitui qualquer locução antiga que ainda esteja na fila.
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(frase);
    utterance.lang = "pt-BR";
    utterance.rate = 1.15;
    utterance.pitch = 1.03;
    utterance.volume = 1;

    const vozesPtBr = synth
      .getVoices()
      .filter((voice) => voice.lang.toLowerCase().replace("_", "-") === "pt-br");
    const nomesPreferidos = [
      "francisca",
      "luciana",
      "maria",
      "google português do brasil",
      "female",
      "mulher",
    ];
    const vozPremium =
      nomesPreferidos
        .map((nome) =>
          vozesPtBr.find((voice) => voice.name.toLowerCase().includes(nome))
        )
        .find(Boolean) || vozesPtBr[0];

    if (vozPremium) utterance.voice = vozPremium;
    synth.speak(utterance);
  }, [playSound]);

  useEffect(() => {
    if (ofertas.length > 0) {
      const currentIds = new Set(ofertas.map((o: any) => o.id));
      const newOfertas = ofertas.filter((o: any) => !lastOfertasIds.has(o.id));
      
      if (newOfertas.length > 0) {
        // Dispara o alerta para a oferta mais relevante (primeira da lista)
        dispararSequenciaAlerta(newOfertas[0]);
      }
      
      setLastOfertasIds(currentIds);
    } else if (lastOfertasIds.size > 0) {
      setLastOfertasIds(new Set());
    }
  }, [ofertas, lastOfertasIds, dispararSequenciaAlerta]);


  const mutation = useMutation({
    mutationFn: (disponivel: boolean) => updateMotoristaDisponibilidade({ data: { disponivel } }),
    onSuccess: (data) => {
      queryClient.setQueryData(["motorista-status"], (old: any) => ({
        ...old,
        is_disponivel: data.is_disponivel,
      }));
      if (!data.is_disponivel) {
        queryClient.setQueryData(["motorista-ofertas"], []);
      }
      toast.success(data.is_disponivel ? "Você está Online" : "Você está Offline");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao mudar status");
    },
    onSettled: () => {
      setIsToggling(false);
    },
  });

  const handleAceitar = async (rideId: string) => {
    if (processingRideId) return;
    setProcessingRideId(rideId);
    try {
      await aceitarCorridaFn({ data: { rideId } });
      toast.success("Corrida aceita com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["motorista-ofertas"] });
      queryClient.invalidateQueries({ queryKey: ["motorista-status"] });
    } catch (err: any) {
      toast.error(err.message || "Falha ao aceitar corrida.");
      queryClient.invalidateQueries({ queryKey: ["motorista-ofertas"] });
    } finally {
      setProcessingRideId(null);
    }
  };

  const handleRecusar = async (rideId: string) => {
    if (processingRideId) return;
    setProcessingRideId(rideId);
    try {
      await recusarCorridaFn({ data: { rideId } });
      queryClient.invalidateQueries({ queryKey: ["motorista-ofertas"] });
    } catch (err: any) {
      toast.error(err.message || "Falha ao recusar corrida.");
    } finally {
      setProcessingRideId(null);
    }
  };

  const handleCancelarCorrida = async (rideId: string) => {
    if (processingRideId) return;

    setProcessingRideId(rideId);
    try {
      await cancelarCorridaFn({ data: { rideId } });
      toast.success("Corrida cancelada com sucesso.");
      setShowCancelModal(false);
      queryClient.invalidateQueries({ queryKey: ["motorista-status"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao cancelar corrida.");
    } finally {
      setProcessingRideId(null);
    }
  };

  const handleMarcarACaminho = async (rideId: string) => {
    if (processingRideId) return;
    setProcessingRideId(rideId);
    try {
      await marcarACaminhoFn({ data: { rideId } });
      toast.success("Deslocamento iniciado.");
      queryClient.invalidateQueries({ queryKey: ["motorista-status"] });
    } catch (err: any) {
      toast.error(err.message || "Não foi possível iniciar o deslocamento.");
    } finally {
      setProcessingRideId(null);
    }
  };

  const handleMarcarChegou = async (rideId: string) => {
    if (processingRideId) return;
    setProcessingRideId(rideId);
    try {
      await marcarChegouFn({ data: { rideId } });
      toast.success("Chegada confirmada.");
      queryClient.invalidateQueries({ queryKey: ["motorista-status"] });
    } catch (err: any) {
      toast.error(err.message || "Não foi possível confirmar a chegada.");
    } finally {
      setProcessingRideId(null);
    }
  };

  const handleIniciarCorrida = async (rideId: string) => {
    if (codigoEmbarque.length !== 4) return;
    
    if (processingRideId) return;
    setProcessingRideId(rideId);
    try {
      const result = await iniciarCorridaFn({ data: { rideId, codigo: codigoEmbarque } });
      if (result.success) {
        toast.success("Corrida iniciada!");
        setCodigoEmbarque("");
        queryClient.invalidateQueries({ queryKey: ["motorista-status"] });
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar corrida.");
      setCodigoEmbarque("");
    } finally {
      setProcessingRideId(null);
    }
  };

  const handleFinalizarCorrida = async (recebido?: boolean) => {
    if (!activeRide?.id || processingRideId) return;

    const rideData = {
      id: activeRide.id,
      valorEstimado: Number(activeRide.valor_estimado),
      formaPagamento: activeRide.forma_pagamento,
      destinoNome: activeRide.destino_nome || "Destino",
    };

    setProcessingRideId(activeRide.id);
    try {
      if (recebido === undefined) {
        await finalizarCorridaFn({ data: { rideId: activeRide.id } });
      } else {
        await finalizarCorridaFn({ data: { rideId: activeRide.id, recebido } });
      }

      setShowFinalizeConfirmation(false);
      setNotaAvaliacao(0);
      setComentarioAvaliacao("");
      setAvaliacaoSucesso(false);
      setCompletedRideNotice(rideData);
      setChatOpen(false);
      chatOpenRef.current = false;
      setChatData(null);
      setChatUnreadCount(0);

      void queryClient.invalidateQueries({ queryKey: ["motorista-status"] })
        .catch(err => console.error("Erro ao sincronizar status pós-finalização:", err));
    } catch (err: any) {
      toast.error(err.message || "Erro ao finalizar corrida.");
    } finally {
      setProcessingRideId(null);
    }
  };

  const updateLocationFn = useServerFn(updateLocalizacaoMotorista);

  const stopGps = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsGpsActive(false);
    setGpsError(null);
    lastUpdateRef.current = 0;
    locationUpdateInFlightRef.current = false;
  }, []);

  const handleGpsError = useCallback(
    (msg: string) => {
      stopGps();
      setGpsError(msg);
      toast.error(msg);
      // Fail-safe: colocar offline usando a ref para evitar dependência do estado volátil
      if (isOnlineRef.current) {
        mutation.mutate(false);
      }
    },
    [stopGps, mutation],
  );

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    handleGpsErrorRef.current = handleGpsError;
  }, [handleGpsError]);

  const shouldTrackLocation = isOnline || Boolean(activeRide);

  useEffect(() => {
    hasActiveRideRef.current = Boolean(activeRide);
  }, [activeRide]);

  // Efeito operacional do watchPosition
  useEffect(() => {
    if (shouldTrackLocation) {
      if (!navigator.geolocation) {
        handleGpsErrorRef.current("Seu navegador não suporta geolocalização.");
        return;
      }

      // Cria watchPosition SOMENTE se watchIdRef.current === null
      if (watchIdRef.current === null) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;

            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

            const now = Date.now();
            const isFirstUpdate = lastUpdateRef.current === 0;
            const isTimeElapsed = now - lastUpdateRef.current >= 10000;
            const canUpdate =
              (isFirstUpdate || isTimeElapsed) && !locationUpdateInFlightRef.current;

            if (canUpdate) {
              locationUpdateInFlightRef.current = true;
              try {
                await updateLocationFn({ data: { lat: latitude, lng: longitude } });
                setIsGpsActive(true);
                setGpsError(null);
                lastUpdateRef.current = now;
              } catch (err: any) {
                // Se falhar no servidor, mas estiver em corrida, mantém o watcher ativo
                if (hasActiveRideRef.current) {
                  setIsGpsActive(false);
                  setGpsError("Conexão instável. Tentando reconectar GPS...");
                } else {
                  handleGpsErrorRef.current(
                    "Não foi possível ativar sua localização. Permita o acesso ao GPS para ficar online.",
                  );
                }
              } finally {
                locationUpdateInFlightRef.current = false;
              }
            }
          },
          (err) => {
            let msg = "Erro ao obter localização.";
            if (err.code === err.PERMISSION_DENIED) {
              msg =
                "Não foi possível ativar sua localização. Permita o acesso ao GPS para ficar online.";
            }
            handleGpsErrorRef.current(msg);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
      }
    } else {
      // Se shouldTrackLocation for false, para o GPS
      stopGps();
    }
  }, [shouldTrackLocation, stopGps, updateLocationFn]);

  // Cleanup exclusivo de desmontagem (Incondicional)
  useEffect(() => {
    return () => {
      stopGps();
    };
  }, [stopGps]);

  const handleToggleOnline = () => {
    if (isToggling || activeRide) return;
    setIsToggling(true);
    mutation.mutate(!status?.is_disponivel);
  };

  // Implementação 3, 4, 5, 6 - Posição do Motorista e Rota
  useEffect(() => {
    const map = pickupMapInstance.current;
    if (!map || !activeRide || !mapboxToken || !status) return;

    const driverLat = status.ultima_lat;
    const driverLng = status.ultima_lng;
    
    const isTrip = activeRide.status === "em_andamento";
    const phase = isTrip ? "destination" : "pickup";
    
    const targetLat = isTrip ? activeRide.destino_lat : activeRide.origem_lat;
    const targetLng = isTrip ? activeRide.destino_lng : activeRide.origem_lng;

    const hasValidDriver = Number.isFinite(driverLat) && Number.isFinite(driverLng);
    const hasValidTarget = Number.isFinite(targetLat) && Number.isFinite(targetLng);

    // 3. Marcador do Motorista
    if (hasValidDriver) {
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = new mapboxgl.Marker({ color: "#6C3CE9" })
          .setLngLat([driverLng!, driverLat!])
          .addTo(map);
      } else {
        driverMarkerRef.current.setLngLat([driverLng!, driverLat!]);
      }
    }

    // 4 & 5. Rota Directions
    const routeStatuses = ["aceita", "motorista_a_caminho", "motorista_chegou", "em_andamento"];
    if (hasValidDriver && hasValidTarget && routeStatuses.includes(activeRide.status)) {
      const coordsChanged = !lastRouteCoordsRef.current || 
        lastRouteCoordsRef.current.driverLat !== driverLat || 
        lastRouteCoordsRef.current.driverLng !== driverLng || 
        lastRouteCoordsRef.current.targetLat !== targetLat || 
        lastRouteCoordsRef.current.targetLng !== targetLng ||
        lastRouteCoordsRef.current.phase !== phase;

      if (coordsChanged && isPickupMapReady) {
        if (routeAbortRef.current) {
          routeAbortRef.current.abort();
          routeAbortRef.current = null;
        }
        
        const controller = new AbortController();
        routeAbortRef.current = controller;

        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${driverLng},${driverLat};${targetLng},${targetLat}?geometries=geojson&overview=full&access_token=${mapboxToken}`;

        fetch(url, { signal: controller.signal })
          .then(res => res.json())
          .then(data => {
            if (controller.signal.aborted) return;
            
            if (data.code !== "Ok" || !data.routes?.[0]) {
              setRouteError("Rota temporariamente indisponível.");
              return;
            }
            setRouteError(null);
            const route = data.routes[0].geometry;
            const sourceId = "zuvvi-driver-pickup-route-source";
            const layerId = "zuvvi-driver-pickup-route-layer";

            const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
            if (source) {
              source.setData(route);
            } else {
              map.addSource(sourceId, {
                type: "geojson",
                data: route
              });
              map.addLayer({
                id: layerId,
                type: "line",
                source: sourceId,
                layout: { "line-join": "round", "line-cap": "round" },
                paint: { "line-color": "#C6FF3D", "line-width": 4, "line-opacity": 0.8 }
              });
            }

            // 6. Enquadramento fitBounds (baseado em status e ID)
            const fitKey = `${activeRide.id}:${activeRide.status === "em_andamento" ? "destination" : "pickup"}`;
            if (routeFittedRideRef.current !== fitKey) {
              const bounds = new mapboxgl.LngLatBounds();
              route.coordinates.forEach((coord: [number, number]) => bounds.extend(coord));
              map.fitBounds(bounds, { padding: 40, duration: 2000 });
              routeFittedRideRef.current = fitKey;
            }

            lastRouteCoordsRef.current = { driverLat: driverLat!, driverLng: driverLng!, targetLat: targetLat!, targetLng: targetLng!, phase };
            
            if (routeAbortRef.current === controller) {
              routeAbortRef.current = null;
            }
          })
          .catch(err => {
            if (err.name !== "AbortError") {
              setRouteError("Rota temporariamente indisponível.");
            }
          });
      }
    } else {
      // Limpar rota se status mudar para em_andamento ou coordenadas sumirem
      if (routeAbortRef.current) {
        routeAbortRef.current.abort();
        routeAbortRef.current = null;
      }
      
      const sourceId = "zuvvi-driver-pickup-route-source";
      const layerId = "zuvvi-driver-pickup-route-layer";
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      lastRouteCoordsRef.current = null;
      setRouteError(null);
    }
  }, [status?.ultima_lat, status?.ultima_lng, activeRide, mapboxToken, isPickupMapReady]);

  // 7. Cleanup
  useEffect(() => {
    return () => {
      if (routeAbortRef.current) routeAbortRef.current.abort();
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
      pickupMapInstance.current = null;
    };
  }, []);

  // Cleanup seguro quando activeRide deixa de existir
  useEffect(() => {
    if (!activeRide) {
      // 1. Abortar rota em andamento
      if (routeAbortRef.current) {
        routeAbortRef.current.abort();
        routeAbortRef.current = null;
      }
      // 2. Remover marcador com segurança
      if (driverMarkerRef.current) {
        try {
          driverMarkerRef.current.remove();
        } catch (e) {
          // Ignorar se já removido ou falhar
        }
        driverMarkerRef.current = null;
      }
      
      // 3. Resetar referências operacionais
      routeFittedRideRef.current = null;
      lastRouteCoordsRef.current = null;
      setRouteError(null);
      setIsPickupMapReady(false);
      
      // 4. IMPORTANTE: Não tentar acessar layers/sources aqui 
      // O componente MapView cuida do map.remove() que já limpa tudo.
      // Apenas anulamos a referência da instância.
      pickupMapInstance.current = null;
    }
  }, [activeRide]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zuvvi-indigo flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-zuvvi-volt animate-spin" />
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="min-h-screen bg-zuvvi-indigo flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-white font-bold mb-2">Erro ao carregar perfil</h1>
        <p className="text-white/60 text-sm mb-6">
          Não foi possível recuperar seus dados operacionais.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-white/10 text-white px-6 py-3 rounded-2xl font-bold uppercase text-[10px]"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const chatDataAtual = chatData?.corridaId === activeRide?.id ? chatData : null;
  const chatOpenAtual = chatOpen && chatSessionRideIdRef.current === activeRide?.id;
  const unreadCountDisplay = chatUnreadCount > 99 ? "99+" : chatUnreadCount.toString();
  const chatButtonAria = chatUnreadCount > 0 
    ? `Chat com passageiro, ${chatUnreadCount} mensagens não lidas`
    : "Chat com passageiro";



  return (
    <div className="min-h-screen bg-zuvvi-indigo text-white pb-32 font-poppins">
      <header
        className={`p-6 flex items-center justify-between border-b border-white/5 sticky top-0 z-50 backdrop-blur-xl ${isOnline || activeRide ? "bg-zuvvi-volt/5" : "bg-zuvvi-indigo/90"}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <User className="w-5 h-5 text-zuvvi-volt" />
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
              Motorista Zuvvi
            </p>
            <h1 className="text-sm font-bold uppercase">{status.nome?.split(" ")[0]}</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <NotificationBell onImportantNotification={handleImportantNotification} />
          {activeRide ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl border bg-zuvvi-volt border-zuvvi-volt text-zuvvi-indigo">
              <Bike className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">EM CORRIDA</span>
            </div>
          ) : (
            <button
              onClick={handleToggleOnline}
              disabled={isToggling}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all active:scale-95 ${isOnline ? "bg-zuvvi-volt border-zuvvi-volt text-zuvvi-indigo" : "bg-white/5 border-white/10 text-white"}`}
            >
              {isToggling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Power className="w-4 h-4" />
              )}
              <span className="text-[10px] font-black uppercase tracking-widest">
                {isOnline ? "ONLINE" : "OFFLINE"}
              </span>
            </button>
          )}
        </div>
      </header>

      <main className="p-6 max-w-md mx-auto">
        {activeRide ? (
          <div className="bg-white/5 border border-zuvvi-volt/30 rounded-[2rem] p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zuvvi-volt">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Corrida aceita
                </span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                <User className="w-3.5 h-3.5 text-white/60" />
                <span className="text-[11px] font-bold text-white tracking-tight">
                  {(activeRide as any).passageiro_nome}
                </span>
              </div>
            </div>

            {activeRide && mapboxToken && activeRide.origem_lat && activeRide.origem_lng ? (
              <div className="space-y-2">
                <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest">
                  {activeRide.status === "em_andamento" ? "Destino da Viagem" : "Local de Embarque"}
                </p>
                <div className="h-56 rounded-2xl overflow-hidden border border-white/5 relative">
                  <MapView
                    center={{
                      lat: Number(activeRide.origem_lat),
                      lng: Number(activeRide.origem_lng),
                    }}
                    token={mapboxToken}
                    zoom={15}
                    className="w-full h-full"
                    onMapInstance={(map) => {
                      pickupMapInstance.current = map;
                      setIsPickupMapReady(true);
                    }}
                  />
                  {(status?.ultima_lat === null || status?.ultima_lng === null) && !routeError && (
                    <div className="absolute inset-x-0 bottom-2 flex justify-center pointer-events-none">
                      <div className="bg-zuvvi-indigo/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
                        <p className="text-[9px] text-white/80 font-bold uppercase tracking-widest flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin text-zuvvi-volt" />
                          Obtendo sua posição para traçar a rota...
                        </p>
                      </div>
                    </div>
                  )}
                  {routeError && (
                    <div className="absolute inset-x-0 bottom-2 flex justify-center pointer-events-none">
                      <div className="bg-red-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-red-500/30">
                        <p className="text-[9px] text-white font-bold uppercase tracking-widest">
                          {routeError}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : activeRide && !mapboxToken ? (
              <div className="h-56 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                <p className="text-[10px] text-white/40 uppercase font-bold">
                  Mapa temporariamente indisponível.
                </p>
              </div>
            ) : null}

            <div className="flex gap-4">
              <div className="flex flex-col items-center gap-1 mt-1">
                <div className="w-2 h-2 rounded-full bg-zuvvi-volt" />
                <div className="w-0.5 h-8 bg-white/10" />
                <MapPin className="w-4 h-4 text-white/40" />
              </div>
              <div className="flex-1 space-y-4">
                <div className="space-y-0.5">
                  <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest">
                    Origem
                  </p>
                  <p className="text-sm font-medium">
                    {activeRide.origem_nome || "Local de embarque"}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest">
                    Destino
                  </p>
                  <p className="text-sm font-medium">
                    {activeRide.destino_nome || "Local de destino"}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-2xl p-3 flex items-center gap-3">
                <CircleDollarSign className="w-4 h-4 text-zuvvi-volt" />
                <div>
                  <p className="text-[8px] text-white/40 uppercase font-black tracking-tighter">
                    Valor
                  </p>
                  <p className="text-xs font-bold text-zuvvi-volt">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      Number(activeRide.valor_estimado),
                    )}
                  </p>
                </div>
              </div>
              <div className="bg-white/5 rounded-2xl p-3 flex items-center gap-3">
                <Wallet className="w-4 h-4 text-white/60" />
                <div>
                  <p className="text-[8px] text-white/40 uppercase font-black tracking-tighter">
                    Pagamento
                  </p>
                  <p className="text-xs font-bold uppercase tracking-tight truncate">
                    {activeRide.forma_pagamento}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-zuvvi-volt/10 border border-zuvvi-volt/20 rounded-2xl p-4 text-center">
              {activeRide.status === "aceita" ? (
                <button
                  onClick={() => handleMarcarACaminho(activeRide.id)}
                  disabled={!!processingRideId}
                  className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-zuvvi-volt disabled:opacity-50"
                >
                  {processingRideId === activeRide.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "A CAMINHO DO EMBARQUE"
                  )}
                </button>
              ) : activeRide.status === "motorista_a_caminho" ? (
                <button
                  onClick={() => handleMarcarChegou(activeRide.id)}
                  disabled={!!processingRideId}
                  className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-zuvvi-volt disabled:opacity-50"
                >
                  {processingRideId === activeRide.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "CHEGUEI NO LOCAL"
                  )}
                </button>
              ) : activeRide.status === "motorista_chegou" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zuvvi-volt">
                      DIGITE O CÓDIGO DE EMBARQUE
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={codigoEmbarque}
                      onChange={(e) => setCodigoEmbarque(e.target.value.replace(/\D/g, ""))}
                      placeholder="0000"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-center text-xl font-bold tracking-[0.5em] text-white focus:outline-none focus:border-zuvvi-volt/50 transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => handleIniciarCorrida(activeRide.id)}
                    disabled={!!processingRideId || codigoEmbarque.length !== 4}
                    className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-zuvvi-volt disabled:opacity-50"
                  >
                    {processingRideId === activeRide.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "INICIAR CORRIDA"
                    )}
                  </button>
                </div>
              ) : activeRide.status === "em_andamento" ? (
                <button
                  onClick={() => setShowFinalizeConfirmation(true)}
                  disabled={!!processingRideId}
                  className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-zuvvi-volt disabled:opacity-50"
                >
                  {processingRideId === activeRide.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "FINALIZAR CORRIDA"
                  )}
                </button>
              ) : (
                <p className="text-[10px] font-black uppercase tracking-widest text-zuvvi-volt">
                  Atualizando...
                </p>
              )}
            </div>

            <button
              onClick={() => handleChatOpenChange(true)}
              className="w-full py-4 rounded-2xl bg-zuvvi-volt/10 border border-zuvvi-volt/20 text-zuvvi-volt text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 min-h-[44px] relative"
              aria-label={chatButtonAria}
            >
              <MessageCircle className="w-4 h-4" />
              CHAT COM PASSAGEIRO
              {chatUnreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-zuvvi-volt text-zuvvi-indigo text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-zuvvi-indigo animate-in zoom-in duration-300">
                  {unreadCountDisplay}
                </span>
              )}
            </button>


            <button
              onClick={() => setShowCancelModal(true)}
              disabled={!!processingRideId}
              className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              CANCELAR CORRIDA
            </button>
          </div>
        ) : !isOnline ? (
          <div className="space-y-4 animate-in fade-in duration-700">
            <div className="py-20 text-center space-y-4">
              <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto border border-white/5">
                <Bike className="w-10 h-10 text-white/20" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white/40 uppercase">Você está offline</h2>
                <p className="text-xs text-white/20 uppercase tracking-widest">
                  Fique online para receber corridas
                </p>
              </div>
            </div>
          </div>

        ) : (
          <div className="space-y-4">
            {ofertas.length === 0 ? (
              <div className="py-20 text-center space-y-6 animate-pulse">
                <div className="relative w-32 h-32 mx-auto">
                  <div className="absolute inset-0 bg-zuvvi-volt/20 rounded-full animate-ping" />
                  <div className="relative z-10 w-full h-full bg-zuvvi-volt/10 rounded-full flex items-center justify-center border border-zuvvi-volt/20">
                    <Navigation className="w-10 h-10 text-zuvvi-volt" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-bold text-zuvvi-volt uppercase tracking-widest">
                    {isGpsActive ? "Aguardando corridas" : "ATIVANDO LOCALIZAÇÃO..."}
                  </h2>
                  <p className="text-xs text-muted-foreground uppercase">
                    {isGpsActive ? "LOCALIZAÇÃO ATIVA" : "Obtendo sinal de GPS"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {ofertas.map((oferta: any) => (
                  <div
                    key={oferta.id}
                    className="bg-white/5 border border-white/10 rounded-[2rem] p-6 space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-zuvvi-volt">
                        <Bike className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          Novo pedido de corrida
                        </span>
                      </div>
                      <span className="bg-zuvvi-volt/10 text-zuvvi-volt px-3 py-1 rounded-full text-[9px] font-bold">
                        {oferta.distancia_aprox_m >= 1000
                          ? `${(oferta.distancia_aprox_m / 1000).toFixed(1)}km`
                          : `${oferta.distancia_aprox_m}m`}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center gap-1 mt-1">
                          <div className="w-2 h-2 rounded-full bg-zuvvi-volt" />
                          <div className="w-0.5 h-8 bg-white/10" />
                          <MapPin className="w-4 h-4 text-white/40" />
                        </div>
                        <div className="flex-1 space-y-4">
                          <div className="space-y-0.5">
                            <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest">
                              Embarque
                            </p>
                            <p className="text-sm font-medium line-clamp-1">
                              {oferta.origem_nome || "Local de embarque"}
                            </p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest">
                              Destino
                            </p>
                            <p className="text-sm font-medium line-clamp-1">
                              {oferta.destino_nome || "Local de destino"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="bg-white/5 rounded-2xl p-3 flex items-center gap-3">
                          <CircleDollarSign className="w-4 h-4 text-zuvvi-volt" />
                          <div>
                            <p className="text-[8px] text-white/40 uppercase font-black tracking-tighter">
                              Valor
                            </p>
                            <p className="text-xs font-bold text-zuvvi-volt">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(Number(oferta.valor_estimado))}
                            </p>
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-3 flex items-center gap-3">
                          <Wallet className="w-4 h-4 text-white/60" />
                          <div>
                            <p className="text-[8px] text-white/40 uppercase font-black tracking-tighter">
                              Pagamento
                            </p>
                            <p className="text-xs font-bold uppercase tracking-tight truncate">
                              {oferta.forma_pagamento}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleRecusar(oferta.id)}
                        disabled={!!processingRideId}
                        className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        Recusar
                      </button>
                      <button
                        onClick={() => handleAceitar(oferta.id)}
                        disabled={!!processingRideId}
                        className="flex-[2] py-4 rounded-2xl bg-zuvvi-volt text-zuvvi-indigo text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {processingRideId === oferta.id && (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                        {processingRideId === oferta.id ? "Aceitando..." : "Aceitar Corrida"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {showFinalizeConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-zuvvi-indigo/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-zuvvi-indigo border border-white/10 rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-500 space-y-8">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-zuvvi-volt/10 rounded-full flex items-center justify-center border border-zuvvi-volt/20">
                <CheckCircle2 className="w-10 h-10 text-zuvvi-volt" />
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                {activeRide?.forma_pagamento === "dinheiro" ? (
                  <>
                    VOCÊ RECEBEU{" "}
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(Number(activeRide.valor_estimado))}{" "}
                    DO PASSAGEIRO?
                  </>
                ) : (
                  "FINALIZAR CORRIDA?"
                )}
              </h2>
              <p className="text-sm text-white/60">
                {activeRide?.forma_pagamento === "dinheiro"
                  ? "Confirme o recebimento antes de finalizar a corrida."
                  : "Confirme somente após chegar ao destino do passageiro."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {activeRide?.forma_pagamento === "dinheiro" ? (
                <>
                  <button
                    onClick={() => void handleFinalizarCorrida(false)}
                    disabled={!!processingRideId}
                    className="py-5 rounded-2xl bg-white/5 border border-white/10 text-white text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                  >
                    NÃO
                  </button>
                  <button
                    onClick={() => void handleFinalizarCorrida(true)}
                    disabled={!!processingRideId}
                    className="py-5 rounded-2xl bg-zuvvi-volt text-zuvvi-indigo text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {processingRideId === activeRide?.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "SIM"
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowFinalizeConfirmation(false)}
                    disabled={!!processingRideId}
                    className="py-5 rounded-2xl bg-white/5 border border-white/10 text-white text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                  >
                    VOLTAR
                  </button>
                  <button
                    onClick={() => void handleFinalizarCorrida()}
                    disabled={!!processingRideId}
                    className="py-5 rounded-2xl bg-zuvvi-volt text-zuvvi-indigo text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {processingRideId === activeRide?.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "SIM, FINALIZAR"
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}


      {pixFailureNotice && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-zuvvi-indigo/95 p-5 backdrop-blur-md animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pix-failure-driver-title"
        >
          <div className="w-full max-w-sm rounded-[2.25rem] border border-white/10 bg-zuvvi-indigo-dark p-7 text-center shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-zuvvi-volt/20 bg-zuvvi-volt/10">
              <AlertTriangle className="h-10 w-10 text-zuvvi-volt" />
            </div>

            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-zuvvi-volt">
              Corrida cancelada
            </p>
            <h2
              id="pix-failure-driver-title"
              className="mt-2 text-2xl font-black leading-tight text-white"
            >
              Pagamento Pix não concluído
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/65">
              O pagamento do passageiro não foi confirmado. A corrida foi cancelada automaticamente.
            </p>

            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-zuvvi-volt/20 bg-zuvvi-volt/10 p-4 text-left">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-zuvvi-volt" />
              <p className="text-xs font-semibold leading-relaxed text-white/80">
                Você continua online e disponível para receber novas solicitações.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void acknowledgePixFailure()}
              className="mt-7 min-h-14 w-full rounded-2xl bg-zuvvi-volt px-5 text-sm font-black uppercase tracking-[0.14em] text-zuvvi-indigo"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {completedRideNotice && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-zuvvi-indigo/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-zuvvi-indigo border border-white/10 rounded-[2.5rem] p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-500 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 rounded-[2rem] bg-zuvvi-volt/10 flex items-center justify-center border border-zuvvi-volt/20">
                <CheckCircle2 className="w-10 h-10 text-zuvvi-volt" />
              </div>
              
              <div className="space-y-1">
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                  CORRIDA FINALIZADA
                </h2>
                <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">
                  Resumo da Corrida
                </p>
              </div>

              <div className="w-full bg-white/5 rounded-3xl p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Valor</span>
                  <span className="text-lg font-black text-zuvvi-volt">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      completedRideNotice.valorEstimado
                    )}
                  </span>
                </div>
                
                <div className="h-px bg-white/5 w-full" />
                
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Tipo</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white">
                    {completedRideNotice.formaPagamento}
                  </span>
                </div>

                <div className="h-px bg-white/5 w-full" />

                <div className="space-y-0.5 text-left">
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Destino</span>
                  <p className="text-[9px] font-bold text-white line-clamp-1">{completedRideNotice.destinoNome}</p>
                </div>
              </div>

              {!avaliacaoSucesso ? (
                <div className="w-full bg-white/5 rounded-[2rem] p-5 space-y-4 border border-white/5">
                  <p className="text-[9px] font-black text-zuvvi-volt uppercase tracking-widest">Avaliar Passageiro</p>
                  
                  <div className="flex justify-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setNotaAvaliacao(star)}
                        className="p-1 transition-transform active:scale-90"
                      >
                        <Star 
                          className={`w-6 h-6 ${notaAvaliacao >= star ? "text-zuvvi-volt fill-zuvvi-volt" : "text-white/10"}`} 
                        />
                      </button>
                    ))}
                  </div>

                  <textarea
                    placeholder="Comentário opcional"
                    value={comentarioAvaliacao}
                    onChange={(e) => setComentarioAvaliacao(e.target.value)}
                    maxLength={500}
                    className="w-full bg-zuvvi-indigo border border-white/10 rounded-xl p-3 text-white text-[10px] placeholder:text-white/20 focus:outline-none focus:border-zuvvi-volt/50 transition-colors resize-none h-20"
                  />

                  <button
                    onClick={async () => {
                      if (notaAvaliacao === 0 || enviandoAvaliacao) return;
                      setEnviandoAvaliacao(true);
                      try {
                        await criarAvaliacaoFn({
                          data: {
                            rideId: completedRideNotice.id,
                            nota: notaAvaliacao,
                            comentario: comentarioAvaliacao || undefined,
                          },
                        });
                        setAvaliacaoSucesso(true);
                        toast.success("Avaliação enviada!");
                      } catch (err: any) {
                        toast.error(err.message || "Erro ao avaliar.");
                      } finally {
                        setEnviandoAvaliacao(false);
                      }
                    }}
                    disabled={notaAvaliacao === 0 || enviandoAvaliacao}
                    className="w-full py-3.5 rounded-xl bg-zuvvi-volt text-zuvvi-indigo text-[9px] font-black uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {enviandoAvaliacao ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    ENVIAR NOTA
                  </button>
                </div>
              ) : (
                <div className="w-full bg-zuvvi-volt/5 border border-zuvvi-volt/20 rounded-2xl p-4">
                  <p className="text-[10px] text-zuvvi-volt font-black uppercase tracking-widest leading-relaxed">
                    Obrigado por avaliar o passageiro!
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setCompletedRideNotice(null)}
              className="w-full py-4.5 rounded-2xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
            >
              VOLTAR À HOME
            </button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 p-6 z-50 pointer-events-none">
        <div className="max-w-md mx-auto bg-zuvvi-indigo/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-4 flex items-center justify-around pointer-events-auto shadow-2xl">
          <button className="flex flex-col items-center gap-1 text-zuvvi-volt">
            <Bike className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase tracking-widest">Corrida</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground opacity-50">
            <Clock className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase tracking-widest">Ganhos</span>
          </button>
          <a
            href="/perfil-motorista"
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-white transition-colors"
            aria-label="Abrir perfil do motorista"
          >
            <User className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase tracking-widest">Perfil</span>
          </a>
        </div>
      </nav>

      {showCancelModal && activeRide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zuvvi-indigo/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-zuvvi-indigo border border-white/10 rounded-[2.5rem] p-8 space-y-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-[2rem] bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white uppercase tracking-tight">
                  Cancelar Corrida?
                </h2>
                <p className="text-xs text-white/40 leading-relaxed">
                  O cancelamento frequente pode afetar sua nota e prioridade no recebimento de novas ofertas.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleCancelarCorrida(activeRide.id)}
                disabled={!!processingRideId}
                className="w-full py-5 rounded-2xl bg-red-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processingRideId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>CANCELANDO...</span>
                  </>
                ) : (
                  "CONFIRMAR CANCELAMENTO"
                )}
              </button>

              <button
                onClick={() => setShowCancelModal(false)}
                disabled={!!processingRideId}
                className="w-full py-5 rounded-2xl bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                VOLTAR PARA CORRIDA
              </button>
            </div>
          </div>
        </div>
      )}

      {activeRide && (
        <ChatConversation
          open={chatOpenAtual}
          onOpenChange={handleChatOpenChange}
          meuUsuarioId={chatDataAtual?.meuUsuarioId || ""}
          interlocutor={
            chatDataAtual?.interlocutor || {
              id: "",
              nome: "Passageiro",
            }
          }
          mensagens={chatDataAtual?.mensagens || []}
          presenca={chatDataAtual?.presenca || null}
          podeEnviar={chatDataAtual?.podeEnviar ?? false}
          loading={chatLoading}
          error={chatError}
          enviando={chatSending}
          onEnviar={handleEnviarMensagem}
          onDigitandoChange={handleDigitandoChange}
          onRetry={refreshChat}
        />
      )}
    </div>
  );
}
