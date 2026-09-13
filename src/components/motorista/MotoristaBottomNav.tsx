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

// Mesmo tratamento do cabeçalho do motorista (barra reta colada na borda, só
// com uma linha fina de separação) — não a pílula flutuante com contorno
// completo, que o usuário pediu pra tirar.
export function MotoristaBottomNav({ active }: MotoristaBottomNavProps) {
  return (
    <nav
      aria-label="Navegação principal do motorista"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-zuvvi-indigo/90 backdrop-blur-xl px-6 pt-3"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {items.map(({ key, label, to, Icon }) => {
          const isActive = active === key;

          return (
            <Link
              key={key}
              to={to}
              aria-current={isActive ? "page" : undefined}
              aria-label={key === "perfil" ? "Abrir perfil do motorista" : undefined}
              className={`flex-1 py-1 flex flex-col items-center justify-center gap-1 transition-colors ${
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
