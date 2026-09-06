import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { Bike, Loader2, RefreshCw } from "lucide-react";
import { checkCityAvailability } from "@/lib/user.functions";
import {
  checkPassageiroDriverAvailability,
  type PassageiroDriverAvailability,
} from "@/lib/passageiro-disponibilidade.functions";

type GateState = {
  blocked: boolean;
  info: PassageiroDriverAvailability | null;
};

const INITIAL_STATE: GateState = {
  blocked: false,
  info: null,
};

export function PassengerDriverAvailabilityGate() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const checkCityAvailabilityFn = useServerFn(checkCityAvailability);
  const checkDriverAvailabilityFn = useServerFn(checkPassageiroDriverAvailability);
  const [gateState, setGateState] = useState<GateState>(INITIAL_STATE);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkAvailability = useCallback(async () => {
    if (pathname !== "/" || typeof navigator === "undefined" || !navigator.geolocation) {
      setGateState(INITIAL_STATE);
      return;
    }

    setIsRefreshing(true);

    try {
      const coords = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          reject,
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 60000,
          },
        );
      });

      // A P1 continua sendo a autoridade sobre cidade/origem real.
      // A P1B só verifica motoristas quando a origem GPS já está autorizada.
      const cityAvailability = await checkCityAvailabilityFn({ data: { coords } });
      if (!cityAvailability.isAvailable) {
        setGateState(INITIAL_STATE);
        return;
      }

      const driverAvailability = await checkDriverAvailabilityFn();

      if (
        driverAvailability.reason === "no_driver_online" &&
        !driverAvailability.hasAvailableDriver
      ) {
        setGateState({
          blocked: true,
          info: driverAvailability,
        });
        return;
      }

      setGateState(INITIAL_STATE);
    } catch {
      // Fail neutral na camada visual: GPS/cidade continuam sendo tratados pela Home.
      // A indisponibilidade não é inventada quando a verificação complementar falha.
      setGateState(INITIAL_STATE);
    } finally {
      setIsRefreshing(false);
    }
  }, [pathname, checkCityAvailabilityFn, checkDriverAvailabilityFn]);

  useEffect(() => {
    if (pathname !== "/") {
      setGateState(INITIAL_STATE);
      return;
    }

    void checkAvailability();

    const intervalId = window.setInterval(() => {
      void checkAvailability();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [pathname, checkAvailability]);

  if (pathname !== "/" || !gateState.blocked || !gateState.info) {
    return null;
  }

  const { cityName, cityUf, cityStatus } = gateState.info;
  const cityLabel = [cityName, cityUf].filter(Boolean).join(", ");
  const isPilot = cityStatus === "piloto";

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 bottom-[88px] z-[70] bg-zuvvi-indigo-dark/95 backdrop-blur-sm"
        aria-hidden="true"
      />

      <section
        className="fixed left-1/2 bottom-[108px] z-[71] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-[2.5rem] border border-white/10 bg-zuvvi-indigo/95 p-8 text-center shadow-2xl"
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-zuvvi-volt/20">
          <Bike className="h-8 w-8 text-zuvvi-volt" />
        </div>

        <h2 className="text-2xl font-bold text-white">
          {isPilot && cityName
            ? `Estamos começando em ${cityName}`
            : "Mototaxistas indisponíveis agora"}
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {isPilot
            ? `O Zuvvi já está disponível em ${cityLabel || "sua cidade"}, mas no momento não há mototaxistas online. Como a operação está começando por aqui, a disponibilidade pode variar.`
            : `No momento não há mototaxistas disponíveis em ${cityLabel || "sua cidade"}.`}
        </p>

        <p className="mt-3 text-xs font-semibold text-zuvvi-volt">
          Tente novamente em alguns minutos. Assim que um mototaxista ficar online, você poderá pedir sua corrida.
        </p>

        <button
          type="button"
          onClick={() => void checkAvailability()}
          disabled={isRefreshing}
          className="mt-6 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-zuvvi-volt px-5 py-4 text-xs font-black uppercase tracking-widest text-zuvvi-indigo transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isRefreshing ? "VERIFICANDO..." : "VERIFICAR NOVAMENTE"}
        </button>
      </section>
    </>
  );
}
