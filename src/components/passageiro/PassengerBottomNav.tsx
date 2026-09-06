import { Link } from "@tanstack/react-router";
import { Bike, Clock, CreditCard, User } from "lucide-react";

type PassengerTab = "inicio" | "corridas" | "carteira" | "perfil";

type PassengerBottomNavProps = {
  active: PassengerTab;
};

const items = [
  { key: "inicio", label: "Início", to: "/", Icon: Bike },
  { key: "corridas", label: "Corridas", to: "/corridas", Icon: Clock },
  { key: "carteira", label: "Carteira", to: "/carteira", Icon: CreditCard },
  { key: "perfil", label: "Perfil", to: "/perfil", Icon: User },
] as const;

export function PassengerBottomNav({ active }: PassengerBottomNavProps) {
  return (
    <nav
      aria-label="Navegação principal do passageiro"
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
