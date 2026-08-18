import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAuthStatus } from "@/lib/auth-status.functions";
import heroMoto from "@/assets/hero-moto.jpg";
import { User, MapPin, Clock, Star, Shield, Bike, FileText, CreditCard, LogOut, ChevronRight } from "lucide-react";
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
  const navigate = useNavigate();
  
  const { data: auth, isLoading } = useQuery({
    queryKey: ["auth-status"],
    queryFn: () => getAuthStatusFn(),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zuvvi-indigo-dark flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-zuvvi-volt border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (auth?.authenticated) {
    if (auth.isMotorista) {
      // For motorista, redirect to their home (onboarding-motorista)
      // We use navigate instead of redirect in component for smoother experience
      // But according to requirement "show the corresponding Home", we could also render it here.
      // However, /onboarding-motorista already has the logic.
      // Let's redirect to centralize motorista logic there.
      navigate({ to: "/onboarding-motorista" });
      return null;
    }
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
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Olá, {nome.split(" ")[0]}</p>
              <h1 className="text-sm font-bold">Para onde vamos?</h1>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center border border-border transition-colors hover:bg-secondary"
            title="Sair"
          >
            <LogOut className="w-4 h-4 text-muted-foreground" />
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
            className="w-full bg-card border border-border rounded-2xl py-5 pl-12 pr-4 focus:ring-2 focus:ring-zuvvi-volt/50 focus:border-zuvvi-volt outline-none transition-all shadow-xl shadow-black/40 text-sm font-medium"
            disabled
          />
          <div className="absolute top-full left-0 right-0 mt-3 p-3 bg-zuvvi-volt/10 border border-zuvvi-volt/20 rounded-xl text-[10px] text-zuvvi-volt font-black uppercase tracking-[0.1em] text-center animate-pulse">
            Em breve você poderá pedir corridas aqui
          </div>
        </section>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <button className="bg-secondary/30 border border-border rounded-2xl p-5 flex flex-col items-center gap-3 transition-transform active:scale-[0.98]">
            <div className="w-10 h-10 rounded-xl bg-zuvvi-volt/10 flex items-center justify-center">
              <Star className="text-zuvvi-volt w-5 h-5" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest">Favoritos</p>
          </button>
          <button className="bg-secondary/30 border border-border rounded-2xl p-5 flex flex-col items-center gap-3 transition-transform active:scale-[0.98]">
            <div className="w-10 h-10 rounded-xl bg-zuvvi-volt/10 flex items-center justify-center">
              <Clock className="text-zuvvi-volt w-5 h-5" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest">Recentes</p>
          </button>
        </div>

        {/* Promo Banner */}
        <section className="zuvvi-glow rounded-3xl border border-border bg-zuvvi-indigo-dark p-6 overflow-hidden relative">
          <div className="speed-lines absolute inset-0 opacity-20" />
          <div className="relative z-10">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold mb-2 text-white">Sua primeira corrida <br/><span className="volt-text">com 50% OFF</span></h3>
                <p className="text-xs text-muted-foreground mb-4">Aproveite o lançamento da Zuvvi na sua cidade.</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-zuvvi-volt/10 flex items-center justify-center border border-zuvvi-volt/20">
                <Bike className="text-zuvvi-volt w-5 h-5" />
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zuvvi-volt text-zuvvi-indigo text-[10px] font-black uppercase tracking-widest">
              Lançamento em breve
              <ChevronRight size={12} strokeWidth={3} />
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/90 backdrop-blur-md px-5 py-3">
        <div className="mx-auto max-w-md flex items-center justify-around">
          <button className="flex flex-col items-center gap-1 volt-text">
            <Bike className="w-6 h-6" strokeWidth={2.5} />
            <span className="text-[9px] font-black uppercase tracking-wider">Início</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
            <Clock className="w-6 h-6" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Corridas</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
            <CreditCard className="w-6 h-6" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Carteira</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
            <User className="w-6 h-6" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen zuvvi-gradient text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <span className="font-display font-bold text-2xl tracking-tight" style={{ letterSpacing: "-0.04em" }}>
            <span className="volt-text">Zu</span>vvi
          </span>
          <div className="flex items-center gap-4">
            <Link to="/auth/login" className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">Entrar</Link>
            <Link 
              to="/auth/cadastro" 
              className="rounded-full bg-zuvvi-volt px-6 py-2 text-xs font-bold text-zuvvi-indigo shadow-lg shadow-zuvvi-volt/20 hover:scale-[1.02] transition-transform"
            >
              CADASTRAR
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-5 py-20 text-center lg:py-32">
        <div className="speed-lines absolute inset-0 opacity-40" />
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white mb-8">
            <span className="h-2 w-2 rounded-full bg-zuvvi-volt animate-pulse" />
            Moto-táxi no Brasil
          </div>
          <h1 className="text-5xl font-bold leading-[1.05] sm:text-7xl lg:text-8xl">
            Mobilidade urbana na <br/><span className="volt-text">velocidade da moto</span>.
          </h1>
          <p className="mt-8 text-lg text-muted-foreground max-w-xl mx-auto">
            O Zuvvi conecta você a mototaxistas verificados para cruzar a cidade com agilidade, segurança e preço justo.
          </p>
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Link to="/auth/cadastro" className="rounded-full bg-primary px-10 py-5 text-sm font-bold text-primary-foreground zuvvi-glow hover:scale-[1.02] transition-transform flex items-center gap-2">
              COMEÇAR AGORA
              <ChevronRight size={18} />
            </Link>
          </div>
        </div>
        
        <div className="mt-20 max-w-5xl mx-auto rounded-[2rem] overflow-hidden border border-border/80 zuvvi-glow relative">
          <img 
            src={heroMoto} 
            alt="Mototaxista Zuvvi" 
            className="w-full aspect-[21/9] object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zuvvi-indigo-dark via-transparent to-transparent opacity-60" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-12 bg-black/20">
        <div className="mx-auto max-w-6xl px-5 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
             <span className="font-display font-bold text-2xl tracking-tight"><span className="volt-text">Zu</span>vvi</span>
             <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Zuvvi Mobilidade · Brasil</p>
          </div>
          <div className="flex items-center gap-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <a href="#" className="hover:text-zuvvi-volt transition-colors">Privacidade</a>
            <a href="#" className="hover:text-zuvvi-volt transition-colors">Termos</a>
            <a href="#" className="hover:text-zuvvi-volt transition-colors">Contato</a>
          </div>
          <div className="px-4 py-2 rounded-full border border-zuvvi-volt/30 bg-zuvvi-volt/5 text-[10px] font-black uppercase tracking-widest volt-text">
            Em breve em todo o Brasil
          </div>
        </div>
      </footer>
    </div>
  );
}
