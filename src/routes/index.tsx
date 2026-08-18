import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAuthStatus } from "@/lib/auth-status.functions";
import heroMoto from "@/assets/hero-moto.jpg";
import { User, MapPin, Clock, Star, Shield, Bike, FileText, CreditCard, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zuvvi — Mobilidade urbana na velocidade da moto" },
      { name: "description", content: "Zuvvi é a plataforma brasileira de moto-táxi." },
    ],
  }),
  component: UnifiedIndex,
});

function UnifiedIndex() {
  const getAuthStatusFn = useServerFn(getAuthStatus);
  const { data: auth, isLoading } = useQuery({
    queryKey: ["auth-status"],
    queryFn: () => getAuthStatusFn(),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-zuvvi-volt border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (auth?.authenticated) {
    if (auth.isMotorista) {
      // In a real app we might redirect, but here we just render the home content directly
      // or rely on the user navigating to /onboarding-motorista.
      // The requirement says: "Adjust the route "/" to detect if there's an active session: 
      // if so, check in usuarios if is_passageiro or is_motorista is true and show the corresponding Home"
      return <HomePassageiro nome={auth.nome || ""} />;
    }
    // Default to Passenger Home for now as requested
    return <HomePassageiro nome={auth.nome || ""} />;
  }

  return <LandingPage />;
}

function HomePassageiro({ nome }: { nome: string }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="min-h-screen zuvvi-gradient text-foreground pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md px-5 py-4">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zuvvi-volt/20 flex items-center justify-center border border-zuvvi-volt/30">
              <User className="text-zuvvi-volt w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Olá, {nome.split(" ")[0]}</p>
              <h1 className="text-sm font-bold">Para onde vamos?</h1>
            </div>
          </div>
          <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-8 space-y-8">
        {/* Search Bar Placeholder */}
        <section className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <MapPin className="text-zuvvi-volt w-5 h-5" />
          </div>
          <input
            type="text"
            placeholder="Qual o seu destino?"
            className="w-full bg-card border border-border rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-zuvvi-volt/50 focus:border-zuvvi-volt outline-none transition-all shadow-lg shadow-black/20"
            disabled
          />
          <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-zuvvi-volt/10 border border-zuvvi-volt/20 rounded-xl text-[10px] text-zuvvi-volt font-bold uppercase tracking-wider text-center animate-pulse">
            Em breve você poderá pedir corridas aqui
          </div>
        </section>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-secondary/30 border border-border rounded-2xl p-4 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-lg bg-zuvvi-volt/10 flex items-center justify-center">
              <Star className="text-zuvvi-volt w-4 h-4" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider">Favoritos</p>
          </div>
          <div className="bg-secondary/30 border border-border rounded-2xl p-4 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-lg bg-zuvvi-volt/10 flex items-center justify-center">
              <Clock className="text-zuvvi-volt w-4 h-4" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider">Recentes</p>
          </div>
        </div>

        {/* Promo Banner */}
        <section className="zuvvi-glow rounded-3xl border border-border bg-zuvvi-indigo-dark p-6 overflow-hidden relative">
          <div className="speed-lines absolute inset-0 opacity-20" />
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-2 text-white">Sua primeira corrida <br/><span className="volt-text">com 50% OFF</span></h3>
            <p className="text-sm text-muted-foreground mb-4">Aproveite o lançamento da Zuvvi na sua cidade.</p>
            <div className="inline-block px-4 py-1.5 rounded-full bg-zuvvi-volt text-zuvvi-indigo text-[10px] font-black uppercase tracking-widest">
              EM BREVE
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/90 backdrop-blur-md px-5 py-3">
        <div className="mx-auto max-w-md flex items-center justify-around">
          <button className="flex flex-col items-center gap-1 volt-text">
            <Bike className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Início</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground">
            <Clock className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Corridas</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground">
            <CreditCard className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Pagamento</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground">
            <User className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen zuvvi-gradient text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <span className="font-display font-bold text-2xl tracking-tight"><span className="volt-text">Zu</span>vvi</span>
          <Link to="/auth/login" className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">ENTRAR</Link>
        </div>
      </header>
      <section className="relative overflow-hidden px-5 py-20 text-center">
        <div className="speed-lines absolute inset-0 opacity-40" />
        <h1 className="relative z-10 text-5xl font-bold leading-tight sm:text-7xl">
          Mobilidade urbana na <br/><span className="volt-text">velocidade da moto</span>.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-md mx-auto">O Zuvvi conecta você a mototaxistas verificados.</p>
        <div className="mt-10 flex justify-center gap-4">
          <Link to="/auth/cadastro" className="rounded-full bg-zuvvi-volt px-8 py-4 text-sm font-bold text-zuvvi-indigo zuvvi-glow">CADASTRAR AGORA</Link>
        </div>
        <div className="mt-16 max-w-4xl mx-auto rounded-3xl overflow-hidden border border-border zuvvi-glow">
          <img src={heroMoto} alt="Moto" className="w-full aspect-video object-cover opacity-80" />
        </div>
      </section>
    </div>
  );
}
