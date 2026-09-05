import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Bike, Loader2, MapPin, ShieldCheck } from "lucide-react";
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

function ViagemCompartilhadaPublica() {
  const { token } = Route.useSearch();
  const getViagemFn = useServerFn(getViagemCompartilhadaPublica);
  const getTokenFn = useServerFn(getMapboxTokenParaViagemCompartilhada);

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const temPosicao = snapshot.motoristaLat !== null && snapshot.motoristaLng !== null;

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
              <p className="text-sm font-bold">{snapshot.motoristaNome}</p>
              {(snapshot.veiculoModelo || snapshot.veiculoPlaca) && (
                <p className="text-xs text-white/60">
                  {snapshot.veiculoModelo} {snapshot.veiculoPlaca ? `· ${snapshot.veiculoPlaca}` : ""}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="h-72 overflow-hidden rounded-2xl border border-white/10">
          {temPosicao && mapboxToken ? (
            <MapView
              center={{ lat: snapshot.motoristaLat as number, lng: snapshot.motoristaLng as number }}
              token={mapboxToken}
              zoom={14}
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-white/5 text-center text-xs text-white/50">
              A posição em tempo real aparece aqui assim que disponível.
            </div>
          )}
        </div>

        <p className="text-center text-[10px] uppercase tracking-widest text-white/30">
          Atualiza automaticamente
        </p>
      </main>
    </div>
  );
}
