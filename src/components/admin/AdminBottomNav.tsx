import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Users, Bike, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminBottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  const items = [
    {
      label: "Início",
      icon: LayoutDashboard,
      to: "/admin",
      active: currentPath === "/admin" || currentPath === "/admin/",
    },
    {
      label: "Motoristas",
      icon: Users,
      to: "/admin/motoristas",
      active: currentPath.startsWith("/admin/motoristas"),
    },
    {
      label: "Veículos",
      icon: Bike,
      to: "/admin/veiculos",
      active: currentPath.startsWith("/admin/veiculos"),
    },
    {
      label: "Cidades",
      icon: MapPin,
      to: "/admin/cidades",
      active: currentPath.startsWith("/admin/cidades"),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[60] md:hidden bg-zuvvi-indigo/95 backdrop-blur-xl border-t border-white/5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between max-w-md mx-auto px-6">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] justify-center transition-all active:scale-95",
              item.active ? "text-zuvvi-volt" : "text-white/30"
            )}
          >
            <item.icon className={cn("w-6 h-6 transition-transform", item.active && "drop-shadow-[0_0_8px_rgba(198,255,61,0.3)] scale-110")} strokeWidth={item.active ? 2.5 : 2} />
            <span className={cn("text-[9px] font-black uppercase tracking-[0.1em]", item.active ? "opacity-100" : "opacity-50")}>
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
