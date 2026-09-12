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

// Mesma pílula flutuante com blur usada em todo o app do motorista (cabeçalho,
// badges do mapa, etc.) — não o cartão colado na borda usado do lado do
// passageiro, que destoou do resto da tela do motorista.
export function MotoristaBottomNav({ active }: MotoristaBottomNavProps) {
  return (
    <nav
      aria-label="Navegação principal do motorista"
      className="fixed bottom-0 left-0 right-0 px-6 z-40 pointer-events-none"
      style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))", paddingTop: "1.5rem" }}
    >
      <div className="max-w-md mx-auto bg-zuvvi-indigo/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-4 flex items-center justify-around pointer-events-auto shadow-2xl">
        {items.map(({ key, label, to, Icon }) => {
          const isActive = active === key;

          return (
            <Link
              key={key}
              to={to}
              aria-current={isActive ? "page" : undefined}
              aria-label={key === "perfil" ? "Abrir perfil do motorista" : undefined}
              className={`flex flex-col items-center gap-1 transition-colors ${
                isActive ? "text-zuvvi-volt" : "text-muted-foreground hover:text-white"
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
