/**
 * Observabilidade mínima de erros do navegador para produção.
 *
 * reportLovableError (lovable-error-reporting.ts) só entrega em
 * window.__lovableEvents/__lovableReportRuntimeError, hooks que só existem
 * dentro do preview do editor Lovable — em produção, para um usuário real,
 * eles são no-op. Este módulo é aditivo, não substitui aquele: encaminha o
 * mesmo tipo de evento também para o log estruturado do servidor
 * (registrarErroCliente), que qualquer ambiente real consegue observar.
 */
import { registrarErroCliente } from "./client-error-report.functions";

type Mechanism = "onerror" | "unhandledrejection" | "react_error_boundary";

const LIMITE_POR_SESSAO = 5;
let enviados = 0;
let instalado = false;

function enviar(message: string, stack: string | undefined, mechanism: Mechanism) {
  if (enviados >= LIMITE_POR_SESSAO) return;
  enviados++;

  registrarErroCliente({
    data: {
      message: message.slice(0, 2000),
      stack: stack?.slice(0, 4000),
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
      mechanism,
    },
  }).catch(() => {
    // Falha ao reportar erro nunca deve, ela mesma, virar um novo erro visível ao usuário.
  });
}

export function reportClientError(error: unknown, mechanism: Mechanism): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  enviar(message, stack, mechanism);
}

export function installGlobalErrorReporting(): void {
  if (instalado || typeof window === "undefined") return;
  instalado = true;

  window.addEventListener("error", (event) => {
    reportClientError(event.error ?? event.message, "onerror");
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportClientError(event.reason, "unhandledrejection");
  });
}
