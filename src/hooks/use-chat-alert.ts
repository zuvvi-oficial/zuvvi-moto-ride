import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useSoundStore } from "@/hooks/use-sound";
import { falar, vozAtivada } from "@/lib/fala";

// Som próprio do chat: precisa ser claramente diferente do alerta de corrida
// nova, senão o motorista acha que entrou corrida a cada mensagem.
const SOM_MENSAGEM = "/sounds/zuvvi_chat.wav";
const VIBRACAO_MENSAGEM = [300, 120, 300, 120, 300];
// O chime dura pouco menos de meio segundo; a voz entra logo depois dele em vez
// de por cima.
const ATRASO_DA_VOZ_MS = 600;
// Mensagem comprida vira locução interminável — quem quiser o resto abre o chat.
const MAX_CARACTERES_FALADOS = 160;

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

  // Registra a contagem sem alertar: usado ao abrir o chat, quando o usuário
  // já está vendo as mensagens.
  const sincronizar = useCallback((naoLidas: number) => {
    anteriorRef.current = naoLidas;
  }, []);

  // Volta pro estado "ainda não sei quantas eram": a primeira contagem que
  // chegar vira a base, sem alertar. Usado ao montar e ao trocar de corrida —
  // zerar a base aqui faria uma corrida que já tem mensagens pendentes alertar
  // durante o carregamento.
  const resetar = useCallback(() => {
    anteriorRef.current = null;
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

      // Lê a mensagem em voz alta: quem está pilotando — ou com o celular no
      // bolso — fica sabendo sem precisar olhar a tela. Quem desativou os
      // alertas de voz continua no silêncio: falar o conteúdo da conversa em
      // público é justamente o que essa pessoa pediu pra não acontecer.
      const textoFalado = previa
        ? previa.slice(0, MAX_CARACTERES_FALADOS)
        : "Você recebeu uma mensagem nova.";
      const frase = primeiroNome
        ? `Mensagem de ${primeiroNome}. ${textoFalado}`
        : `Mensagem nova. ${textoFalado}`;

      window.setTimeout(() => {
        // Conferido na hora de falar, não ao agendar: dá tempo de silenciar
        // entre o chime e a locução.
        if (!vozAtivada()) return;
        falar(frase);
      }, ATRASO_DA_VOZ_MS);
    },
    [play],
  );

  return { avaliar, sincronizar, resetar };
}
