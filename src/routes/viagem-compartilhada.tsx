import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import mapboxgl from "mapbox-gl";
import { Bike, Clock, Loader2, MapPin, ShieldCheck, Star } from "lucide-react";
import { MapView } from "@/components/MapView";
import {
  getViagemCompartilhadaPublica,
  getMapboxTokenParaViagemCompartilhada,
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

const POLL_INTERVAL_MS = 8000;

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

function formatarExpiracao(expiraEm: string): string {
  const restanteMs = new Date(expiraEm).getTime() - Date.now();
  if (restanteMs <= 0) return "Link expirado";
  const minutosTotais = Math.floor(restanteMs / 60000);
  const horas = Math.floor(minutosTotais / 60);
  const minutos = minutosTotais % 60;
  return horas > 0 ? `Expira em ${horas}h ${minutos}min` : `Expira em ${minutos} min`;
}

function ViagemCompartilhadaPublica() {
  const { token } = Route.useSearch();
  const getViagemFn = useServerFn(getViagemCompartilhadaPublica);
  const getTokenFn = useServerFn(getMapboxTokenParaViagemCompartilhada);

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const temPosicao = snapshot?.motoristaLat != null && snapshot?.motoristaLng != null;
  const isTrip = snapshot?.status === "em_andamento";
  const targetLat = isTrip ? snapshot?.destinoLat : snapshot?.origemLat;
  const targetLng = isTrip ? snapshot?.destinoLng : snapshot?.origemLng;
  const hasValidTarget = targetLat != null && targetLng != null;
  const targetLabel = isTrip ? "Destino" : "Embarque";

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
          <p className="text-sm font-bold text-white">
            {STATUS_LABEL[snapshot.status] || "Atualizando corrida"}
          </p>
          {snapshot.destinoNome && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/60">
              <MapPin className="h-3.5 w-3.5" />
              Destino: {snapshot.destinoNome}
            </p>
          )}
        </div>

        {snapshot.motoristaNome && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zuvvi-volt/10">
              <Bike className="h-5 w-5 text-zuvvi-volt" />
            </div>
            <div>
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
              markerLabel={hasValidTarget ? targetLabel : undefined}
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

        <p className="text-center text-[10px] uppercase tracking-widest text-white/30">
          Atualiza automaticamente · {formatarExpiracao(snapshot.expiraEm)}
        </p>
      </main>
    </div>
  );
}
