import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useSoundStore } from "@/hooks/use-sound";

// Som próprio do chat: precisa ser claramente diferente do alerta de corrida
// nova, senão o motorista acha que entrou corrida a cada mensagem.
const SOM_MENSAGEM = "/sounds/zuvvi_chat.wav";
const VIBRACAO_MENSAGEM = [40, 60, 40];

type AvaliarParams = {
  naoLidas: number;
  remetenteNome: string;
  previa?: string | null;
  onAbrir: () => void;
};

/**
 * Alerta de mensagem nova com o chat fechado: som, vibração e aviso clicável.
 * Só dispara quando a contagem de não lidas realmente cresce — nunca na carga
 * inicial nem quando a mesma contagem volta do servidor.
 */
export function useChatAlert() {
  const play = useSoundStore((state) => state.play);
  const anteriorRef = useRef<number | null>(null);

  // Registra a contagem sem alertar: usado na carga inicial e ao abrir o chat,
  // quando o usuário já está vendo as mensagens.
  const sincronizar = useCallback((naoLidas: number) => {
    anteriorRef.current = naoLidas;
  }, []);

  const avaliar = useCallback(
    ({ naoLidas, remetenteNome, previa, onAbrir }: AvaliarParams) => {
      const anterior = anteriorRef.current;
      anteriorRef.current = naoLidas;

      if (anterior === null || naoLidas <= anterior) return;

      play(SOM_MENSAGEM).catch(() => {
        // Navegador pode bloquear áudio sem interação: vibração e aviso bastam.
      });

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(VIBRACAO_MENSAGEM);
      }

      const primeiroNome = remetenteNome.trim().split(/\s+/)[0];

      toast(primeiroNome ? `Mensagem de ${primeiroNome}` : "Nova mensagem", {
        description: previa || "Toque para abrir a conversa.",
        action: { label: "Abrir", onClick: onAbrir },
      });
    },
    [play],
  );

  return { avaliar, sincronizar };
}
