import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, CheckCircle2, Clock3, Copy, Loader2, QrCode, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { criarCobrancaPix } from "@/lib/pagamento.functions";
import {
  cancelarCorridaPix,
  consultarStatusPixPassageiro,
  getPixGate,
  regenerarCobrancaPix,
} from "@/lib/pix-passageiro.functions";

type GateState = "checking" | "pass" | "pix" | "error";
type ScreenState = "generating" | "ready" | "confirmed" | "expired" | "failed";

type PixStatus =
  | { state: "awaiting_charge" }
  | { state: "pending"; expiresAt: string; qrCode: string; qrCodeBase64: string }
  | { state: "confirmed" }
  | { state: "expired" }
  | { state: "failed"; message: string };

type ChargeData = {
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
};

const POLLING_INTERVAL_MS = 3_000;

function formatRemainingTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function PixAcompanhamentoGate({
  rideId,
  children,
}: {
  rideId: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const getGateFn = useServerFn(getPixGate);
  const [gateState, setGateState] = useState<GateState>("checking");
  const [gateError, setGateError] = useState("");

  const checkGate = useCallback(async () => {
    setGateState("checking");
    setGateError("");
    try {
      const gate = await getGateFn({ data: { rideId } });
      if (gate.isPix && gate.cancelada) {
        void navigate({ to: "/" });
        return;
      }
      setGateState(!gate.isPix || gate.liberado ? "pass" : "pix");
    } catch (error) {
      console.error("[Pix] Falha ao validar etapa de pagamento:", error);
      setGateError("Não foi possível validar o pagamento desta corrida.");
      setGateState("error");
    }
  }, [getGateFn, navigate, rideId]);

  useEffect(() => {
    void checkGate();
  }, [checkGate]);

  if (gateState === "pass") return <>{children}</>;
  if (gateState === "pix") {
    return <PixPaymentScreen rideId={rideId} onConfirmed={() => setGateState("pass")} />;
  }

  if (gateState === "error") {
    return (
      <PixShell>
        <CenteredState
          icon={<XCircle className="h-14 w-14 text-red-400" />}
          title="Não foi possível validar o Pix"
          description={gateError}
          action={
            <Button
              type="button"
              onClick={() => void checkGate()}
              className="zuvvi-glow h-14 w-full rounded-2xl bg-zuvvi-volt font-black uppercase tracking-[0.2em] text-zuvvi-indigo hover:bg-zuvvi-volt/90"
            >
              Tentar novamente
            </Button>
          }
        />
      </PixShell>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-zuvvi-indigo flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-zuvvi-volt" />
    </div>
  );
}

function PixPaymentScreen({ rideId, onConfirmed }: { rideId: string; onConfirmed: () => void }) {
  const navigate = useNavigate();
  const consultarFn = useServerFn(consultarStatusPixPassageiro);
  const criarFn = useServerFn(criarCobrancaPix);
  const regenerarFn = useServerFn(regenerarCobrancaPix);
  const cancelarFn = useServerFn(cancelarCorridaPix);

  const [screenState, setScreenState] = useState<ScreenState>("generating");
  const [charge, setCharge] = useState<ChargeData | null>(null);
  const [remainingMs, setRemainingMs] = useState(5 * 60 * 1000);
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const requestInFlightRef = useRef(false);

  const applyStatus = useCallback(
    (status: PixStatus) => {
      if (status.state === "confirmed") {
        setScreenState("confirmed");
        window.setTimeout(onConfirmed, 700);
        return;
      }
      if (status.state === "expired") {
        setCharge(null);
        setRemainingMs(0);
        setScreenState("expired");
        return;
      }
      if (status.state === "failed") {
        setCharge(null);
        setErrorMessage(status.message || "A cobrança Pix não foi aprovada.");
        setScreenState("failed");
        return;
      }
      if (status.state === "pending") {
        setCharge({ qrCode: status.qrCode, qrCodeBase64: status.qrCodeBase64, expiresAt: status.expiresAt });
        setRemainingMs(Math.max(0, Date.parse(status.expiresAt) - Date.now()));
        setScreenState("ready");
        return;
      }
      setScreenState("generating");
    },
    [onConfirmed],
  );

  const prepareCharge = useCallback(async () => {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setErrorMessage("");
    try {
      let status = await consultarFn({ data: { rideId } });
      if (status.state === "awaiting_charge") {
        await criarFn({ data: { rideId } });
        status = await consultarFn({ data: { rideId } });
      }
      applyStatus(status);
    } catch (error) {
      console.error("[Pix] Falha ao preparar cobrança:", error);
      setErrorMessage("Não foi possível gerar a cobrança Pix. Tente novamente.");
      setScreenState("failed");
    } finally {
      requestInFlightRef.current = false;
    }
  }, [applyStatus, consultarFn, criarFn, rideId]);

  useEffect(() => {
    void prepareCharge();
  }, [prepareCharge]);

  useEffect(() => {
    if (screenState !== "ready" || !charge) return;
    const updateCountdown = () => {
      setRemainingMs(Math.max(0, Date.parse(charge.expiresAt) - Date.now()));
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1_000);
    return () => window.clearInterval(timer);
  }, [charge, screenState]);

  useEffect(() => {
    if (screenState !== "generating" && screenState !== "ready") return;
    let active = true;
    let inFlight = false;

    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const status = await consultarFn({ data: { rideId } });
        if (active) applyStatus(status);
      } catch (error) {
        console.error("[Pix] Falha no polling:", error);
        // Falha transitória não derruba a tela nem libera acompanhamento.
      } finally {
        inFlight = false;
      }
    };

    const timer = window.setInterval(() => void poll(), POLLING_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [applyStatus, consultarFn, rideId, screenState]);

  const handleCopy = async () => {
    if (!charge?.qrCode) return;
    try {
      await navigator.clipboard.writeText(charge.qrCode);
      setCopied(true);
      toast.success("Código Pix copiado.");
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o código manualmente.");
    }
  };

  const handleRegenerate = async () => {
    if (isRegenerating) return;
    setIsRegenerating(true);
    setErrorMessage("");
    try {
      await regenerarFn({ data: { rideId } });
      const status = await consultarFn({ data: { rideId } });
      applyStatus(status);
      toast.success("Novo Pix gerado com segurança.");
    } catch (error) {
      console.error("[Pix] Falha ao regenerar cobrança:", error);
      setErrorMessage("Não foi possível gerar um novo Pix. Tente novamente.");
      setScreenState("failed");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      const result = await cancelarFn({ data: { rideId } });
      if (result.paid) {
        setShowCancelDialog(false);
        setScreenState("confirmed");
        onConfirmed();
        return;
      }
      toast.success("Corrida cancelada.");
      void navigate({ to: "/" });
    } catch (error) {
      console.error("[Pix] Falha ao cancelar corrida:", error);
      toast.error("Não foi possível cancelar a corrida. Tente novamente.");
      setShowCancelDialog(false);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <PixShell>
      {screenState === "generating" && (
        <CenteredState
          icon={<Loader2 className="h-12 w-12 animate-spin text-zuvvi-volt" />}
          title="Gerando cobrança"
          description="Estamos preparando seu Pix com segurança."
        />
      )}

      {screenState === "ready" && charge && (
        <div className="space-y-6">
          <header className="space-y-2 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-zuvvi-volt/30 bg-zuvvi-volt/10">
              <QrCode className="h-7 w-7 text-zuvvi-volt" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-zuvvi-volt">Pagamento Pix</p>
            <h1 className="text-2xl font-black">Escaneie para pagar</h1>
            <p className="text-sm text-white/60">O acompanhamento será liberado automaticamente após a confirmação.</p>
          </header>

          <div className="mx-auto w-fit rounded-3xl bg-white p-4 shadow-xl">
            <img
              src={charge.qrCodeBase64.startsWith("data:") ? charge.qrCodeBase64 : `data:image/png;base64,${charge.qrCodeBase64}`}
              alt="QR Code Pix da corrida"
              className="h-52 w-52"
            />
          </div>

          <div className="flex items-center justify-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-amber-300">
            <Clock3 className="h-5 w-5" />
            <span className="text-xs font-black uppercase tracking-widest">Expira em {formatRemainingTime(remainingMs)}</span>
          </div>

          <div className="space-y-2">
            <label htmlFor="pix-copy-code" className="text-xs font-bold uppercase tracking-widest text-white/50">Pix copia e cola</label>
            <textarea
              id="pix-copy-code"
              value={charge.qrCode}
              readOnly
              rows={3}
              className="w-full resize-none rounded-2xl border border-white/10 bg-zuvvi-indigo/70 p-4 text-xs text-white outline-none focus:border-zuvvi-volt/50"
            />
          </div>

          <Button
            type="button"
            onClick={() => void handleCopy()}
            className="zuvvi-glow h-14 w-full rounded-2xl bg-zuvvi-volt font-black uppercase tracking-[0.2em] text-zuvvi-indigo hover:bg-zuvvi-volt/90"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Código copiado" : "Copiar código Pix"}
          </Button>

          <p className="text-center text-xs leading-relaxed text-white/50">A confirmação é verificada automaticamente. O QR é invalidado ao fim do prazo de 5 minutos.</p>
        </div>
      )}

      {screenState === "confirmed" && (
        <CenteredState
          icon={<CheckCircle2 className="h-14 w-14 text-zuvvi-volt" />}
          title="Pagamento confirmado"
          description="Tudo certo. Liberando o acompanhamento da sua corrida."
        />
      )}

      {screenState === "expired" && (
        <CenteredState
          icon={<AlertTriangle className="h-14 w-14 text-amber-300" />}
          title="Pix expirado"
          description="O prazo de 5 minutos terminou. O código anterior foi invalidado e não deve mais ser pago."
          action={
            <div className="w-full space-y-3">
              <Button
                type="button"
                onClick={() => void handleRegenerate()}
                disabled={isRegenerating}
                className="zuvvi-glow h-14 w-full rounded-2xl bg-zuvvi-volt font-black uppercase tracking-[0.15em] text-zuvvi-indigo hover:bg-zuvvi-volt/90"
              >
                {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Gerar novo Pix
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCancelDialog(true)}
                className="h-12 w-full rounded-2xl border-white/10 bg-transparent font-black uppercase tracking-widest text-white hover:bg-white/5 hover:text-white"
              >
                Cancelar corrida
              </Button>
            </div>
          }
        />
      )}

      {screenState === "failed" && (
        <CenteredState
          icon={<XCircle className="h-14 w-14 text-red-400" />}
          title="Pagamento indisponível"
          description={errorMessage || "Não foi possível concluir esta cobrança Pix."}
          action={
            <div className="w-full space-y-3">
              <Button
                type="button"
                onClick={() => void prepareCharge()}
                className="zuvvi-glow h-14 w-full rounded-2xl bg-zuvvi-volt font-black uppercase tracking-[0.2em] text-zuvvi-indigo hover:bg-zuvvi-volt/90"
              >
                Tentar novamente
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCancelDialog(true)}
                className="h-12 w-full rounded-2xl border-white/10 bg-transparent font-black uppercase tracking-widest text-white hover:bg-white/5 hover:text-white"
              >
                Cancelar corrida
              </Button>
            </div>
          }
        />
      )}

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-3xl border-white/10 bg-zuvvi-indigo text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar esta corrida?</DialogTitle>
            <DialogDescription>Antes de cancelar, o sistema confere novamente o Mercado Pago. Se o Pix tiver sido aprovado nesse instante, a corrida será liberada em vez de cancelada.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => setShowCancelDialog(false)} disabled={isCancelling} className="border-white/10 bg-transparent text-white hover:bg-white/5 hover:text-white">Voltar</Button>
            <Button type="button" variant="destructive" onClick={() => void handleCancel()} disabled={isCancelling}>
              {isCancelling && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PixShell>
  );
}

function PixShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-zuvvi-indigo px-5 py-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] font-poppins text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md items-center justify-center">
        <section className="animate-rise w-full rounded-[2.5rem] border border-white/10 bg-zuvvi-indigo/90 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
          {children}
        </section>
      </div>
    </main>
  );
}

function CenteredState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center space-y-5 text-center">
      {icon}
      <div className="space-y-2">
        <h1 className="text-2xl font-black">{title}</h1>
        <p className="text-sm leading-relaxed text-white/60">{description}</p>
      </div>
      {action && <div className="w-full pt-2">{action}</div>}
    </div>
  );
}
