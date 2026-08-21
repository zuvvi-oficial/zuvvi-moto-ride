import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

/** Discreet, design-system aligned offline / reconnected indicator. */
export function ConnectionStatus() {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [showRecovered, setShowRecovered] = useState(false);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowRecovered(true);
      const timer = window.setTimeout(() => setShowRecovered(false), 2600);
      return () => window.clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showRecovered) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[95] flex justify-center px-4 pointer-events-none"
      style={{ top: "calc(0.75rem + env(safe-area-inset-top))" }}
    >
      {!isOnline ? (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-card/95 px-4 py-2 shadow-xl backdrop-blur-md">
          <WifiOff className="h-4 w-4 text-destructive" />
          <div>
            <p className="text-[11px] font-bold text-card-foreground">Sem conexão</p>
            <p className="text-[10px] text-muted-foreground">
              Localização e status em tempo real ficam indisponíveis.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-card/95 px-4 py-2 shadow-xl backdrop-blur-md">
          <Wifi className="h-4 w-4 text-primary" />
          <p className="text-[11px] font-bold text-card-foreground">Conexão restabelecida</p>
        </div>
      )}
    </div>
  );
}
