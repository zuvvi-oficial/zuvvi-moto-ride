import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Volume2, VolumeX } from "lucide-react";
import { getAcompanhamentoPassageiro } from "@/lib/user.functions";
import { supabase } from "@/integrations/supabase/client";

const VOICE_PREFERENCE_KEY = "zuvvi:passageiro-alertas-voz";

interface RideVoiceData {
  status: string | null;
  driverName: string | null;
  boardingCode: string | null;
}

const EMPTY_DATA: RideVoiceData = {
  status: null,
  driverName: null,
  boardingCode: null,
};

function choosePortugueseVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => voice.lang.toLowerCase() === "pt-br") ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("pt")) ||
    null
  );
}

function formatCodeForSpeech(code: string) {
  return code.split("").join(", ");
}

export function PassengerRideVoiceController() {
  const href = useRouterState({ select: (state) => state.location.href });
  const getAcompanhamentoFn = useServerFn(getAcompanhamentoPassageiro);
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [rideData, setRideData] = useState<RideVoiceData>(EMPTY_DATA);
  const syncGenerationRef = useRef(0);
  const announcedRef = useRef<Set<string>>(new Set());

  const rideId = useMemo(() => {
    try {
      const parsed = new URL(href, "https://zuvvi.local");
      if (parsed.pathname !== "/acompanhamento") return null;
      return parsed.searchParams.get("rideId");
    } catch {
      return null;
    }
  }, [href]);

  const speechSupported =
    mounted &&
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window;

  useEffect(() => {
    setMounted(true);
    try {
      const stored = window.localStorage.getItem(VOICE_PREFERENCE_KEY);
      if (stored === "false") setEnabled(false);
      if (stored === "true") setEnabled(true);
    } catch {
      // Preferência local é opcional; falha não interfere na corrida.
    }
  }, []);

  useEffect(() => {
    announcedRef.current.clear();
    setRideData(EMPTY_DATA);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [rideId]);

  const syncRideVoiceData = useCallback(async () => {
    if (!rideId) return;

    const generation = ++syncGenerationRef.current;
    try {
      const data = await getAcompanhamentoFn({ data: { rideId } });
      if (generation !== syncGenerationRef.current || !data.ride) return;

      setRideData({
        status: data.ride.status ?? null,
        driverName: data.driver?.nome?.trim() || null,
        boardingCode:
          typeof data.ride.codigo_embarque === "string" ? data.ride.codigo_embarque : null,
      });
    } catch {
      // Best effort: alerta de voz nunca pode afetar o fluxo funcional da corrida.
    }
  }, [getAcompanhamentoFn, rideId]);

  useEffect(() => {
    if (!rideId) return undefined;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void syncRideVoiceData();

    const setupRealtime = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      channel = supabase
        .channel(`passageiro-voz-${rideId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "corridas",
            filter: `id=eq.${rideId}`,
          },
          () => {
            void syncRideVoiceData();
          },
        )
        .subscribe();
    };

    void setupRealtime();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [rideId, syncRideVoiceData]);

  const speak = useCallback((text: string) => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !("SpeechSynthesisUtterance" in window)
    ) {
      return;
    }

    const synthesis = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    const preferredVoice = choosePortugueseVoice();

    utterance.lang = "pt-BR";
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.volume = 1;
    if (preferredVoice) utterance.voice = preferredVoice;

    synthesis.cancel();
    synthesis.speak(utterance);
  }, []);

  useEffect(() => {
    if (!enabled || !speechSupported || !rideId) return;

    const driverName = rideData.driverName;
    const status = rideData.status;
    if (!status) return;

    if (status === "aceita") {
      const key = "aceita";
      if (!driverName || announcedRef.current.has(key)) return;
      announcedRef.current.add(key);
      speak(`Boa notícia! ${driverName} aceitou sua corrida. Em instantes, ele estará a caminho do seu local de embarque.`);
      return;
    }

    if (status === "motorista_a_caminho") {
      const key = "motorista_a_caminho";
      if (announcedRef.current.has(key)) return;
      announcedRef.current.add(key);
      speak("Tudo certo. Seu motorista já está a caminho do local de embarque.");
      return;
    }

    if (status === "motorista_chegou") {
      const arrivalKey = "motorista_chegou";
      const validCode = /^\d{4}$/.test(rideData.boardingCode || "")
        ? (rideData.boardingCode as string)
        : null;
      const codeKey = validCode ? `codigo:${validCode}` : null;

      if (!announcedRef.current.has(arrivalKey)) {
        announcedRef.current.add(arrivalKey);
        if (codeKey) announcedRef.current.add(codeKey);

        const codeMessage = validCode
          ? ` Para sua segurança, informe ao motorista o código de embarque: ${formatCodeForSpeech(validCode)}.`
          : " Seu código de embarque está sendo carregado na tela.";

        speak(`Seu motorista chegou ao local de embarque.${codeMessage}`);
        return;
      }

      if (validCode && codeKey && !announcedRef.current.has(codeKey)) {
        announcedRef.current.add(codeKey);
        speak(`Seu código de embarque é: ${formatCodeForSpeech(validCode)}.`);
      }
    }
  }, [
    enabled,
    rideData.boardingCode,
    rideData.driverName,
    rideData.status,
    rideId,
    speak,
    speechSupported,
  ]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleVoice = () => {
    if (!speechSupported) return;

    const next = !enabled;
    setEnabled(next);

    try {
      window.localStorage.setItem(VOICE_PREFERENCE_KEY, String(next));
    } catch {
      // Preferência local é opcional.
    }

    if (!next) {
      window.speechSynthesis.cancel();
    }
  };

  if (!mounted || !rideId) return null;

  const label = !speechSupported
    ? "Alertas de voz não disponíveis neste aparelho"
    : enabled
      ? "Desativar alertas de voz"
      : "Ativar alertas de voz";

  return (
    <button
      type="button"
      onClick={toggleVoice}
      disabled={!speechSupported}
      aria-label={label}
      aria-pressed={enabled}
      title={label}
      className={`fixed right-6 top-24 z-[65] flex h-12 w-12 items-center justify-center rounded-2xl border backdrop-blur-md transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
        enabled && speechSupported
          ? "border-zuvvi-volt/30 bg-zuvvi-indigo/90 text-zuvvi-volt shadow-[0_0_24px_rgba(198,255,61,0.16)]"
          : "border-white/10 bg-zuvvi-indigo/90 text-white/45"
      }`}
    >
      {enabled && speechSupported ? (
        <Volume2 className="h-5 w-5" />
      ) : (
        <VolumeX className="h-5 w-5" />
      )}
    </button>
  );
}
