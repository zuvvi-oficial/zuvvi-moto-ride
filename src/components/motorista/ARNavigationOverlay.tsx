import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Navigation2, X } from "lucide-react";

interface ARNavigationOverlayProps {
  targetLat: number;
  targetLng: number;
  label: string;
  onClose: () => void;
}

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number) {
  return (rad * 180) / Math.PI;
}

// Fórmulas padrão de navegação esférica (rumo inicial e distância
// haversine) — as mesmas usadas em qualquer bússola de app de corrida.
function calcularRumo(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lng2 - lng1);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function calcularDistanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lng2 - lng1);
  const a =
    Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Tela cheia com câmera + bússola do celular mostrando uma seta que aponta
 * pro ponto de embarque/destino, sobreposta à imagem real (AR simples).
 * Totalmente isolado do resto da tela de corrida: gerencia sua própria
 * câmera, geolocalização e sensor de orientação, e nunca deixa nada disso
 * vazar pro componente pai — se algo não for suportado ou a permissão for
 * negada, mostra um aviso e nada mais quebra.
 */
export function ARNavigationOverlay({
  targetLat,
  targetLng,
  label,
  onClose,
}: ARNavigationOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [bearing, setBearing] = useState<number | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setError("Este navegador não suporta acesso à câmera.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (!cancelled)
          setError("Não foi possível acessar a câmera. Verifique a permissão do navegador.");
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let cleanupListeners: (() => void) | undefined;

    function handleOrientation(event: DeviceOrientationEvent) {
      // Safari/iOS expõe webkitCompassHeading (já é o rumo magnético direto);
      // outros navegadores só têm alpha, que é o inverso do rumo bússola.
      const iosEvent = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
      const compassHeading =
        typeof iosEvent.webkitCompassHeading === "number"
          ? iosEvent.webkitCompassHeading
          : event.alpha !== null
            ? 360 - event.alpha
            : null;
      if (compassHeading !== null && !cancelled) setHeading(compassHeading);
    }

    async function setupOrientation() {
      const OrientationEventCtor = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">;
      };

      if (typeof OrientationEventCtor?.requestPermission === "function") {
        try {
          const result = await OrientationEventCtor.requestPermission();
          if (result !== "granted") {
            if (!cancelled) setError("Permissão de orientação do celular negada.");
            return;
          }
        } catch {
          if (!cancelled) setError("Não foi possível pedir permissão de orientação do celular.");
          return;
        }
      }

      if (cancelled) return;
      window.addEventListener("deviceorientationabsolute", handleOrientation, true);
      window.addEventListener("deviceorientation", handleOrientation, true);
      cleanupListeners = () => {
        window.removeEventListener("deviceorientationabsolute", handleOrientation, true);
        window.removeEventListener("deviceorientation", handleOrientation, true);
      };
    }

    void setupOrientation();

    return () => {
      cancelled = true;
      cleanupListeners?.();
    };
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setError("Geolocalização não disponível neste navegador.");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setBearing(calcularRumo(latitude, longitude, targetLat, targetLng));
        setDistanceM(calcularDistanciaMetros(latitude, longitude, targetLat, targetLng));
      },
      () => setError("Não foi possível obter sua localização."),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [targetLat, targetLng]);

  const arrowRotation = bearing !== null && heading !== null ? bearing - heading : null;

  return (
    <div className="fixed inset-0 z-[110] bg-black flex flex-col">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60" />

      <div className="relative z-10 flex items-center justify-between p-5">
        <div className="bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
          <p className="text-[10px] text-white font-bold uppercase tracking-widest">{label}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar seta de navegação"
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center active:scale-95 transition-transform"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center">
        {error ? (
          <div className="max-w-xs text-center space-y-3 px-6">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
            <p className="text-sm text-white font-bold">{error}</p>
          </div>
        ) : arrowRotation !== null ? (
          <Navigation2
            className="w-24 h-24 text-zuvvi-volt drop-shadow-[0_0_20px_rgba(198,255,61,0.6)] transition-transform duration-200"
            style={{ transform: `rotate(${arrowRotation}deg)` }}
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-zuvvi-volt animate-spin" />
            <p className="text-xs text-white/70 uppercase tracking-widest font-bold text-center px-6">
              Aguardando localização e bússola do celular...
            </p>
          </div>
        )}
      </div>

      {distanceM !== null && !error && (
        <div className="relative z-10 pb-10 flex justify-center">
          <div className="bg-black/50 backdrop-blur-sm px-5 py-2.5 rounded-full border border-white/10">
            <p className="text-sm text-white font-black">
              {distanceM >= 1000
                ? `${(distanceM / 1000).toFixed(1)} km`
                : `${Math.round(distanceM)} m`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
