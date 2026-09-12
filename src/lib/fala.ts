/**
 * Locução em português do Brasil — a "voz da Zuvvi".
 *
 * Centraliza a escolha de voz para que oferta de corrida e mensagem de chat
 * soem como o mesmo app, em vez de cada tela sortear a voz padrão do aparelho.
 */

type OpcoesFala = {
  /** Velocidade da fala. Padrão 1.15, o mesmo do alerta de corrida. */
  rate?: number;
  pitch?: number;
};

/**
 * Chave onde o passageiro guarda se quer alertas falados. O nome vem do
 * controle de voz da corrida e fica como está: mudá-lo faria o app esquecer
 * quem já desativou.
 */
export const CHAVE_PREFERENCIA_VOZ = "zuvvi:passageiro-alertas-voz";

/** Padrão é falar; só quem desativou explicitamente fica no silêncio. */
export function vozAtivada() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(CHAVE_PREFERENCIA_VOZ) !== "false";
  } catch {
    // Sem acesso ao storage, não dá pra afirmar que foi desativado.
    return true;
  }
}

const NOMES_DE_VOZ_PREFERIDOS = [
  "francisca",
  "luciana",
  "maria",
  "google português do brasil",
  "female",
  "mulher",
];

function escolherVoz(synth: SpeechSynthesis): SpeechSynthesisVoice | undefined {
  const vozesPtBr = synth
    .getVoices()
    .filter((voice) => voice.lang.toLowerCase().replace("_", "-") === "pt-br");

  const preferida = NOMES_DE_VOZ_PREFERIDOS.map((nome) =>
    vozesPtBr.find((voice) => voice.name.toLowerCase().includes(nome)),
  ).find(Boolean);

  return preferida || vozesPtBr[0];
}

export function falar(frase: string, opcoes: OpcoesFala = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const texto = frase.trim();
  if (!texto) return;

  const synth = window.speechSynthesis;
  // A locução mais recente substitui a que ainda estiver na fila: o motorista
  // precisa ouvir o que acabou de chegar, não o acúmulo.
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(texto);
  utterance.lang = "pt-BR";
  utterance.rate = opcoes.rate ?? 1.15;
  utterance.pitch = opcoes.pitch ?? 1.03;
  utterance.volume = 1;

  const voz = escolherVoz(synth);
  if (voz) utterance.voice = voz;

  synth.speak(utterance);
}
