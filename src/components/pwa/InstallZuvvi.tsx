import { useCallback, useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import { usePwaDisplayMode } from "@/hooks/use-pwa-display-mode";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "zuvvi:install-dismissed-at";
const DISMISS_DAYS = 14;
const INTERACTION_DELAY_MS = 20000;

function wasRecentlyDismissed() {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Contextual, non-intrusive "Instalar Zuvvi" promotion.
 * Android/Chromium uses beforeinstallprompt; iOS Safari gets short guidance.
 */
export function InstallZuvvi() {
  const { isInstalled, isIos, isSafari, isHydrated } = usePwaDisplayMode();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDismissed(wasRecentlyDismissed());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Only promote after the user had time to interact with the app.
    const timer = window.setTimeout(() => setReady(true), INTERACTION_DELAY_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setShowIosHelp(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const install = useCallback(async () => {
    if (isIos && !promptEvent) {
      setShowIosHelp(true);
      return;
    }
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    if (choice.outcome === "dismissed") dismiss();
  }, [dismiss, isIos, promptEvent]);

  const canPromote =
    isHydrated &&
    ready &&
    !installed &&
    !isInstalled &&
    !dismissed &&
    (Boolean(promptEvent) || (isIos && isSafari));

  if (!canPromote) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[90] px-4 pointer-events-none"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-md pointer-events-auto animate-rise rounded-3xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-card-foreground">Instalar Zuvvi</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tenha o Zuvvi na tela inicial do seu celular.
            </p>

            {showIosHelp && (
              <div className="mt-3 space-y-2 rounded-2xl border border-border bg-background/60 p-3">
                <p className="flex items-center gap-2 text-xs text-card-foreground">
                  <Share className="h-4 w-4 text-primary" /> Toque em Compartilhar
                </p>
                <p className="flex items-center gap-2 text-xs text-card-foreground">
                  <Plus className="h-4 w-4 text-primary" /> Depois em “Adicionar à Tela de Início”
                </p>
              </div>
            )}

            {!showIosHelp && (
              <button
                type="button"
                onClick={install}
                className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-xs font-black uppercase tracking-widest text-primary-foreground transition-transform active:scale-95"
              >
                Instalar Zuvvi
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fechar aviso de instalação"
            className="rounded-full p-1 text-muted-foreground transition-colors hover:text-card-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
