import { useEffect } from "react";
import { falar, vozAtivada } from "@/lib/fala";

/**
 * Ponte entre o push de nova oferta (public/sw-push.js) e a voz do app: o
 * service worker não consegue falar sozinho (speechSynthesis só existe numa
 * página), então quando o app está aberto em segundo plano ele nos avisa por
 * postMessage e é essa página que efetivamente fala. Com o app 100% fechado
 * não há nada em memória pra receber a mensagem — nesse caso só o alerta
 * nativo do sistema (som, vibração, balão) chega mesmo, como já acontecia.
 */
export function DriverOfferVoiceBridge() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "zuvvi-nova-oferta-voz") return;
      if (!vozAtivada()) return;
      falar("Você tem uma nova corrida disponível.");
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, []);

  return null;
}
