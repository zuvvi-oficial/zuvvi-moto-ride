import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import mapboxgl from "mapbox-gl";
import {
  AlertTriangle,
  Bike,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Star,
  User,
} from "lucide-react";
import { MapView } from "@/components/MapView";
import {
  getViagemCompartilhadaPublica,
  getMapboxTokenParaViagemCompartilhada,
  criarSosViagemCompartilhada,
} from "@/lib/viagem-compartilhada.functions";

const searchSchema = z.object({ token: z.string().min(1) });

export const Route = createFileRoute("/viagem-compartilhada")({
  validateSearch: (search) => searchSchema.parse(search),
  component: ViagemCompartilhadaPublica,
});

const STATUS_LABEL: Record<string, string> = {
  aceita: "Motorista aceitou a corrida",
  motorista_a_caminho: "Motorista a caminho do embarque",
  motorista_chegou: "Motorista chegou ao local de embarque",
  em_andamento: "Corrida em andamento",
  concluida: "Corrida concluída",
  cancelada: "Corrida cancelada",
};

// Indicador visual de progresso no card de status — cobre só os 4 estados
// ativos da corrida (concluída/cancelada continuam mostrando apenas o
// texto do STATUS_LABEL acima, sem a barrinha). "A caminho" não tem horário
// próprio no banco (é o intervalo entre aceite e chegada), por isso não
// aparece na coluna timestampKey.
const PROGRESSO_ETAPAS = [
  { status: "aceita", label: "Aceita", timestampKey: "dataAceite" },
  { status: "motorista_a_caminho", label: "A caminho", timestampKey: null },
  { status: "motorista_chegou", label: "Chegou", timestampKey: "dataChegadaMotorista" },
  { status: "em_andamento", label: "Em andamento", timestampKey: "dataInicio" },
] as const;

