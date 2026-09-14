import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { onServiceWorkerUpdate } from "@/lib/pwa/register-sw";

/**
 * Discreet "nova versão disponível" notice. The reload is always user-triggered,
 * so an active ride is never interrupted abruptly.
 */
export function UpdatePrompt() {
  const [applyUpdate, setApplyUpdate] = useState<(() => Promise<void>) | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => onServiceWorkerUpdate((update) => setApplyUpdate(() => update)), []);

  if (!applyUpdate) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[96] flex justify-center px-4 pointer-events-none"
      style={{ bottom: "calc(6rem + env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-xl backdrop-blur-md">
        <p className="text-xs font-bold text-card-foreground">Nova versão disponível</p>
        <button
          type="button"
          disabled={isUpdating}
          onClick={async () => {
            setIsUpdating(true);

            // O recarregamento correto só deve acontecer DEPOIS que o novo
            // service worker realmente assumir o controle da página — esse
            // evento avisa exatamente esse momento. Um timeout fixo curto
            // (testado antes) corria à frente dessa troca em vez de esperar
            // por ela: recarregava a página cedo demais, no meio da troca,
            // fazendo a atualização nunca "pegar" de verdade e o aviso voltar
            // a aparecer em seguida. Esperar o evento real evita isso.
            let jaRecarregou = false;
            const recarregarUmaVez = () => {
              if (jaRecarregou) return;
              jaRecarregou = true;
              window.location.reload();
            };
            navigator.serviceWorker.addEventListener("controllerchange", recarregarUmaVez, {
              once: true,
            });

            // Rede de segurança apenas para o caso (raro) de esse evento nunca
            // chegar a disparar — bem mais folgada que antes, para nunca
            // atropelar a troca real ainda em andamento.
            const forcarRecarregamento = window.setTimeout(recarregarUmaVez, 15000);

            try {
              await applyUpdate();
            } catch {
              window.clearTimeout(forcarRecarregamento);
              recarregarUmaVez();
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary-foreground transition-transform active:scale-95 disabled:opacity-60"
        >
          <RefreshCw className={`h-3 w-3 ${isUpdating ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>
    </div>
  );
}
