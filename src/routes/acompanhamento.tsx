import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { useEffect, useState, useRef } from "react";
import { NotificationBell } from "@/components/NotificationBell";
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
import {
  Bike,
  Loader2,
  ChevronLeft,
  User,
  Star,
  XCircle,
  MessageCircle,
  Send,
  ShieldAlert,
  Share2,
  Heart,
  Maximize2,
  Minimize2,
  Clock,
  Locate,
} from "lucide-react";
import { z } from "zod";
import mapboxgl from "mapbox-gl";
import { MapView } from "@/components/MapView";
import { ChatConversation } from "@/components/chat/ChatConversation";
import { useChatAlert } from "@/hooks/use-chat-alert";
import { CompartilharViagemDialog } from "@/components/passageiro/CompartilharViagemDialog";
import { GorjetaDigital } from "@/components/passageiro/GorjetaDigital";
import { toast } from "sonner";
import { criarAvaliacao, getAvaliacaoStatus } from "@/lib/avaliacoes.functions";
import {
  listarMotoristasFavoritos,
  adicionarMotoristaFavorito,
  removerMotoristaFavorito,
} from "@/lib/motoristas-favoritos.functions";

const searchSchema = z.object({
  rideId: z.string(),
});

// Sequência de dasharray que, trocada quadro a quadro, cria a sensação de um
// traço "fluindo" ao longo da linha — mesma técnica do exemplo oficial do
// Mapbox GL JS ("Animate a line"), só aplicada na rota do passageiro.
const ROTA_DASH_SEQUENCE: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
];

// Direção (bearing, em graus, 0 = norte) entre dois pontos — usada pra girar
// o ícone de moto do motorista na direção real do deslocamento, já que o GPS
// bruto não traz heading, só lat/lng.
function calcularBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export const Route = createFileRoute("/acompanhamento")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: AcompanhamentoCorrida,
});

// Frases que o passageiro manda pro motorista sem digitar. Curtas de propósito:
// quem está esperando a moto resolve o embarque com um toque.
const RESPOSTAS_RAPIDAS_PASSAGEIRO = [
  "Já estou descendo",
  "Estou te esperando aqui",
  "Pode aguardar 2 minutos?",
  "Cheguei no ponto de encontro",
  "Obrigado!",
];

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
    fotoUrl?: string | null;
  };
  mensagens: ChatMensagem[];
  presenca: {
    ultimoVistoAt: string;
    digitandoAte: string | null;
  } | null;
  podeEnviar: boolean;
  naoLidas?: number;
}

function formatarTempoNaZuvvi(dataISO: string | null) {
  if (!dataISO) return "";

  const dataCriacao = new Date(dataISO);
  const hoje = new Date();

  // Diferença em milissegundos
  const diffMs = hoje.getTime() - dataCriacao.getTime();
  // Diferença em dias (arredondado para baixo)
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias === 0) return "Hoje";

  if (diffDias < 30) {
    return `há ${diffDias} ${diffDias === 1 ? "dia" : "dias"}`;
  }

  if (diffDias < 365) {
    const meses = Math.floor(diffDias / 30);
    const diasRestantes = diffDias % 30;

    let texto = `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
    if (diasRestantes > 0) {
      texto += ` e ${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"}`;
    }
    return texto;
  }

  const anos = Math.floor(diffDias / 365);
  const mesesRestantes = Math.floor((diffDias % 365) / 30);

  let texto = `há ${anos} ${anos === 1 ? "ano" : "anos"}`;
  if (mesesRestantes > 0) {
    texto += ` e ${mesesRestantes} ${mesesRestantes === 1 ? "mês" : "meses"}`;
  }
  return texto;
}