function formatarHorarioEtapa(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const POLL_INTERVAL_MS = 8000;

// Etapa 2 (segurança passiva): limiares dos avisos automáticos mostrados
// pro contato de confiança — nada disso cancela ou altera a corrida, é só
// leitura/alerta visual nesta tela pública.
const SEM_ATUALIZACAO_LIMIAR_MIN = 2;
const PARADO_LIMIAR_MIN = 4;
const PARADO_MOVIMENTO_METROS = 25;
const PARADO_RAIO_PONTO_METROS = 120;

type Snapshot = Awaited<ReturnType<typeof getViagemCompartilhadaPublica>>;

// Direção (bearing, em graus, 0 = norte) entre dois pontos — usada pra girar
// o ícone de moto do motorista na direção real do deslocamento, já que o GPS
// bruto não traz heading, só lat/lng. Mesmo cálculo já usado e validado nas
// telas do passageiro e do motorista, copiado aqui porque esta tela é
// pública/sem sessão e não importa nada dessas outras telas.
function calcularBearingViagemCompartilhada(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Distância aproximada em metros entre dois pontos (haversine) — usada só
// nos avisos de segurança desta tela (motorista parado fora do
// embarque/destino), não em nenhum cálculo de tarifa ou rota real.
function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const raioTerraMetros = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * raioTerraMetros * Math.asin(Math.sqrt(a));
}

function formatarExpiracao(expiraEm: string): string {
  const restanteMs = new Date(expiraEm).getTime() - Date.now();
  if (restanteMs <= 0) return "Link expirado";
  const minutosTotais = Math.floor(restanteMs / 60000);
  const horas = Math.floor(minutosTotais / 60);
  const minutos = minutosTotais % 60;
  return horas > 0 ? `Expira em ${horas}h ${minutos}min` : `Expira em ${minutos} min`;
}

function formatarTempoDesdeAtualizacao(lastFetchedAt: number | null): string {
  if (lastFetchedAt === null) return "Atualizando…";
  const segundos = Math.floor((Date.now() - lastFetchedAt) / 1000);
  if (segundos < 5) return "Atualizado agora";
  if (segundos < 60) return `Atualizado há ${segundos}s`;
  const minutos = Math.floor(segundos / 60);
  return `Atualizado há ${minutos} min`;
}

function ViagemCompartilhadaPublica() {
  const { token } = Route.useSearch();
  const getViagemFn = useServerFn(getViagemCompartilhadaPublica);
  const getTokenFn = useServerFn(getMapboxTokenParaViagemCompartilhada);
  const criarSosFn = useServerFn(criarSosViagemCompartilhada);

  // Etapa 3 — botão de SOS: "idle" (botão normal) -> "confirmando" (pede
  // confirmação antes de agir, pra um toque sem querer não disparar nada)
  // -> "enviando" -> "enviado"/"erro".
  const [sosState, setSosState] = useState<
    "idle" | "confirmando" | "enviando" | "enviado" | "erro"
  >("idle");
  const [sosErro, setSosErro] = useState<string | null>(null);

  const handleConfirmarSos = async () => {
    setSosState("enviando");
    setSosErro(null);
    try {
      await criarSosFn({ data: { linkPublico: token } });
      setSosState("enviado");
    } catch (err) {
      setSosErro(err instanceof Error ? err.message : "Não foi possível enviar o alerta.");
      setSosState("erro");
    }
  };

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Só para o texto "Atualizado há Xs" do rodapé: quando os dados chegaram
  // (via polling ou toque manual) e um contador que força re-render a cada
  // segundo pra esse texto subir sozinho entre uma busca e outra.
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, forcarTick] = useState(0);

  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Direção do ícone de moto do motorista — recalculada só quando ele se
  // move de fato (limiar ~3m), pra não "tremer" com o ruído normal do GPS
  // enquanto ele está parado.
  const [driverBearing, setDriverBearing] = useState(0);
  const previousDriverPosRef = useRef<{ lat: number; lng: number } | null>(null);

  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeEtaMin, setRouteEtaMin] = useState<number | null>(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const lastRouteCoordsRef = useRef<{
    driverLat: number;
    driverLng: number;
    targetLat: number;
    targetLng: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function carregar() {
      try {
        const data = await getViagemFn({ data: { linkPublico: token } });
        if (cancelled) return;
        setSnapshot(data);
        setError(null);
        setLastFetchedAt(Date.now());
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar esta viagem.");
        if (intervalRef.current) clearInterval(intervalRef.current);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void carregar();
    intervalRef.current = setInterval(carregar, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, getViagemFn]);

  // Contador do rodapé ("Atualizado há Xs") — só força re-render a cada
  // segundo, não busca dados nem interfere no polling automático acima.
  useEffect(() => {
    const id = setInterval(() => forcarTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const atualizarAgora = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const data = await getViagemFn({ data: { linkPublico: token } });
      setSnapshot(data);
      setError(null);
      setLastFetchedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar esta viagem.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    getTokenFn({ data: { linkPublico: token } })
      .then((value) => setMapboxToken(value))
      .catch(() => setMapboxToken(null));
  }, [token, getTokenFn]);

  useEffect(() => {
    const lat = snapshot?.motoristaLat;
    const lng = snapshot?.motoristaLng;
    if (lat == null || lng == null) return;

    const anterior = previousDriverPosRef.current;
    if (anterior) {
      const moveu =
        Math.abs(lat - anterior.lat) > 0.00003 || Math.abs(lng - anterior.lng) > 0.00003;
      if (moveu) {
        setDriverBearing(calcularBearingViagemCompartilhada(anterior.lat, anterior.lng, lat, lng));
      }
    }
    previousDriverPosRef.current = { lat, lng };
  }, [snapshot?.motoristaLat, snapshot?.motoristaLng]);

  // Aviso de segurança: marca desde quando o motorista está "parado" no
  // mesmo lugar (só reseta se ele realmente se mover mais que o ruído
  // normal do GPS) — usado pra avisar o contato de confiança se ele ficar
  // parado por muito tempo fora do embarque/destino.
  const stoppedSinceRef = useRef<{ lat: number; lng: number; since: number } | null>(null);
  useEffect(() => {
    const lat = snapshot?.motoristaLat;
    const lng = snapshot?.motoristaLng;
    if (lat == null || lng == null) {
      stoppedSinceRef.current = null;
      return;
    }
    const atual = stoppedSinceRef.current;
    if (!atual || distanciaMetros(atual.lat, atual.lng, lat, lng) > PARADO_MOVIMENTO_METROS) {
      stoppedSinceRef.current = { lat, lng, since: Date.now() };
    }
  }, [snapshot?.motoristaLat, snapshot?.motoristaLng]);

  const etapaAtualIndex = PROGRESSO_ETAPAS.findIndex((etapa) => etapa.status === snapshot?.status);

  const temPosicao = snapshot?.motoristaLat != null && snapshot?.motoristaLng != null;
  const isTrip = snapshot?.status === "em_andamento";
  const targetLat = isTrip ? snapshot?.destinoLat : snapshot?.origemLat;
  const targetLng = isTrip ? snapshot?.destinoLng : snapshot?.origemLng;
  const hasValidTarget = targetLat != null && targetLng != null;
  const targetLabel = isTrip ? "Destino" : "Embarque";

  // Quando o motorista já está bem perto do pino (embarque/destino), as duas
  // etiquetas do mapa (nome dele + "Embarque"/"Destino") ficam próximas
  // demais e se sobrepõem — some com a do pino nesse caso, já que a mesma
  // informação já aparece no card de status acima.
  const pinsMuitoProximos =
    hasValidTarget &&
    temPosicao &&
    distanciaMetros(
      targetLat as number,
      targetLng as number,
      snapshot!.motoristaLat as number,
      snapshot!.motoristaLng as number,
      // 40m era pouco: no zoom fixo desta tela (14), ~100m reais já colidem
      // no mapa (poucos px de distância entre os pinos). 200m cobre essa
      // faixa com margem, sem escurecer o pino cedo demais em trajetos longos.
    ) < 200;

  // Avisos de segurança (Etapa 2) — recalculados a cada renderização (o
  // polling a cada 8s já garante isso), nunca em cache, pra "minutos" andar
  // mesmo quando a posição não muda.
  const minutosSemAtualizar = snapshot?.motoristaUltimaLocalizacaoAt
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(snapshot.motoristaUltimaLocalizacaoAt).getTime()) / 60000,
        ),
      )
    : null;

  const minutosParado = stoppedSinceRef.current
    ? Math.floor((Date.now() - stoppedSinceRef.current.since) / 60000)
    : 0;

  const pertoDeUmPonto =
    temPosicao &&
    ((snapshot?.origemLat != null &&
      snapshot?.origemLng != null &&
      distanciaMetros(
        snapshot!.motoristaLat as number,
        snapshot!.motoristaLng as number,
        snapshot.origemLat,
        snapshot.origemLng,
      ) <= PARADO_RAIO_PONTO_METROS) ||
      (snapshot?.destinoLat != null &&
        snapshot?.destinoLng != null &&
        distanciaMetros(
          snapshot!.motoristaLat as number,
          snapshot!.motoristaLng as number,
          snapshot.destinoLat,
          snapshot.destinoLng,
        ) <= PARADO_RAIO_PONTO_METROS));

  const mostrarAlertaSemAtualizacao =
    temPosicao && minutosSemAtualizar !== null && minutosSemAtualizar >= SEM_ATUALIZACAO_LIMIAR_MIN;
  const mostrarAlertaParado = temPosicao && minutosParado >= PARADO_LIMIAR_MIN && !pertoDeUmPonto;

  // Traça a rota do motorista até o ponto de embarque (ou destino, se a
  // corrida já começou) e calcula ETA/distância — mesma chamada à Directions
  // API já usada e validada nas telas do passageiro e do motorista, só que
  // aqui desenhada direto na instância do mapa (sem nenhuma prop nova no
  // MapView, que fica intacto).
  useEffect(() => {
    const map = mapInstanceRef.current;
    const sourceId = "zuvvi-viagem-compartilhada-route-source";
    const layerId = "zuvvi-viagem-compartilhada-route-layer";
    if (!map || !isMapReady || !mapboxToken) return;

    if (!hasValidTarget || !temPosicao) {
      if (routeAbortRef.current) {
        routeAbortRef.current.abort();
        routeAbortRef.current = null;
      }
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      lastRouteCoordsRef.current = null;
      setRouteError(null);
      setRouteEtaMin(null);
      setRouteDistanceKm(null);
      return;
    }

    const driverLat = snapshot!.motoristaLat as number;
    const driverLng = snapshot!.motoristaLng as number;
    const tLat = targetLat as number;
    const tLng = targetLng as number;

    const coordsChanged =
      !lastRouteCoordsRef.current ||
      lastRouteCoordsRef.current.driverLat !== driverLat ||
      lastRouteCoordsRef.current.driverLng !== driverLng ||
      lastRouteCoordsRef.current.targetLat !== tLat ||
      lastRouteCoordsRef.current.targetLng !== tLng;

    if (!coordsChanged) return;

    if (routeAbortRef.current) {
      routeAbortRef.current.abort();
      routeAbortRef.current = null;
    }

    const controller = new AbortController();
    routeAbortRef.current = controller;

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${driverLng},${driverLat};${tLng},${tLat}?geometries=geojson&overview=full&access_token=${mapboxToken}`;

    fetch(url, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (controller.signal.aborted) return;

        if (data.code !== "Ok" || !data.routes?.[0]) {
          setRouteError("Rota temporariamente indisponível.");
          return;
        }
        setRouteError(null);
        const routeData = data.routes[0];
        setRouteEtaMin(Math.round(routeData.duration / 60));
        setRouteDistanceKm(routeData.distance / 1000);
        const route = routeData.geometry;

        const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData(route);
        } else {
          map.addSource(sourceId, { type: "geojson", data: route });
          map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#C6FF3D", "line-width": 4, "line-opacity": 0.8 },
          });
        }

        lastRouteCoordsRef.current = { driverLat, driverLng, targetLat: tLat, targetLng: tLng };
        if (routeAbortRef.current === controller) {
          routeAbortRef.current = null;
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setRouteError("Rota temporariamente indisponível.");
        }
      });
  }, [isMapReady, mapboxToken, hasValidTarget, temPosicao, snapshot, targetLat, targetLng]);

  useEffect(() => {
    return () => {
      if (routeAbortRef.current) routeAbortRef.current.abort();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zuvvi-indigo-dark">
        <Loader2 className="h-8 w-8 animate-spin text-zuvvi-volt" />
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zuvvi-indigo-dark px-6 text-center text-white">
        <ShieldCheck className="h-10 w-10 text-white/30" />
        <p className="text-lg font-bold">Link indisponível</p>
        <p className="max-w-xs text-sm text-white/60">
          {error || "Este link de acompanhamento expirou ou não existe mais."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zuvvi-indigo-dark text-white">
      <header className="border-b border-white/10 bg-zuvvi-indigo/90 px-5 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-zuvvi-volt" />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zuvvi-volt">
              Acompanhamento Zuvvi
            </p>
            <p className="text-[11px] text-white/50">Compartilhado com você por um passageiro</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-5 py-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          {etapaAtualIndex >= 0 && (
            <div className="mb-3 flex items-center">
              {PROGRESSO_ETAPAS.map((etapa, index) => {
                const horario = etapa.timestampKey
                  ? formatarHorarioEtapa(snapshot[etapa.timestampKey])
                  : null;
                return (
                  <div key={etapa.status} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          index <= etapaAtualIndex ? "bg-zuvvi-volt" : "bg-white/15"
                        }`}
                      />
                      <p
                        className={`whitespace-nowrap text-[8px] font-bold uppercase tracking-widest ${
                          index === etapaAtualIndex ? "text-zuvvi-volt" : "text-white/30"
                        }`}
                      >
                        {etapa.label}
                      </p>
                      {index <= etapaAtualIndex && horario && (
                        <p className="whitespace-nowrap text-[8px] text-white/40">{horario}</p>
                      )}
                    </div>
                    {index < PROGRESSO_ETAPAS.length - 1 && (
                      <div
                        className={`mx-1 h-px flex-1 ${
                          index < etapaAtualIndex ? "bg-zuvvi-volt" : "bg-white/15"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-sm font-bold text-white">
            {STATUS_LABEL[snapshot.status] || "Atualizando corrida"}
          </p>
          {snapshot.destinoNome && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/60">
              <MapPin className="h-3.5 w-3.5" />
              Destino: {snapshot.destinoNome}
            </p>
          )}
          {routeEtaMin !== null && routeDistanceKm !== null && (
            <p className="mt-1 flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5 text-zuvvi-volt" />
              <span className="font-bold text-zuvvi-volt">{routeEtaMin} min</span>
              <span className="text-white/30">•</span>
              <span className="text-white/60">{routeDistanceKm.toFixed(1)} km</span>
            </p>
          )}
        </div>

        {snapshot.passageiroNome && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zuvvi-volt/10">
              {snapshot.passageiroFotoPerfilUrl ? (
                <img
                  src={snapshot.passageiroFotoPerfilUrl}
                  alt={`Foto de ${snapshot.passageiroNome}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-5 w-5 text-zuvvi-volt" />
              )}
            </div>
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-white/40">
                Passageiro
              </p>
              <p className="text-sm text-white/80">
                Você está acompanhando a corrida de{" "}
                <span className="font-bold text-white">{snapshot.passageiroNome}</span>
              </p>
            </div>
          </div>
        )}

        {snapshot.motoristaNome && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zuvvi-volt/10">
              {snapshot.motoristaFotoPerfilUrl ? (
                <img
                  src={snapshot.motoristaFotoPerfilUrl}
                  alt={`Foto de ${snapshot.motoristaNome}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Bike className="h-5 w-5 text-zuvvi-volt" />
              )}
            </div>
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-white/40">
                Motorista
              </p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold">{snapshot.motoristaNome}</p>
                {snapshot.motoristaNota !== null && (
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-zuvvi-volt text-zuvvi-volt" />
                    <span className="text-xs font-bold text-zuvvi-volt">
                      {snapshot.motoristaNota.toFixed(1)}
                    </span>
                  </span>
                )}
              </div>
              {(snapshot.veiculoModelo || snapshot.veiculoPlaca || snapshot.veiculoCor) && (
                <p className="text-xs text-white/60">
                  {[snapshot.veiculoModelo, snapshot.veiculoCor].filter(Boolean).join(" ")}
                  {snapshot.veiculoPlaca ? ` · ${snapshot.veiculoPlaca}` : ""}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-4">
          {sosState === "enviado" ? (
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <p className="text-xs font-bold text-emerald-300">
                Alerta enviado. O suporte da Zuvvi foi avisado e vai acompanhar esta corrida.
              </p>
            </div>
          ) : sosState === "confirmando" ? (
            <div className="space-y-2">
              <p className="text-xs text-white/80">
                Isso vai avisar o suporte da Zuvvi agora sobre esta corrida. Só confirme se
                realmente precisar de ajuda.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSosState("idle")}
                  className="flex-1 rounded-full border border-white/10 bg-white/5 py-2 text-xs font-bold text-white/70 transition-transform active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarSos}
                  className="flex-1 rounded-full bg-red-500 py-2 text-xs font-black text-white transition-transform active:scale-95"
                >
                  Confirmar alerta
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSosState("confirmando")}
              disabled={sosState === "enviando"}
              className="flex w-full items-center justify-between gap-2 text-left disabled:opacity-60"
            >
              <span className="flex items-center gap-2 text-xs font-bold text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {sosState === "enviando" ? "Enviando alerta..." : "Precisa de ajuda agora?"}
              </span>
              <span className="shrink-0 rounded-full bg-red-500/20 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-red-300">
                SOS
              </span>
            </button>
          )}
          {sosState === "erro" && sosErro && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] text-red-300">{sosErro}</p>
              <button
                type="button"
                onClick={handleConfirmarSos}
                className="text-[10px] font-bold text-red-300 underline"
              >
                Tentar de novo
              </button>
            </div>
          )}
        </div>

        {(mostrarAlertaSemAtualizacao || mostrarAlertaParado) && (
          <div className="space-y-2">
            {mostrarAlertaSemAtualizacao && (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-xs text-amber-100">
                  Sem atualização de localização há {minutosSemAtualizar} min. Pode ser
                  instabilidade de sinal — se persistir, vale tentar contato direto.
                </p>
              </div>
            )}
            {mostrarAlertaParado && (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-xs text-amber-100">
                  O motorista está parado há {minutosParado} min fora do ponto de embarque/destino.
                  Pode ser trânsito — vale ficar de olho.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="relative h-80 overflow-hidden rounded-2xl border border-white/10">
          {mapboxToken && (hasValidTarget || temPosicao) ? (
            <MapView
              center={
                hasValidTarget
                  ? { lat: targetLat as number, lng: targetLng as number }
                  : { lat: snapshot.motoristaLat as number, lng: snapshot.motoristaLng as number }
              }
              token={mapboxToken}
              zoom={14}
              markerLabel={hasValidTarget && !pinsMuitoProximos ? targetLabel : undefined}
              hideClutterLabels
              secondaryMarker={
                hasValidTarget && temPosicao
                  ? {
                      lat: snapshot.motoristaLat as number,
                      lng: snapshot.motoristaLng as number,
                      color: "#6C3CE9",
                    }
                  : undefined
              }
              secondaryMarkerLabel={snapshot.motoristaNome || "Motorista"}
              secondaryMarkerIcon="motorbike"
              secondaryMarkerBearing={driverBearing}
              className="w-full h-full"
              onMapInstance={(map) => {
                mapInstanceRef.current = map;
                setIsMapReady(true);
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-white/5 text-center text-xs text-white/50">
              A posição em tempo real aparece aqui assim que disponível.
            </div>
          )}

          {routeEtaMin !== null && routeDistanceKm !== null && (
            <div className="absolute top-3 left-3 pointer-events-none">
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-zuvvi-indigo/80 px-3 py-1.5 shadow-lg backdrop-blur-md">
                <Clock className="h-3 w-3 shrink-0 text-zuvvi-volt" />
                <p className="text-[11px] font-black text-zuvvi-volt">{routeEtaMin} min</p>
                <span className="text-[10px] text-white/30">•</span>
                <p className="text-[10px] font-bold text-white/70">
                  {routeDistanceKm.toFixed(1)} km
                </p>
              </div>
            </div>
          )}

          {routeError && (
            <div className="absolute inset-x-0 bottom-2 flex justify-center pointer-events-none">
              <div className="rounded-full border border-red-500/30 bg-red-500/20 px-3 py-1.5 backdrop-blur-sm">
                <p className="text-[9px] font-bold uppercase tracking-widest text-white">
                  {routeError}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 text-center text-[10px] uppercase tracking-widest text-white/30">
          <Clock className="h-3 w-3 shrink-0" />
          <p>
            {formatarTempoDesdeAtualizacao(lastFetchedAt)} · {formatarExpiracao(snapshot.expiraEm)}
          </p>
          <button
            type="button"
            onClick={atualizarAgora}
            disabled={refreshing}
            aria-label="Atualizar agora"
            className="shrink-0 text-white/30 transition hover:text-white/60 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </main>
    </div>
  );
}
