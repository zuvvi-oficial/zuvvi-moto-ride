import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Loader2,
  QrCode,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  consultarStatusPagamentoPix,
  PIX_PAYMENT_TIMEOUT_MS,
  type PixPaymentStatus,
} from "@/lib/pagamento-pix-status.functions";
import { cancelarCorrida } from "@/lib/user.functions";

const POLLING_INTERVAL_MS = 3_000;

const searchSchema = z.object({
  rideId: z.string().uuid(),
});

type ScreenState = "generating" | "ready" | "confirmed" | "expired" | "failed";

type ChargeData = {
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
};

export const Route = createFileRoute("/pagamento-pix")({
  validateSearch: (search) => searchSchema.parse(search),
  component: PagamentoPix,
});

function formatRemainingTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function PagamentoPix() {
  const { rideId } = Route.useSearch();
  const navigate = useNavigate();
  const consultarStatusPagamentoPixFn = useServerFn(consultarStatusPagamentoPix);
  const cancelarCorridaFn = useServerFn(cancelarCorrida);
  const [screenState, setScreenState] = useState<ScreenState>("generating");
  const [charge, setCharge] = useState<ChargeData | null>(null);
  const [remainingMs, setRemainingMs] = useState(PIX_PAYMENT_TIMEOUT_MS);
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const requestInFlightRef = useRef(false);

  const applyPaymentStatus = useCallback((status: PixPaymentStatus) => {
    if (status.state === "awaiting_charge") {
      setScreenState("generating");
      return;
    }

    if (status.state === "confirmed") {
      setScreenState("confirmed");
      return;
    }

    if (status.state === "expired") {
      setScreenState("expired");
      return;
    }

    if (status.state === "failed") {
      setErrorMessage("O pagamento não foi aprovado. Você pode cancelar esta corrida.");
      setScreenState("failed");
      return;
    }

    if (status.state === "pending") {
      setCharge({
        qrCode: status.qrCode,
        qrCodeBase64: status.qrCodeBase64,
        expiresAt: status.expiresAt,
      });
      setScreenState("ready");
    }
  }, []);

  const loadChargeStatus = useCallback(async () => {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setScreenState("generating");
    setErrorMessage("");

    try {
      const currentStatus = await consultarStatusPagamentoPixFn({ data: { rideId } });
      applyPaymentStatus(currentStatus);
    } catch (error) {
      console.error("[Pagamento Pix] Falha ao preparar cobrança:", error);
      setErrorMessage("Não foi possível gerar a cobrança Pix. Tente novamente.");
      setScreenState("failed");
    } finally {
      requestInFlightRef.current = false;
    }
  }, [applyPaymentStatus, consultarStatusPagamentoPixFn, rideId]);

  useEffect(() => {
    void loadChargeStatus();
  }, [loadChargeStatus]);

  useEffect(() => {
    if (screenState !== "ready" || !charge) return;

    const updateCountdown = () => {
      const nextRemainingMs = new Date(charge.expiresAt).getTime() - Date.now();
      setRemainingMs(Math.max(0, nextRemainingMs));
      if (nextRemainingMs <= 0) setScreenState("expired");
    };

    updateCountdown();
    const countdownInterval = window.setInterval(updateCountdown, 1_000);
    return () => window.clearInterval(countdownInterval);
  }, [charge, screenState]);

  useEffect(() => {
    if (screenState !== "generating" && screenState !== "ready") return;

    let active = true;
    let pollInFlight = false;

    const poll = async () => {
      if (pollInFlight) return;
      pollInFlight = true;
      try {
        const status = await consultarStatusPagamentoPixFn({ data: { rideId } });
        if (active) applyPaymentStatus(status);
      } catch (error) {
        console.error("[Pagamento Pix] Falha no polling:", error);
        if (active) {
          setErrorMessage("Não foi possível atualizar o pagamento. Tente novamente.");
          setScreenState("failed");
        }
      } finally {
        pollInFlight = false;
      }
    };

    const pollingInterval = window.setInterval(() => void poll(), POLLING_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(pollingInterval);
    };
  }, [applyPaymentStatus, consultarStatusPagamentoPixFn, rideId, screenState]);

  useEffect(() => {
    if (screenState !== "confirmed") return;
    const navigationTimer = window.setTimeout(() => {
      navigate({ to: "/acompanhamento", search: { rideId } });
    }, 1_400);
    return () => window.clearTimeout(navigationTimer);
  }, [navigate, rideId, screenState]);

  const handleCopy = async () => {
    if (!charge?.qrCode) return;
    try {
      await navigator.clipboard.writeText(charge.qrCode);
      setCopied(true);
      toast.success("Código Pix copiado.");
      window.setTimeout(() => setCopied(false), 2_000);
    } catch (error) {
      console.error("[Pagamento Pix] Falha ao copiar código:", error);
      toast.error("Não foi possível copiar. Selecione o código manualmente.");
    }
  };

  const handleCancelRide = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await cancelarCorridaFn({ data: { rideId } });
      toast.success("Corrida cancelada.");
      navigate({ to: "/" });
    } catch (error) {
      console.error("[Pagamento Pix] Falha ao cancelar corrida:", error);
      toast.error("Não foi possível cancelar a corrida. Tente novamente.");
      setShowCancelDialog(false);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-zuvvi-indigo px-5 py-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] font-poppins text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md items-center justify-center">
        <section className="animate-rise w-full rounded-[2.5rem] border border-white/10 bg-zuvvi-indigo/90 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
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
                <p className="text-xs font-black uppercase tracking-widest text-zuvvi-volt">
                  Pagamento Pix
                </p>
                <h1 className="text-2xl font-black">Escaneie para pagar</h1>
                <p className="text-sm text-muted-foreground">
                  O acompanhamento será liberado após a confirmação.
                </p>
              </header>

              <div className="mx-auto w-fit rounded-3xl bg-white p-4 shadow-xl">
                <img
                  src={
                    charge.qrCodeBase64.startsWith("data:")
                      ? charge.qrCodeBase64
                      : `data:image/png;base64,${charge.qrCodeBase64}`
                  }
                  alt="QR Code para pagamento Pix da corrida"
                  className="h-52 w-52"
                />
              </div>

              <div className="flex items-center justify-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-amber-400">
                <Clock3 className="h-5 w-5" />
                <span className="text-xs font-black uppercase tracking-widest">
                  Expira em {formatRemainingTime(remainingMs)}
                </span>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="pix-copy-code"
                  className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
                >
                  Pix copia e cola
                </label>
                <textarea
                  id="pix-copy-code"
                  value={charge.qrCode}
                  readOnly
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-zuvvi-indigo-dark/80 p-4 text-xs text-white outline-none focus:border-zuvvi-volt/50"
                />
              </div>

              <Button
                type="button"
                onClick={handleCopy}
                className="zuvvi-glow h-14 w-full rounded-2xl bg-zuvvi-volt font-black uppercase tracking-[0.2em] text-zuvvi-indigo hover:bg-zuvvi-volt/90"
              >
                {copied ? <Check /> : <Copy />}
                {copied ? "Código copiado" : "Copiar código Pix"}
              </Button>

              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                A confirmação é verificada automaticamente. Não feche esta tela até concluir.
              </p>
            </div>
          )}

          {screenState === "confirmed" && (
            <CenteredState
              icon={<CheckCircle2 className="h-14 w-14 text-zuvvi-volt" />}
              title="Pagamento confirmado"
              description="Tudo certo. Abrindo o acompanhamento da sua corrida."
            />
          )}

          {screenState === "expired" && (
            <CenteredState
              icon={<AlertTriangle className="h-14 w-14 text-amber-400" />}
              title="Prazo expirado"
              description="O Pix não foi confirmado dentro de 5 minutos. Cancele esta corrida para voltar ao início."
              action={
                <Button
                  type="button"
                  onClick={() => setShowCancelDialog(true)}
                  className="h-14 w-full rounded-2xl bg-amber-400 font-black uppercase tracking-[0.2em] text-zuvvi-indigo hover:bg-amber-400/90"
                >
                  Cancelar corrida
                </Button>
              }
            />
          )}

          {screenState === "failed" && (
            <CenteredState
              icon={<XCircle className="h-14 w-14 text-red-400" />}
              title="Pagamento indisponível"
              description={errorMessage}
              action={
                <div className="w-full space-y-3">
                  <Button
                    type="button"
                    onClick={() => void loadChargeStatus()}
                    disabled={requestInFlightRef.current}
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
        </section>
      </div>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-3xl border-white/10 bg-zuvvi-indigo-dark text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar esta corrida?</DialogTitle>
            <DialogDescription>
              O pagamento não foi confirmado. Ao cancelar, você voltará para a tela inicial.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={isCancelling}
              className="border-white/10 bg-transparent text-white hover:bg-white/5 hover:text-white"
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleCancelRide()}
              disabled={isCancelling}
            >
              {isCancelling && <Loader2 className="animate-spin" />}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function CenteredState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center space-y-5 text-center">
      {icon}
      <div className="space-y-2">
        <h1 className="text-2xl font-black">{title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action && <div className="w-full pt-2">{action}</div>}
    </div>
  );
}