function AcompanhamentoCorrida() {
  const { rideId } = Route.useSearch();
  const navigate = useNavigate();
  const [corrida, setCorrida] = useState<{
    status: string;
    origem_lat: number;
    origem_lng: number;
    destino_lat?: number | null;
    destino_lng?: number | null;
    codigo_embarque?: string | null;
  } | null>(null);
  const [rideSyncing, setRideSyncing] = useState(false);
  const syncCounterRef = useRef(0);

  const [motorista, setMotorista] = useState<{
    id?: string;
    nome: string;
    foto_url?: string | null;
    nota_media: number | null;
    ultima_lat: number | null;
    ultima_lng: number | null;
    total_corridas?: number;
    membro_desde?: string | null;
  } | null>(null);
  const [veiculo, setVeiculo] = useState<{
    placa: string;
    marca: string;
    modelo: string;
    cor?: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  // Só controla o tamanho de exibição do mapa (mini card <-> tela cheia) —
  // mesmo padrão já usado na tela do motorista. Não afeta nenhum dado, rota
  // ou rastreamento: é a mesma instância do MapView, só maior ou menor.
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const passageiroMapInstance = useRef<import("mapbox-gl").Map | null>(null);
  const [isPassageiroMapReady, setIsPassageiroMapReady] = useState(false);

  // Redimensiona a instância existente do mapa ao trocar de tamanho — a
  // mesma instância continua viva (sem recarregar do zero), só o container
  // muda de tamanho via CSS, então o Mapbox precisa recalcular as dimensões
  // do canvas depois que o novo tamanho é aplicado.
  useEffect(() => {
    const map = passageiroMapInstance.current;
    if (!map) return;
    const raf = requestAnimationFrame(() => map.resize());
    return () => cancelAnimationFrame(raf);
  }, [isMapFullscreen]);

  // Direção do ícone de moto do motorista — recalculada só quando ele se
  // move de fato (limiar ~3m), pra não "tremer" com o ruído normal do GPS
  // enquanto ele está parado.
  const [driverBearing, setDriverBearing] = useState(0);
  const previousDriverPosRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    const lat = motorista?.ultima_lat;
    const lng = motorista?.ultima_lng;
    if (lat == null || lng == null) return;

    const anterior = previousDriverPosRef.current;
    if (anterior) {
      const moveu =
        Math.abs(lat - anterior.lat) > 0.00003 || Math.abs(lng - anterior.lng) > 0.00003;
      if (moveu) {
        setDriverBearing(calcularBearing(anterior.lat, anterior.lng, lat, lng));
      }
    }
    previousDriverPosRef.current = { lat, lng };
  }, [motorista?.ultima_lat, motorista?.ultima_lng]);

  // Rota entre o motorista e o ponto de encontro — mesmo padrão (Directions
  // API + fitBounds) já usado e validado na tela do motorista. O alvo é o
  // embarque enquanto o motorista está a caminho/chegou, e passa a ser o
  // destino assim que a corrida está em andamento.
  const passageiroRouteAbortRef = useRef<AbortController | null>(null);
  const passageiroRouteFittedKeyRef = useRef<string | null>(null);
  const lastPassageiroRouteCoordsRef = useRef<{
    driverLat: number;
    driverLng: number;
    targetLat: number;
    targetLng: number;
  } | null>(null);
  // Loop de animação do traço "fluindo" da rota — roda por fora do ciclo do
  // React (requestAnimationFrame se auto-agenda), só cancelado quando a
  // camada da rota é removida ou o componente desmonta.
  const passageiroRotaDashFrameRef = useRef<number | null>(null);
  const passageiroRotaDashStepRef = useRef<number>(-1);
  const [routeError, setRouteError] = useState<string | null>(null);
  // Chip de ETA/distância no mapa — dado que a própria resposta da Directions
  // API já traz (duration/distance), só exibido enquanto a rota é válida.
  const [routeInfo, setRouteInfo] = useState<{ etaLabel: string; distanceLabel: string } | null>(
    null,
  );
  // Botão de recentralizar: só aparece depois que o usuário arrasta o mapa
  // manualmente (evento "dragstart", que só dispara em interação real —
  // nunca em flyTo/fitBounds programático). Guarda o último enquadramento
  // calculado pra poder voltar exatamente pra ele com um toque.
  const [mapPannedManually, setMapPannedManually] = useState(false);
  const lastRouteBoundsRef = useRef<mapboxgl.LngLatBounds | null>(null);
  // Espelho em ref do estado acima, pra ler o valor atual de dentro do
  // efeito de rota (que roda fora do ciclo de render, na resposta de um
  // fetch) sem precisar colocar mapPannedManually nas dependências dele.
  const mapPannedManuallyRef = useRef(false);
  useEffect(() => {
    mapPannedManuallyRef.current = mapPannedManually;
  }, [mapPannedManually]);
  // Câmera "seguindo" o motorista aos poucos: controla o intervalo mínimo
  // entre reenquadramentos automáticos pra não competir com o fitBounds
  // inicial nem ficar reajustando a cada leve tremor do GPS.
  const passageiroUltimoFitAtRef = useRef(0);

  useEffect(() => {
    const map = passageiroMapInstance.current;
    if (!map || !isPassageiroMapReady) return;
    const onDragStart = () => setMapPannedManually(true);
    map.on("dragstart", onDragStart);
    return () => {
      map.off("dragstart", onDragStart);
    };
  }, [isPassageiroMapReady]);

  const handleRecentralizarMapa = () => {
    const map = passageiroMapInstance.current;
    if (!map || !corrida) return;
    if (lastRouteBoundsRef.current) {
      map.fitBounds(lastRouteBoundsRef.current, { padding: 40, duration: 1000 });
    } else {
      map.flyTo({ center: [corrida.origem_lng, corrida.origem_lat], zoom: 15 });
    }
    setMapPannedManually(false);
  };

  useEffect(() => {
    const map = passageiroMapInstance.current;
    if (!map || !corrida || !mapboxToken || !isPassageiroMapReady) return;

    const driverLat = motorista?.ultima_lat ?? null;
    const driverLng = motorista?.ultima_lng ?? null;
    const routeStatuses = ["motorista_a_caminho", "motorista_chegou", "em_andamento"];

    const isTrip = corrida.status === "em_andamento";
    const targetLat = isTrip ? (corrida.destino_lat ?? null) : corrida.origem_lat;
    const targetLng = isTrip ? (corrida.destino_lng ?? null) : corrida.origem_lng;

    const hasValidDriver = Number.isFinite(driverLat) && Number.isFinite(driverLng);
    const hasValidTarget = Number.isFinite(targetLat) && Number.isFinite(targetLng);

    const sourceId = "zuvvi-passenger-route-source";
    const layerId = "zuvvi-passenger-route-layer";

    if (hasValidDriver && hasValidTarget && routeStatuses.includes(corrida.status)) {
      const coordsChanged =
        !lastPassageiroRouteCoordsRef.current ||
        lastPassageiroRouteCoordsRef.current.driverLat !== driverLat ||
        lastPassageiroRouteCoordsRef.current.driverLng !== driverLng ||
        lastPassageiroRouteCoordsRef.current.targetLat !== targetLat ||
        lastPassageiroRouteCoordsRef.current.targetLng !== targetLng;

      if (coordsChanged) {
        if (passageiroRouteAbortRef.current) {
          passageiroRouteAbortRef.current.abort();
          passageiroRouteAbortRef.current = null;
        }

        const controller = new AbortController();
        passageiroRouteAbortRef.current = controller;

        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${driverLng},${driverLat};${targetLng},${targetLat}?geometries=geojson&overview=full&access_token=${mapboxToken}`;

        fetch(url, { signal: controller.signal })
          .then((res) => res.json())
          .then((data) => {
            if (controller.signal.aborted) return;

            if (data.code !== "Ok" || !data.routes?.[0]) {
              setRouteError("Rota temporariamente indisponível.");
              setRouteInfo(null);
              return;
            }
            setRouteError(null);
            const route = data.routes[0].geometry;

            const duracaoSegundos: number = data.routes[0].duration ?? 0;
            const distanciaMetros: number = data.routes[0].distance ?? 0;
            const etaMin = Math.max(1, Math.round(duracaoSegundos / 60));
            const distanceLabel =
              distanciaMetros >= 1000
                ? `${(distanciaMetros / 1000).toFixed(1)} km`
                : `${Math.round(distanciaMetros)} m`;
            setRouteInfo({ etaLabel: `${etaMin} min`, distanceLabel });

            const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
            if (source) {
              source.setData(route);
            } else {
              // lineMetrics habilita o line-gradient abaixo — a rota fica
              // mais opaca perto do motorista (início das coordenadas) e vai
              // esmaecendo em direção ao ponto de encontro.
              map.addSource(sourceId, { type: "geojson", lineMetrics: true, data: route });
              map.addLayer({
                id: layerId,
                type: "line",
                source: sourceId,
                layout: { "line-join": "round", "line-cap": "round" },
                paint: {
                  "line-gradient": [
                    "interpolate",
                    ["linear"],
                    ["line-progress"],
                    0,
                    "rgba(198, 255, 61, 0.95)",
                    1,
                    "rgba(198, 255, 61, 0.15)",
                  ],
                  "line-width": 4,
                },
              });

              passageiroRotaDashStepRef.current = -1;
              const animarTracejado = (timestamp: number) => {
                if (!map.getLayer(layerId)) return;
                const passo = Math.floor((timestamp / 60) % ROTA_DASH_SEQUENCE.length);
                if (passo !== passageiroRotaDashStepRef.current) {
                  map.setPaintProperty(layerId, "line-dasharray", ROTA_DASH_SEQUENCE[passo]);
                  passageiroRotaDashStepRef.current = passo;
                }
                passageiroRotaDashFrameRef.current = requestAnimationFrame(animarTracejado);
              };
              passageiroRotaDashFrameRef.current = requestAnimationFrame(animarTracejado);
            }

            // Câmera "seguindo" o motorista: sempre reenquadra quando a fase
            // muda (embarque -> destino), e também acompanha aos poucos as
            // atualizações de posição — mas só a cada 8s (evita competir com
            // o pulso do GPS) e só se o usuário não tiver arrastado o mapa
            // manualmente (nesse caso, o botão de recentralizar assume).
            const fitKey = `${rideId}:${isTrip ? "destination" : "pickup"}`;
            const mudouDeFase = passageiroRouteFittedKeyRef.current !== fitKey;
            const passaramOitoSegundos = Date.now() - passageiroUltimoFitAtRef.current > 8000;
            if (mudouDeFase || (!mapPannedManuallyRef.current && passaramOitoSegundos)) {
              const bounds = new mapboxgl.LngLatBounds();
              route.coordinates.forEach((coord: [number, number]) => bounds.extend(coord));
              map.fitBounds(bounds, { padding: 40, duration: mudouDeFase ? 2000 : 1200 });
              passageiroRouteFittedKeyRef.current = fitKey;
              lastRouteBoundsRef.current = bounds;
              passageiroUltimoFitAtRef.current = Date.now();
              setMapPannedManually(false);
            }

            lastPassageiroRouteCoordsRef.current = {
              driverLat: driverLat!,
              driverLng: driverLng!,
              targetLat: targetLat!,
              targetLng: targetLng!,
            };

            if (passageiroRouteAbortRef.current === controller) {
              passageiroRouteAbortRef.current = null;
            }
          })
          .catch((err) => {
            if (err.name !== "AbortError") {
              setRouteError("Rota temporariamente indisponível.");
              setRouteInfo(null);
            }
          });
      }
    } else {
      if (passageiroRouteAbortRef.current) {
        passageiroRouteAbortRef.current.abort();
        passageiroRouteAbortRef.current = null;
      }
      if (passageiroRotaDashFrameRef.current) {
        cancelAnimationFrame(passageiroRotaDashFrameRef.current);
        passageiroRotaDashFrameRef.current = null;
      }
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      lastPassageiroRouteCoordsRef.current = null;
      setRouteError(null);
      setRouteInfo(null);
    }
  }, [
    corrida,
    motorista?.ultima_lat,
    motorista?.ultima_lng,
    mapboxToken,
    isPassageiroMapReady,
    rideId,
  ]);

  useEffect(() => {
    return () => {
      if (passageiroRouteAbortRef.current) passageiroRouteAbortRef.current.abort();
      if (passageiroRotaDashFrameRef.current) {
        cancelAnimationFrame(passageiroRotaDashFrameRef.current);
      }
    };
  }, []);

  const hasHandledCancellation = useRef(false);
  const cancellationRedirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [cancellationNotice, setCancellationNotice] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const [shareOpen, setShareOpen] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const chatOpenRef = useRef(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [chatSending, setChatSending] = useState(false);
  const digitandoRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const chatClosedSyncInFlightRef = useRef(false);
  const chatClosedSyncPendingRef = useRef(false);

  const getAcompanhamentoFn = useServerFn(getAcompanhamentoPassageiro);
  const getMapboxTokenFn = useServerFn(getMapboxToken);

  const {
    avaliar: avaliarAlertaChat,
    sincronizar: sincronizarAlertaChat,
    resetar: resetarAlertaChat,
  } = useChatAlert();

  const carregarChatFn = useServerFn(carregarChat);
  const enviarMensagemFn = useServerFn(enviarMensagemChat);
  const marcarEntreguesFn = useServerFn(marcarMensagensEntregues);
  const marcarLidasFn = useServerFn(marcarMensagensLidas);
  const atualizarPresencaFn = useServerFn(atualizarPresencaChat);
  const getAvaliacaoStatusFn = useServerFn(getAvaliacaoStatus);
  const criarAvaliacaoFn = useServerFn(criarAvaliacao);
  const listarMotoristasFavoritosFn = useServerFn(listarMotoristasFavoritos);
  const adicionarMotoristaFavoritoFn = useServerFn(adicionarMotoristaFavorito);
  const removerMotoristaFavoritoFn = useServerFn(removerMotoristaFavorito);

  const [jaAvaliado, setJaAvaliado] = useState<boolean | null>(null);
  const [checkingAvaliacao, setCheckingAvaliacao] = useState(false);
  const [notaAvaliacao, setNotaAvaliacao] = useState<number>(0);
  const [comentarioAvaliacao, setComentarioAvaliacao] = useState("");
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);
  const [avaliacaoSucesso, setAvaliacaoSucesso] = useState(false);
  const [ehFavorito, setEhFavorito] = useState<boolean | null>(null);
  const [alternandoFavorito, setAlternandoFavorito] = useState(false);

  const handleChatOpenChange = React.useCallback(
    (open: boolean) => {
      chatOpenRef.current = open;
      if (!open) {
        digitandoRef.current = false;
      } else {
        // Abriu a conversa: o que estava pendente passa a ser lido, não alertado.
        sincronizarAlertaChat(0);
      }
      setChatOpen(open);
    },
    [sincronizarAlertaChat],
  );

  // Corrida nova: a base volta a ser desconhecida, pra contagem da corrida
  // anterior não engolir o alerta nem uma pendência antiga alertar sozinha.
  useEffect(() => {
    resetarAlertaChat();
  }, [rideId, resetarAlertaChat]);

  const syncRide = React.useCallback(
    async (showLoading = false) => {
      const currentGen = ++syncCounterRef.current;
      if (showLoading) setRideSyncing(true);

      try {
        const data = await getAcompanhamentoFn({ data: { rideId } });

        // Proteção contra resposta antiga sobrescrevendo estado novo
        if (currentGen < syncCounterRef.current) return;

        if (data.ride) {
          setCorrida(data.ride);
          setMotorista(data.driver);
          setVeiculo(data.vehicle);
        }

        if (!data.handoffAvailable) {
          toast.error("Acompanhamento ainda não disponível para esta corrida.");
          void navigate({ to: "/" });
        }
      } catch (err) {
        if (currentGen < syncCounterRef.current) return;
        console.error("Erro ao sincronizar corrida:", err);
        toast.error("Erro ao atualizar dados da corrida.");
      } finally {
        if (currentGen === syncCounterRef.current) {
          if (showLoading) setRideSyncing(false);
          setIsLoading(false);
        }
      }
    },
    [rideId, getAcompanhamentoFn, navigate],
  );

  useEffect(() => {
    // Inicialização independente: falha do mapa não bloqueia a corrida
    void syncRide();

    async function loadMapToken() {
      try {
        const token = await getMapboxTokenFn();
        setMapboxToken(token);
      } catch (err) {
        console.error("Erro ao carregar token do Mapbox:", err);
        toast.error("Não foi possível carregar o mapa.");
      }
    }
    void loadMapToken();
  }, [syncRide, getMapboxTokenFn]);

  useEffect(() => {
    if (!rideId) return;

    let channel: any;

    async function setupRealtime() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }

      channel = supabase
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
            if (payload.new?.status === "cancelada" && !hasHandledCancellation.current) {
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
            } else if (
              payload.new?.status === "motorista_a_caminho" ||
              payload.new?.status === "motorista_chegou" ||
              payload.new?.status === "em_andamento" ||
              payload.new?.status === "concluida"
            ) {
              // Padrões diferentes por marco pra quem sente no bolso reconhecer
              // qual mudança aconteceu sem precisar olhar a tela.
              if ("vibrate" in navigator) {
                const padroesVibracao: Record<string, number[]> = {
                  motorista_a_caminho: [120],
                  motorista_chegou: [150, 80, 150],
                  em_andamento: [100],
                  concluida: [60, 40, 60, 40, 150],
                };
                navigator.vibrate(padroesVibracao[payload.new.status] || [100]);
              }

              if (payload.new?.status === "concluida") {
                void checkAvaliacaoStatus();
              }
              void syncRide().catch(() => {});
            }
          },
        )
        .subscribe();
    }

    void setupRealtime();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
      if (cancellationRedirectTimeoutRef.current) {
        clearTimeout(cancellationRedirectTimeoutRef.current);
      }
    };
  }, [rideId, navigate, syncRide]);

  // Bug 1 Fix: Inscrição do motorista em useEffect separado dependente do motorista.id
  useEffect(() => {
    if (!motorista?.id) return;

    let motoristaChannel: any;

    const setupMotoristaRealtime = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }

      motoristaChannel = supabase
        .channel(`motorista-posicao-${motorista.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "motoristas",
            filter: `id=eq.${motorista.id}`,
          },
          (payload: { new: { ultima_lat: number; ultima_lng: number } }) => {
            if (payload.new?.ultima_lat && payload.new?.ultima_lng) {
              setMotorista((prev) =>
                prev
                  ? {
                      ...prev,
                      ultima_lat: payload.new.ultima_lat,
                      ultima_lng: payload.new.ultima_lng,
                    }
                  : null,
              );
            }
          },
        )
        .subscribe();
    };

    void setupMotoristaRealtime();

    return () => {
      if (motoristaChannel) {
        void supabase.removeChannel(motoristaChannel);
      }
    };
  }, [motorista?.id]);

  const refreshChat = React.useCallback(async () => {
    try {
      const inicial = await carregarChatFn({ data: { corridaId: rideId } });
      setChatData(inicial as ChatData);

      // Melhor esforço: confirmar entrega/leitura nunca deve derrubar o
      // carregamento do chat — uma falha passageira aqui não pode
      // transformar uma conversa que já carregou com sucesso (a linha
      // acima) num "não foi possível carregar o chat".
      try {
        await marcarEntreguesFn({ data: { corridaId: rideId } });
        await marcarLidasFn({ data: { corridaId: rideId } });
      } catch {
        // Best effort
      }

      const atualizado = await carregarChatFn({ data: { corridaId: rideId } });
      const data = atualizado as ChatData;
      setChatData(data);
      setChatUnreadCount(data.naoLidas ?? 0);
      sincronizarAlertaChat(data.naoLidas ?? 0);
      setChatError(null);
    } catch {
      setChatError("Não foi possível carregar o chat.");
    } finally {
      setChatLoading(false);
    }
  }, [rideId, carregarChatFn, marcarEntreguesFn, marcarLidasFn, sincronizarAlertaChat]);

  const syncChatFechado = React.useCallback(async () => {
    if (!rideId || chatOpenRef.current) return;

    if (chatClosedSyncInFlightRef.current) {
      chatClosedSyncPendingRef.current = true;
      return;
    }

    chatClosedSyncInFlightRef.current = true;
    try {
      do {
        chatClosedSyncPendingRef.current = false;
        await marcarEntreguesFn({ data: { corridaId: rideId } });
        const res = await carregarChatFn({ data: { corridaId: rideId } });
        const data = res as ChatData;
        setChatUnreadCount(data.naoLidas ?? 0);

        const ultimaDoInterlocutor = [...(data.mensagens ?? [])]
          .reverse()
          .find((m) => m.remetenteId === data.interlocutor.id);

        avaliarAlertaChat({
          naoLidas: data.naoLidas ?? 0,
          remetenteNome: data.interlocutor.nome,
          previa: ultimaDoInterlocutor?.conteudo ?? null,
          onAbrir: () => handleChatOpenChange(true),
        });
      } while (chatClosedSyncPendingRef.current && !chatOpenRef.current);
    } catch {
      // Best effort
    } finally {
      chatClosedSyncInFlightRef.current = false;
    }
  }, [rideId, carregarChatFn, marcarEntreguesFn, avaliarAlertaChat, handleChatOpenChange]);

  // Reage na hora à mudança de status da corrida (ex.: aceita -> em_andamento),
  // que muda se pode enviar mensagem — sem isso, quem está com o chat aberto só
  // via essa mudança no próximo evento de chat ou troca de foco da aba.
  useEffect(() => {
    if (!rideId || !corrida?.status) return;

    if (chatOpenRef.current) {
      void refreshChat();
    } else {
      void syncChatFechado();
    }
  }, [rideId, corrida?.status, refreshChat, syncChatFechado]);

  // Carrega o chat assim que ele é aberto. Sem isso, "chatData" só era
  // populado por eventos que não têm relação com o ato de abrir a conversa
  // (mensagem nova, presença, mudança de status, troca de foco da aba) — até
  // um desses acontecer por coincidência, a tela mostrava "chat pausado" (o
  // mesmo texto usado quando a corrida realmente não permite mensagem), só
  // porque "chatData" ainda estava vazio, não porque o chat estivesse de fato
  // indisponível.
  useEffect(() => {
    if (!chatOpen || !rideId) return;
    void refreshChat();
  }, [chatOpen, rideId, refreshChat]);

  useEffect(() => {
    if (!rideId) return undefined;

    const atualizarPresenca = async (isDigitando: boolean) => {
      try {
        await atualizarPresencaFn({
          data: {
            corridaId: rideId,
            digitando: isDigitando,
          },
        });
      } catch (err) {
        // Best effort
      }
    };

    const heartbeat = () => {
      if (document.visibilityState === "visible") {
        void atualizarPresenca(chatOpenRef.current ? digitandoRef.current : false);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        heartbeat();
        if (chatOpenRef.current) {
          void refreshChat();
        } else {
          void syncChatFechado();
        }
      } else {
        void atualizarPresenca(false);
      }
    };

    const handlePageShow = () => {
      if (document.visibilityState === "visible") {
        heartbeat();
        if (chatOpenRef.current) {
          void refreshChat();
        } else {
          void syncChatFechado();
        }
      }
    };

    // Inicial imediato se visível
    if (document.visibilityState === "visible") {
      heartbeat();
    }

    const interval = setInterval(heartbeat, 20000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
      void atualizarPresenca(false);
    };
  }, [rideId, atualizarPresencaFn, refreshChat, syncChatFechado]);

  useEffect(() => {
    if (!rideId) return undefined;

    if (chatOpenRef.current === false && document.visibilityState === "visible") {
      void syncChatFechado();
    }

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
        (payload) => {
          if (chatOpenRef.current) {
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
            debounceTimeoutRef.current = setTimeout(() => {
              if (chatOpenRef.current) void refreshChat();
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
          filter: `corrida_id=eq.${rideId}`,
        },
        () => {
          if (chatOpenRef.current) {
            if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
            debounceTimeoutRef.current = setTimeout(() => {
              if (chatOpenRef.current) void refreshChat();
            }, 200);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(chatChannel);
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, [rideId, refreshChat, syncChatFechado]);

  const checkAvaliacaoStatus = React.useCallback(async () => {
    if (!rideId || jaAvaliado !== null || checkingAvaliacao) return;
    setCheckingAvaliacao(true);
    try {
      const res = await getAvaliacaoStatusFn({ data: { rideId } });
      setJaAvaliado(res.jaAvaliado);
    } catch (err) {
      console.error("Erro ao verificar status da avaliação:", err);
      setJaAvaliado(false); // Fallback: mostrar formulário
    } finally {
      setCheckingAvaliacao(false);
    }
  }, [rideId, getAvaliacaoStatusFn, jaAvaliado, checkingAvaliacao]);

  useEffect(() => {
    if (corrida?.status === "concluida" && jaAvaliado === null) {
      void checkAvaliacaoStatus();
    }
  }, [corrida?.status, jaAvaliado, checkAvaliacaoStatus]);

  const handleEnviarAvaliacao = async () => {
    if (notaAvaliacao === 0) return;
    setEnviandoAvaliacao(true);
    try {
      await criarAvaliacaoFn({
        data: {
          rideId,
          nota: notaAvaliacao,
          comentario: comentarioAvaliacao || undefined,
        },
      });
      setAvaliacaoSucesso(true);
      setJaAvaliado(true);
      toast.success("Obrigado pela sua avaliação!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar avaliação.");
    } finally {
      setEnviandoAvaliacao(false);
    }
  };

  const checkFavoritoStatus = React.useCallback(async () => {
    if (!motorista?.id || ehFavorito !== null) return;
    try {
      const favoritos = await listarMotoristasFavoritosFn();
      setEhFavorito(favoritos.some((f) => f.motoristaId === motorista.id));
    } catch (err) {
      console.error("Erro ao verificar status de favorito:", err);
      setEhFavorito(false);
    }
  }, [motorista?.id, ehFavorito, listarMotoristasFavoritosFn]);

  useEffect(() => {
    if (corrida?.status === "concluida" && motorista?.id && ehFavorito === null) {
      void checkFavoritoStatus();
    }
  }, [corrida?.status, motorista?.id, ehFavorito, checkFavoritoStatus]);

  const handleToggleFavorito = async () => {
    if (!motorista?.id || alternandoFavorito) return;
    setAlternandoFavorito(true);
    try {
      if (ehFavorito) {
        await removerMotoristaFavoritoFn({ data: { motoristaId: motorista.id } });
        setEhFavorito(false);
        toast.success("Motorista removido dos favoritos.");
      } else {
        await adicionarMotoristaFavoritoFn({ data: { motoristaId: motorista.id } });
        setEhFavorito(true);
        toast.success("Motorista favoritado!");
      }
    } catch (err: any) {
      toast.error(err.message || "Não foi possível atualizar seus favoritos.");
    } finally {
      setAlternandoFavorito(false);
    }
  };

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
      // Não espera essa recarga: o evento em tempo real de chat_mensagens
      // (já assinado enquanto o chat está aberto) chama refreshChat() sozinho
      // assim que a mensagem enviada chega de volta — esperar aqui só
      // atrasava a liberação do campo sem mudar o resultado final.
      void refreshChat();
    } catch {
      setChatError("Erro ao enviar mensagem.");
      throw new Error("Erro ao enviar");
    } finally {
      setChatSending(false);
    }
  };

  const handleDigitandoChange = (digitando: boolean) => {
    digitandoRef.current = digitando;
    void atualizarPresencaFn({
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
    <div className="relative flex h-[100dvh] flex-col bg-zuvvi-indigo overflow-hidden font-poppins">
      <div className="relative z-10 p-6 flex items-center justify-between pointer-events-auto shrink-0">
        <button
          onClick={() => void navigate({ to: "/" })}
          className="w-12 h-12 bg-zuvvi-indigo/80 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/10 shadow-lg shadow-black/20 active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3">
          <NotificationBell />
          <div className="flex items-center gap-2 bg-zuvvi-indigo/80 backdrop-blur-md pl-3 pr-4 py-2 rounded-2xl border border-white/10 shadow-lg shadow-black/20 pointer-events-auto overflow-hidden">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zuvvi-volt opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-zuvvi-volt" />
            </span>
            <p
              key={corrida.status}
              className="text-[10px] text-zuvvi-volt font-black uppercase tracking-widest text-center animate-in fade-in slide-in-from-top-1 duration-300"
            >
              {corrida.status === "aceita"
                ? "Motorista Aceitou"
                : corrida.status === "motorista_a_caminho"
                  ? "Motorista a Caminho"
                  : corrida.status === "motorista_chegou"
                    ? "Motorista Chegou"
                    : corrida.status === "em_andamento"
                      ? "Corrida em Andamento"
                      : corrida.status === "concluida"
                        ? "Corrida Concluída"
                        : "Atualizando corrida"}
            </p>
          </div>
        </div>
      </div>

      {/* Mapa: preenche sozinho todo o espaço entre o cabeçalho e o cartão do
          motorista (flex-1), do tamanho que sobrar — sem vão vazio, e sem
          precisar de um valor fixo que desencontraria do tamanho real do
          cartão abaixo. Em tela cheia sai do fluxo (fixed) e cobre a tela
          toda por cima do cabeçalho/cartão (z-[100]), mesma instância do
          MapView o tempo todo (só redimensiona), igual ao padrão já usado na
          tela do motorista. */}
      <div
        className={
          isMapFullscreen
            ? "fixed inset-0 z-[100] overflow-hidden"
            : "relative z-10 min-h-0 flex-1 mx-6 mb-6 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl shadow-black/40"
        }
      >
        {mapboxToken && (
          <MapView
            center={{ lat: corrida.origem_lat, lng: corrida.origem_lng }}
            token={mapboxToken}
            markerLabel="Você"
            pulsePrimaryMarker
            secondaryMarker={
              motorista?.ultima_lat &&
              motorista?.ultima_lng &&
              ["motorista_a_caminho", "motorista_chegou", "em_andamento"].includes(corrida.status)
                ? { lat: motorista.ultima_lat, lng: motorista.ultima_lng }
                : undefined
            }
            secondaryMarkerLabel={motorista?.nome || "Motorista"}
            secondaryMarkerIcon="motorbike"
            secondaryMarkerBearing={driverBearing}
            hideClutterLabels
            className="w-full h-full"
            onMapInstance={(map) => {
              passageiroMapInstance.current = map;
              setIsPassageiroMapReady(true);
            }}
          />
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
        {routeInfo && !routeError && (
          <div className="absolute top-3 left-3 pointer-events-none">
            <div className="bg-zuvvi-indigo/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-zuvvi-volt shrink-0" />
              <p className="text-[11px] text-zuvvi-volt font-black">{routeInfo.etaLabel}</p>
              <span className="text-white/30 text-[10px]">•</span>
              <p className="text-[10px] text-white/70 font-bold">{routeInfo.distanceLabel}</p>
              <span className="relative flex h-1.5 w-1.5 shrink-0 ml-0.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zuvvi-volt opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-zuvvi-volt" />
              </span>
            </div>
          </div>
        )}
        {mapPannedManually && (
          <button
            type="button"
            onClick={handleRecentralizarMapa}
            aria-label="Recentralizar mapa"
            className="absolute bottom-3 left-3 w-9 h-9 rounded-full bg-zuvvi-indigo/80 backdrop-blur-md border border-white/10 shadow-lg flex items-center justify-center active:scale-95 transition-transform animate-in fade-in zoom-in-95 duration-200"
          >
            <Locate className="w-4 h-4 text-white/90" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsMapFullscreen((v) => !v)}
          aria-label={isMapFullscreen ? "Fechar mapa em tela cheia" : "Ver mapa em tela cheia"}
          className={
            isMapFullscreen
              ? "absolute top-6 right-6 w-11 h-11 rounded-full bg-zuvvi-indigo/80 backdrop-blur-md border border-white/10 shadow-lg shadow-black/20 flex items-center justify-center active:scale-95 transition-transform"
              : "absolute bottom-3 right-3 w-9 h-9 rounded-full bg-zuvvi-indigo/80 backdrop-blur-md border border-white/10 shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          }
        >
          {isMapFullscreen ? (
            <Minimize2 className="w-5 h-5 text-white/90" />
          ) : (
            <Maximize2 className="w-4 h-4 text-white/90" />
          )}
        </button>
      </div>

      {motorista && veiculo && corrida.status !== "concluida" && (
        <div className="relative z-10 shrink-0 px-6 pb-6 pointer-events-none">
          <div className="max-w-md mx-auto bg-zuvvi-indigo/90 backdrop-blur-xl border border-white/10 ring-1 ring-white/5 rounded-[2.5rem] p-6 shadow-2xl shadow-black/40 pointer-events-auto animate-rise space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-zuvvi-volt/20 flex items-center justify-center border-2 border-zuvvi-volt/30 shadow-lg shadow-zuvvi-volt/10">
                    {motorista.foto_url ? (
                      <img
                        src={motorista.foto_url}
                        alt={`Foto de ${motorista.nome}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="w-8 h-8 text-zuvvi-volt" />
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-2 border-zuvvi-indigo" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-white font-black text-base truncate">{motorista.nome}</h3>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="flex items-center gap-1 bg-zuvvi-volt/10 rounded-full px-2 py-0.5 w-fit">
                      <Star className="w-3 h-3 text-zuvvi-volt fill-zuvvi-volt" />
                      <span className="text-[11px] text-zuvvi-volt font-black">
                        {motorista.nota_media !== null
                          ? motorista.nota_media.toFixed(1)
                          : "Novo na Zuvvi"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-[10px] text-muted-foreground font-medium truncate">
                      {motorista.total_corridas === 0
                        ? "Primeira corrida"
                        : `${motorista.total_corridas} ${motorista.total_corridas === 1 ? "corrida" : "corridas"} na Zuvvi`}
                    </p>
                    {motorista.membro_desde && (
                      <p className="text-[10px] text-muted-foreground font-medium truncate">
                        Membro {formatarTempoNaZuvvi(motorista.membro_desde)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="shrink-0 bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Placa</p>
                <p className="text-sm font-black text-white tracking-wide">{veiculo.placa}</p>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-zuvvi-volt/10 flex items-center justify-center shrink-0">
                  <Bike className="w-5 h-5 text-zuvvi-volt" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
                    Veículo
                  </p>
                  <p className="text-xs font-bold text-white truncate">
                    {veiculo.marca} {veiculo.modelo}
                    {veiculo.cor ? ` · ${veiculo.cor}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShareOpen(true)}
                  className="bg-white/5 px-3 py-2 rounded-xl active:scale-95 transition-transform flex items-center gap-2 border border-white/10 min-h-[44px] shadow-sm"
                  aria-label="Compartilhar viagem com um contato de confiança"
                >
                  <Share2 className="w-4 h-4 text-white/70" />
                </button>
                <button
                  onClick={() => handleChatOpenChange(true)}
                  className="bg-zuvvi-volt/10 px-4 py-2 rounded-xl active:scale-95 transition-transform flex items-center gap-2 border border-zuvvi-volt/20 min-h-[44px] relative shadow-sm shadow-zuvvi-volt/10"
                  aria-label={`Chat com motorista${chatUnreadCount > 0 ? `, ${chatUnreadCount} mensagens não lidas` : ""}`}
                >
                  <div className="relative">
                    <MessageCircle className="w-4 h-4 text-zuvvi-volt" />
                    {chatUnreadCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-zuvvi-volt text-zuvvi-indigo text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-zuvvi-indigo/50 animate-in zoom-in duration-300">
                        {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-black text-zuvvi-volt uppercase tracking-tighter">
                    Chat
                  </p>
                </button>
              </div>
            </div>
            {corrida.status === "motorista_chegou" && (
              <div className="pt-4 border-t border-white/5 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {corrida.codigo_embarque && /^\d{4}$/.test(corrida.codigo_embarque) ? (
                  <div className="bg-zuvvi-volt/5 border border-zuvvi-volt/20 rounded-2xl p-4 text-center space-y-3">
                    <div className="space-y-1">
                      <p className="text-[10px] text-zuvvi-volt font-black uppercase tracking-widest">
                        Motorista Chegou
                      </p>
                      <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">
                        Informe o código abaixo ao motorista
                      </p>
                    </div>
                    <div className="flex justify-center gap-2">
                      {corrida.codigo_embarque.split("").map((digit, i) => (
                        <div
                          key={i}
                          className="w-12 h-14 bg-zuvvi-indigo border border-zuvvi-volt/30 rounded-xl flex items-center justify-center text-2xl font-black text-zuvvi-volt shadow-inner"
                        >
                          {digit}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 text-center space-y-3">
                    <div className="space-y-1">
                      <p className="text-[10px] text-red-400 font-black uppercase tracking-widest">
                        Motorista Chegou
                      </p>
                      <p className="text-[9px] text-white/60 uppercase font-bold tracking-tighter">
                        Não foi possível carregar seu código de embarque.
                      </p>
                    </div>
                    <button
                      onClick={() => void syncRide(true)}
                      disabled={rideSyncing}
                      className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {rideSyncing && <Loader2 className="w-3 h-3 animate-spin" />}
                      Tentar Novamente
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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

      <ChatConversation
        open={chatOpen}
        onOpenChange={handleChatOpenChange}
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
        respostasRapidas={RESPOSTAS_RAPIDAS_PASSAGEIRO}
        onEnviar={handleEnviarMensagem}
        onDigitandoChange={handleDigitandoChange}
        onRetry={refreshChat}
      />
      <CompartilharViagemDialog open={shareOpen} onOpenChange={setShareOpen} rideId={rideId} />
      {corrida.status === "concluida" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zuvvi-indigo/90 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="w-full max-w-md bg-zuvvi-indigo/50 border border-white/10 rounded-[3rem] p-8 md:p-10 shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-500 max-h-[90vh] overflow-y-auto custom-scrollbar">
            {!avaliacaoSucesso && jaAvaliado === false ? (
              <>
                <div className="flex justify-center">
                  <div className="w-20 h-20 bg-zuvvi-volt/20 rounded-full flex items-center justify-center border border-zuvvi-volt/30">
                    <CheckCircle2 className="w-10 h-10 text-zuvvi-volt" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                    CORRIDA CONCLUÍDA
                  </h2>
                  <p className="text-white/60 text-base">Você chegou ao seu destino.</p>
                </div>

                <div className="bg-white/5 rounded-3xl p-6 space-y-4 border border-white/5">
                  <p className="text-xs font-bold text-zuvvi-volt uppercase tracking-widest">
                    Como foi sua viagem?
                  </p>

                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setNotaAvaliacao(star)}
                        className="p-1 transition-transform active:scale-90"
                      >
                        <Star
                          className={`w-8 h-8 ${notaAvaliacao >= star ? "text-zuvvi-volt fill-zuvvi-volt" : "text-white/20"}`}
                        />
                      </button>
                    ))}
                  </div>

                  <textarea
                    placeholder="Como foi sua viagem? (opcional)"
                    value={comentarioAvaliacao}
                    onChange={(e) => setComentarioAvaliacao(e.target.value)}
                    className="w-full bg-zuvvi-indigo border border-white/10 rounded-2xl p-4 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-zuvvi-volt/50 transition-colors resize-none h-24"
                  />

                  <button
                    onClick={handleEnviarAvaliacao}
                    disabled={notaAvaliacao === 0 || enviandoAvaliacao}
                    className="w-full py-4 rounded-2xl bg-zuvvi-volt text-zuvvi-indigo text-[10px] font-black uppercase tracking-[0.2em] active:scale-95 transition-all shadow-[0_0_40px_rgba(198,255,61,0.2)] disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {enviandoAvaliacao ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    ENVIAR AVALIAÇÃO
                  </button>
                </div>

                <button
                  onClick={() => void navigate({ to: "/" })}
                  className="w-full py-4 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] hover:text-white transition-colors"
                >
                  PULAR E VOLTAR AO INÍCIO
                </button>
              </>
            ) : (
              <>
                <div className="flex justify-center">
                  <div className="w-24 h-24 bg-zuvvi-volt/20 rounded-full flex items-center justify-center border border-zuvvi-volt/30">
                    <CheckCircle2 className="w-12 h-12 text-zuvvi-volt" />
                  </div>
                </div>

                <div className="space-y-3">
                  <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                    {avaliacaoSucesso || jaAvaliado === true ? "OBRIGADO!" : "CORRIDA CONCLUÍDA"}
                  </h2>
                  <p className="text-white/60 text-lg">
                    {avaliacaoSucesso || jaAvaliado === true
                      ? "Sua avaliação ajuda a manter a qualidade do Zuvvi."
                      : "Você chegou ao seu destino."}
                  </p>
                </div>

                {motorista?.id && (
                  <button
                    onClick={handleToggleFavorito}
                    disabled={alternandoFavorito || ehFavorito === null}
                    className="w-full py-4 rounded-2xl border border-white/10 bg-white/5 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {alternandoFavorito ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Heart
                        className={`w-4 h-4 ${ehFavorito ? "text-zuvvi-volt fill-zuvvi-volt" : "text-white/60"}`}
                      />
                    )}
                    {ehFavorito ? "Motorista favoritado" : `Favoritar ${motorista.nome}`}
                  </button>
                )}

                <GorjetaDigital rideId={rideId} />

                <button
                  onClick={() => void navigate({ to: "/" })}
                  className="w-full py-6 rounded-3xl bg-zuvvi-volt text-zuvvi-indigo text-xs font-black uppercase tracking-[0.2em] active:scale-95 transition-all shadow-[0_0_40px_rgba(198,255,61,0.2)]"
                >
                  VOLTAR À TELA INICIAL
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const CheckCircle2 = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
