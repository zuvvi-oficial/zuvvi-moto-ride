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
      className="fixed bottom-0 left-0 right-0 z-40 bg-zuvvi-indigo/95 backdrop-blur-xl border-t border-white/10 px-5 pt-4"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-md flex items-center justify-around">
        {items.map(({ key, label, to, Icon }) => {
          const isActive = active === key;

          return (
            <Link
              key={key}
              to={to}
              aria-current={isActive ? "page" : undefined}
              className={`min-h-11 min-w-16 flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive
                  ? "text-zuvvi-volt"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
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
