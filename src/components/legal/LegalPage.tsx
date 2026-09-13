import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

export function LegalPageShell({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zuvvi-indigo-dark text-foreground flex flex-col pb-14">
      <header className="sticky top-0 z-50 bg-zuvvi-indigo/90 backdrop-blur-xl border-b border-white/10 px-5 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            aria-label="Voltar"
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 transition-colors hover:bg-white/10"
          >
            <ChevronLeft className="w-6 h-6 text-zuvvi-volt" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">{titulo}</h1>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-5 py-8 space-y-8 animate-rise">
        {children}
      </main>
    </div>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zuvvi-volt">{titulo}</p>
      <div className="space-y-3 text-sm leading-relaxed text-white/80">{children}</div>
    </section>
  );
}

export function Lista({ itens }: { itens: string[] }) {
  return (
    <ul className="space-y-2">
      {itens.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zuvvi-volt" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
