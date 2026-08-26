import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clipboard,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  getPagamentoPixPassageiroStatus,
  type PagamentoPixTelaSnapshot,
  type PagamentoPixTelaStatus,
} from "@/lib/pagamento-pix-status.functions";

const searchSchema = z.object({ rideId: z.string().uuid() });

export const Route = createFileRoute("/pagamento-pix")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: PagamentoPixPassageiro,
});

const POLL_INTERVALS: Record<PagamentoPixTelaStatus, number | null> = {
  gerando: 1500,
  aguardando: 5000,
  analisando: 2500,
  pago: null,
  expirado: null,
  falhou: null,
  estornado: null,
};

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCountdown(seconds: number | null) {
  if (seconds === null) return "--:--";
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function PagamentoPixPassageiro() {
  const { rideId } = Route.useSearch();
  const navigate = useNavigate();
  const { isOnline, wasOffline } = useOnlineStatus();
  const getStatusFn = useServerFn(getPagamentoPixPassageiroStatus);

  const [snapshot, setSnapshot] = useState<PagamentoPixTelaSnapshot | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const syncInFlightRef = useRef(false);
  const syncGenerationRef = useRef(0);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paidRedirectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zeroRefreshRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const clearPoll = () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  };

  const syncStatus = useCallback(
    async (manual = false) => {
      if (syncInFlightRef.current || !isOnline) return;
      syncInFlightRef.current = true;
      const generation = ++syncGenerationRef.current;
      if (manual) setIsRefreshing(true);

      try {
        const data = await getStatusFn({ data: { rideId } });
        if (generation !== syncGenerationRef.current) return;
        setSnapshot(data);
        setRemainingSeconds(data.remainingSeconds);
        setFatalError(null);
        hasLoadedRef.current = true;
        zeroRefreshRef.current = (data.remainingSeconds ?? 1) <= 0;
      } catch {
        if (generation !== syncGenerationRef.current) return;
        if (!hasLoadedRef.current) {
          setFatalError("Não foi possível carregar este pagamento Pix.");
        } else {
          toast.error("Não foi possível atualizar o Pix agora.");
        }
      } finally {
        if (generation === syncGenerationRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
        syncInFlightRef.current = false;
      }
    },
    [getStatusFn, isOnline, rideId],
  );

  useEffect(() => {
    void syncStatus();
  }, [syncStatus]);

  useEffect(() => {
    clearPoll();
    if (!snapshot || !isOnline) return undefined;

    const interval = POLL_INTERVALS[snapshot.status];
    if (interval === null) return undefined;

    pollTimeoutRef.current = setTimeout(() => {
      void syncStatus();
    }, interval);

    return clearPoll;
  }, [snapshot, isOnline, syncStatus]);

  useEffect(() => {
    if (remainingSeconds === null || remainingSeconds <= 0) return undefined;

    const interval = setInterval(() => {
      setRemainingSeconds((current) => {
        if (current === null) return null;
        return Math.max(0, current - 1);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [snapshot?.deadlineAt, remainingSeconds === null]);

  useEffect(() => {
    if (remainingSeconds !== 0 || zeroRefreshRef.current || !isOnline) return;
    zeroRefreshRef.current = true;
    void syncStatus();
  }, [remainingSeconds, isOnline, syncStatus]);

  useEffect(() => {
    if (!isOnline || !hasLoadedRef.current) return;
    void syncStatus();
  }, [isOnline, syncStatus]);

  useEffect(() => {
    const resyncWhenVisible = () => {
      if (document.visibilityState === "visible" && isOnline) void syncStatus();
    };
    const resyncOnPageShow = () => {
      if (isOnline) void syncStatus();
    };

    document.addEventListener("visibilitychange", resyncWhenVisible);
    window.addEventListener("pageshow", resyncOnPageShow);
    return () => {
      document.removeEventListener("visibilitychange", resyncWhenVisible);
      window.removeEventListener("pageshow", resyncOnPageShow);
    };
  }, [isOnline, syncStatus]);

  useEffect(() => {
    if (snapshot?.status !== "pago" || !snapshot.podeAcompanhar) return undefined;
    paidRedirectRef.current = setTimeout(() => {
      void navigate({ to: "/acompanhamento", search: { rideId } });
    }, 1800);
    return () => {
      if (paidRedirectRef.current) clearTimeout(paidRedirectRef.current);
    };
  }, [snapshot?.status, snapshot?.podeAcompanhar, navigate, rideId]);

  useEffect(() => {
    return () => {
      clearPoll();
      if (paidRedirectRef.current) clearTimeout(paidRedirectRef.current);
      syncGenerationRef.current += 1;
    };
  }, []);

  const copiarPix = async () => {
    if (!snapshot?.pixCopiaCola) return;
    try {
      await navigator.clipboard.writeText(snapshot.pixCopiaCola);
      setCopied(true);
      toast.success("Código Pix copiado!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar. Selecione o código manualmente.");
    }
  };

  const irParaAcompanhamento = () => {
    if (!snapshot?.podeAcompanhar) return;
    void navigate({ to: "/acompanhamento", search: { rideId } });
  };

  if (isLoading && !snapshot) {
    return (
      <div className="min-h-[100dvh] bg-zuvvi-indigo flex flex-col items-center justify-center gap-5 p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-zuvvi-volt/10 border border-zuvvi-volt/20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-zuvvi-volt animate-spin" />
        </div>
        <div>
          <p className="text-white text-lg font-black">Preparando pagamento Pix</p>
          <p className="text-white/55 text-sm mt-1">Estamos carregando os dados da sua corrida.</p>
        </div>
      </div>
    );
  }

  if (fatalError && !snapshot) {
    return (
      <div className="min-h-[100dvh] bg-zuvvi-indigo flex items-center justify-center p-6 font-poppins">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-7 text-center space-y-5">
          <AlertTriangle className="w-10 h-10 text-zuvvi-volt mx-auto" />
          <div>
            <h1 className="text-xl font-black text-white">Pagamento indisponível</h1>
            <p className="text-sm text-white/60 mt-2">{fatalError}</p>
          </div>
          <button
            type="button"
            onClick={() => void syncStatus(true)}
            disabled={!isOnline || isRefreshing}
            className="w-full min-h-12 rounded-2xl bg-zuvvi-volt text-zuvvi-indigo font-black disabled:opacity-50"
          >
            TENTAR NOVAMENTE
          </button>
        </div>
      </div>
    );
  }

  if (!snapshot) return null;

  const isPayable =
    (snapshot.status === "aguardando" || snapshot.status === "analisando") &&
    Boolean(snapshot.pixCopiaCola);

  return (
    <div className="min-h-[100dvh] bg-zuvvi-indigo text-white font-poppins overflow-y-auto">
      <header className="sticky top-0 z-20 bg-zuvvi-indigo/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto h-20 px-5 sm:px-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => void navigate({ to: "/procurando-motorista", search: { rideId } })}
            className="w-11 h-11 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-[10px] text-zuvvi-volt font-black uppercase tracking-[0.24em]">
              Zuvvi Moto
            </p>
            <h1 className="text-sm font-black uppercase tracking-wide">Pagamento Pix</h1>
          </div>
          <div className="w-11" aria-hidden="true" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 sm:px-6 py-7 sm:py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        {!isOnline && (
          <div
            className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 flex gap-3"
            role="status"
          >
            <WifiOff className="w-5 h-5 text-amber-200 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-50/90">
              Sem conexão. Se o QR já apareceu, você pode pagar normalmente. A confirmação será
              atualizada quando a internet voltar.
            </p>
          </div>
        )}

        {wasOffline && isOnline && (
          <div className="sr-only" aria-live="polite">
            Conexão restabelecida. Atualizando pagamento.
          </div>
        )}

        {snapshot.status === "pago" ? (
          <SuccessState valor={snapshot.valor} onContinue={irParaAcompanhamento} />
        ) : snapshot.status === "expirado" ? (
          <FinalState
            icon={<Clock3 className="w-9 h-9" />}
            title="Tempo para pagamento encerrado"
            description="Este código Pix não está mais disponível. Estamos finalizando esta solicitação com segurança."
          />
        ) : snapshot.status === "falhou" ? (
          <FinalState
            icon={<AlertTriangle className="w-9 h-9" />}
            title="Não foi possível concluir o Pix"
            description="A corrida não será liberada sem pagamento confirmado."
          />
        ) : snapshot.status === "estornado" ? (
          <FinalState
            icon={<RotateCcw className="w-9 h-9" />}
            title="Pagamento estornado"
            description="O pagamento desta corrida foi marcado como estornado."
          />
        ) : (
          <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-5 md:gap-7 items-stretch">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 sm:p-7 flex flex-col">
              <div className="text-center md:text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-zuvvi-volt/20 bg-zuvvi-volt/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-zuvvi-volt">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Motorista encontrado
                </div>
                <h2 className="mt-4 text-2xl sm:text-3xl font-black tracking-tight">
                  {snapshot.status === "gerando"
                    ? "Gerando seu Pix"
                    : snapshot.status === "analisando"
                      ? "Confirmando pagamento"
                      : "Pague para liberar sua corrida"}
                </h2>
                <p className="mt-2 text-sm text-white/55 leading-relaxed">
                  {snapshot.status === "gerando"
                    ? "Estamos preparando o pagamento na conta do motorista."
                    : snapshot.status === "analisando"
                      ? "Recebemos uma atualização e estamos aguardando a confirmação segura."
                      : "A corrida só será liberada depois que o pagamento for confirmado."}
                </p>
              </div>

              <div className="mt-7 rounded-2xl border border-white/10 bg-black/10 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                    Valor da corrida
                  </p>
                  <p className="text-2xl sm:text-3xl font-black text-white mt-1">
                    {formatMoney(snapshot.valor)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                    Tempo restante
                  </p>
                  <p className="text-2xl font-black tabular-nums text-zuvvi-volt mt-1">
                    {formatCountdown(remainingSeconds)}
                  </p>
                </div>
              </div>

              <div className="mt-auto pt-6 flex items-start gap-3 text-xs text-white/45 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-zuvvi-volt shrink-0 mt-0.5" />
                <p>
                  O pagamento é confirmado pelo servidor. Tocar em “Já paguei” apenas atualiza a
                  consulta.
                </p>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 sm:p-7">
              {snapshot.status === "gerando" || !isPayable ? (
                <div className="min-h-[390px] flex flex-col items-center justify-center text-center px-4">
                  <div className="w-20 h-20 rounded-[1.5rem] border border-zuvvi-volt/20 bg-zuvvi-volt/10 flex items-center justify-center">
                    <Loader2 className="w-9 h-9 text-zuvvi-volt animate-spin" />
                  </div>
                  <p className="mt-5 text-lg font-black">Preparando código Pix</p>
                  <p className="mt-2 text-sm text-white/50 max-w-xs">
                    Isso pode levar alguns instantes. Não feche a solicitação.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div
                    className="mx-auto w-fit bg-white p-4 rounded-3xl shadow-xl"
                    aria-label="QR Code do pagamento Pix"
                  >
                    <QRCodeSVG
                      value={snapshot.pixCopiaCola!}
                      size={220}
                      level="M"
                      marginSize={0}
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                      title="QR Code Pix da corrida"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="pix-code"
                      className="block text-[10px] font-black uppercase tracking-[0.16em] text-white/45 mb-2"
                    >
                      Pix Copia e Cola
                    </label>
                    <div
                      id="pix-code"
                      className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-xs text-white/65 break-all select-all max-h-24 overflow-y-auto"
                    >
                      {snapshot.pixCopiaCola}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void copiarPix()}
                    disabled={!isOnline && !snapshot.pixCopiaCola}
                    className="w-full min-h-14 rounded-2xl bg-zuvvi-volt text-zuvvi-indigo font-black uppercase tracking-[0.12em] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Clipboard className="w-5 h-5" />}
                    {copied ? "Código copiado" : "Copiar código Pix"}
                  </button>

                  {snapshot.ticketUrl && (
                    <a
                      href={snapshot.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full min-h-12 rounded-2xl border border-zuvvi-volt/30 bg-zuvvi-volt/10 text-zuvvi-volt font-black uppercase tracking-[0.08em] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Abrir Pix no Mercado Pago
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => void syncStatus(true)}
                    disabled={!isOnline || isRefreshing}
                    className="w-full min-h-12 rounded-2xl border border-white/10 bg-white/5 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    Já paguei
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function SuccessState({ valor, onContinue }: { valor: number; onContinue: () => void }) {
  return (
    <div className="max-w-lg mx-auto rounded-[2rem] border border-zuvvi-volt/25 bg-zuvvi-volt/10 p-7 sm:p-10 text-center">
      <div className="mx-auto w-20 h-20 rounded-full bg-zuvvi-volt text-zuvvi-indigo flex items-center justify-center shadow-[0_0_40px_rgba(198,255,61,0.24)]">
        <CheckCircle2 className="w-10 h-10" />
      </div>
      <p className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-zuvvi-volt">
        Pagamento confirmado
      </p>
      <h2 className="mt-2 text-3xl font-black">{formatMoney(valor)}</h2>
      <p className="mt-3 text-sm text-white/60">
        Tudo certo. Sua corrida foi liberada com segurança.
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="mt-7 w-full min-h-14 rounded-2xl bg-zuvvi-volt text-zuvvi-indigo font-black uppercase tracking-[0.12em]"
      >
        Acompanhar corrida
      </button>
    </div>
  );
}

function FinalState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-lg mx-auto rounded-[2rem] border border-white/10 bg-white/5 p-7 sm:p-10 text-center">
      <div className="mx-auto w-20 h-20 rounded-full bg-white/5 border border-white/10 text-zuvvi-volt flex items-center justify-center">
        {icon}
      </div>
      <h2 className="mt-6 text-2xl font-black">{title}</h2>
      <p className="mt-3 text-sm text-white/55 leading-relaxed">{description}</p>
    </div>
  );
}
