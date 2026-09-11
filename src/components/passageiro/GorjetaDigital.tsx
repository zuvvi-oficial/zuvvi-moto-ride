import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { Check, Clipboard, Gift, Loader2, PartyPopper, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { criarGorjeta, getGorjetaDaCorrida, criarCobrancaGorjeta } from "@/lib/gorjetas.functions";

/**
 * Gorjeta digital — Etapa 3 (UI). Widget autocontido pra tela de
 * pós-corrida: escolher valor, gerar o Pix (Etapa 2) e acompanhar o
 * pagamento até confirmar. Some silenciosamente (retorna null) quando o
 * motorista não está apto a receber gorjetas ainda — não é um erro do
 * passageiro, só a feature ainda não disponível pra aquele motorista.
 */

const VALORES_SUGERIDOS = [3, 5, 10, 20];
const POLL_MS = 4000;

type Fase =
  | "carregando"
  | "escolher"
  | "registrando"
  | "aguardando_pagamento"
  | "paga"
  | "falhou"
  | "erro_temporario"
  | "indisponivel";

type PixData = Readonly<{ pixCopiaCola: string; qrCodeBase64: string; ticketUrl: string | null }>;

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function GorjetaDigital({ rideId }: { rideId: string }) {
  const getGorjetaFn = useServerFn(getGorjetaDaCorrida);
  const criarGorjetaFn = useServerFn(criarGorjeta);
  const criarCobrancaFn = useServerFn(criarCobrancaGorjeta);

  const [fase, setFase] = useState<Fase>("carregando");
  const [gorjetaId, setGorjetaId] = useState<string | null>(null);
  const [valor, setValor] = useState<number | null>(null);
  const [valorEscolhido, setValorEscolhido] = useState<number | null>(null);
  const [valorCustom, setValorCustom] = useState("");
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [copiado, setCopiado] = useState(false);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gerarCobranca = useCallback(
    async (id: string) => {
      try {
        const cobranca = await criarCobrancaFn({ data: { gorjetaId: id } });
        setPixData(cobranca);
        setFase("aguardando_pagamento");
      } catch (err: any) {
        toast.error(err?.message || "Não foi possível gerar o Pix da gorjeta.");
        setFase("erro_temporario");
      }
    },
    [criarCobrancaFn],
  );

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await getGorjetaFn({ data: { corridaId: rideId } });
        if (cancelado) return;

        if (!res.existe) {
          setFase("escolher");
          return;
        }

        setGorjetaId(res.id);
        setValor(res.valor);

        if (res.status === "paga") setFase("paga");
        else if (res.status === "falhou") setFase("falhou");
        else await gerarCobranca(res.id);
      } catch {
        if (!cancelado) setFase("indisponivel");
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId]);

  useEffect(() => {
    if (fase !== "aguardando_pagamento" || !gorjetaId) return undefined;

    pollRef.current = setTimeout(async () => {
      try {
        const res = await getGorjetaFn({ data: { corridaId: rideId } });
        if (res.existe && res.status === "paga") {
          setFase("paga");
          toast.success("Gorjeta enviada!");
        } else if (res.existe && res.status === "falhou") {
          setFase("falhou");
        }
      } catch {
        // Mantém aguardando — próxima rodada de poll tenta de novo.
      }
    }, POLL_MS);

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [fase, gorjetaId, getGorjetaFn, rideId]);

  const enviarGorjeta = async (valorSelecionado: number) => {
    setFase("registrando");
    try {
      const criado = await criarGorjetaFn({ data: { corridaId: rideId, valor: valorSelecionado } });
      setGorjetaId(criado.id);
      setValor(valorSelecionado);
      await gerarCobranca(criado.id);
    } catch (err: any) {
      if (typeof err?.message === "string" && err.message.includes("apto a receber gorjetas")) {
        setFase("indisponivel");
        return;
      }
      toast.error(err?.message || "Não foi possível registrar a gorjeta.");
      setFase("escolher");
    }
  };

  const copiarPix = async () => {
    if (!pixData?.pixCopiaCola) return;
    try {
      await navigator.clipboard.writeText(pixData.pixCopiaCola);
      setCopiado(true);
      toast.success("Código Pix copiado!");
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("Não foi possível copiar. Selecione o código manualmente.");
    }
  };

  if (fase === "carregando" || fase === "indisponivel") return null;

  return (
    <div className="w-full rounded-3xl border border-white/5 bg-white/5 p-6 space-y-4 text-left">
      <div className="flex items-center gap-2 text-xs font-bold text-zuvvi-volt uppercase tracking-widest">
        <Gift className="w-4 h-4" />
        Gorjeta digital
      </div>

      {fase === "escolher" && (
        <div className="space-y-4">
          <p className="text-sm text-white/60">Gostou da corrida? Dê uma gorjeta pro motorista, direto por Pix.</p>
          <div className="flex flex-wrap gap-2">
            {VALORES_SUGERIDOS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setValorEscolhido(v);
                  setValorCustom("");
                }}
                className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${
                  valorEscolhido === v
                    ? "bg-zuvvi-volt text-zuvvi-indigo"
                    : "bg-white/5 text-white/70 border border-white/10"
                }`}
              >
                {formatMoney(v)}
              </button>
            ))}
            <input
              type="number"
              inputMode="decimal"
              min={1}
              max={200}
              placeholder="Outro valor"
              value={valorCustom}
              onChange={(e) => {
                setValorCustom(e.target.value);
                setValorEscolhido(null);
              }}
              className="w-28 px-3 py-2 rounded-xl bg-zuvvi-indigo border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-zuvvi-volt/50"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const escolhido = valorEscolhido ?? Number(valorCustom.replace(",", "."));
              if (!escolhido || escolhido < 1 || escolhido > 200) {
                toast.error("Escolha um valor entre R$ 1 e R$ 200.");
                return;
              }
              void enviarGorjeta(escolhido);
            }}
            disabled={!valorEscolhido && !valorCustom}
            className="w-full py-3 rounded-2xl bg-zuvvi-volt text-zuvvi-indigo text-[10px] font-black uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-40"
          >
            Enviar gorjeta
          </button>
        </div>
      )}

      {(fase === "registrando" || (fase === "aguardando_pagamento" && !pixData)) && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="w-7 h-7 text-zuvvi-volt animate-spin" />
          <p className="text-sm text-white/50">Gerando o Pix da sua gorjeta...</p>
        </div>
      )}

      {fase === "aguardando_pagamento" && pixData && valor !== null && (
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            Pague {formatMoney(valor)} via Pix pra enviar a gorjeta. Confirmamos automaticamente.
          </p>
          <div className="mx-auto w-fit bg-white p-3 rounded-2xl">
            <QRCodeSVG value={pixData.pixCopiaCola} size={160} level="M" marginSize={0} />
          </div>
          <button
            type="button"
            onClick={() => void copiarPix()}
            className="w-full py-3 rounded-2xl bg-zuvvi-volt text-zuvvi-indigo text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            {copiado ? <Check className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
            {copiado ? "Código copiado" : "Copiar código Pix"}
          </button>
          <p className="text-[11px] text-white/40 text-center flex items-center justify-center gap-1.5">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Aguardando confirmação do pagamento...
          </p>
        </div>
      )}

      {fase === "paga" && valor !== null && (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <PartyPopper className="w-8 h-8 text-zuvvi-volt" />
          <p className="text-sm font-bold text-white">Gorjeta de {formatMoney(valor)} enviada!</p>
          <p className="text-xs text-white/50">Obrigado por reconhecer o motorista.</p>
        </div>
      )}

      {(fase === "falhou" || fase === "erro_temporario") && (
        <div className="space-y-3 text-center">
          <p className="text-sm text-white/60">Não foi possível confirmar o pagamento da gorjeta.</p>
          <button
            type="button"
            onClick={() => gorjetaId && void gerarCobranca(gorjetaId)}
            className="w-full py-3 rounded-2xl border border-white/10 bg-white/5 text-white text-[10px] font-black uppercase tracking-[0.2em] active:scale-95 transition-all"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
