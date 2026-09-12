import { Link } from "@tanstack/react-router";
import { Bike, Clock, User } from "lucide-react";

type MotoristaTab = "corrida" | "ganhos" | "perfil";

type MotoristaBottomNavProps = {
  active: MotoristaTab;
};

const items = [
  { key: "corrida", label: "Corrida", to: "/home-motorista", Icon: Bike },
  { key: "ganhos", label: "Ganhos", to: "/ganhos-motorista", Icon: Clock },
  { key: "perfil", label: "Perfil", to: "/perfil-motorista", Icon: User },
] as const;

export function MotoristaBottomNav({ active }: MotoristaBottomNavProps) {
  return (
    <nav
      aria-label="Navegação principal do motorista"
      className="fixed bottom-0 left-0 right-0 z-40 bg-zuvvi-indigo/95 backdrop-blur-xl border-t border-white/10 px-5 pt-3"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-md flex items-center justify-around rounded-[1.75rem] border border-white/5 bg-white/[0.025] px-1 py-1.5">
        {items.map(({ key, label, to, Icon }) => {
          const isActive = active === key;

          return (
            <Link
              key={key}
              to={to}
              aria-current={isActive ? "page" : undefined}
              aria-label={key === "perfil" ? "Abrir perfil do motorista" : undefined}
              className={`min-h-12 min-w-16 px-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
                isActive
                  ? "bg-zuvvi-volt/10 border border-zuvvi-volt/20 text-zuvvi-volt shadow-[0_0_24px_rgba(198,255,61,0.08)]"
                  : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.035]"
              }`}
            >
              <Icon className="w-5.5 h-5.5" strokeWidth={isActive ? 2.5 : 2} />
              <span
                className={`text-[9px] uppercase tracking-wider ${
                  isActive ? "font-black" : "font-bold"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
