import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAuthStatus } from "@/lib/auth-status.functions";
import heroMoto from "@/assets/hero-moto.jpg";
import { User, MapPin, Clock, Star, Shield, Bike, FileText, CreditCard, LogOut, ChevronRight, LocateFixed, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { getMapboxToken, checkCityAvailability } from "@/lib/user.functions";
import { toast } from "sonner";

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
    if (!auth.isRegistrationComplete) {
      navigate({ to: "/auth/completar-cadastro" });
      return null;
    }

    if (auth.isMotorista) {
      navigate({ to: "/onboarding-motorista" });
      return null;
    }
    
    if (auth.isPassageiro) {
      return <HomePassageiro nome={auth.nome || ""} />;
    }

    // Authenticated but no profile chosen yet (should have been caught by server decision, but for safety)
    navigate({ to: "/auth/perfil" });
    return null;
  }

  return <LandingPage />;
}

function HomePassageiro({ nome }: { nome: string }) {
  const map = useRef<mapboxgl.Map | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [isCityAvailable, setIsCityAvailable] = useState<boolean | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [debugStatus, setDebugStatus] = useState<string>("Verificando token...");
  
  const getMapboxTokenFn = useServerFn(getMapboxToken);
  const checkCityAvailabilityFn = useServerFn(checkCityAvailability);

  // Callback ref para garantir o DOM pronto
  const mapContainerRef = (el: HTMLDivElement | null) => {
    if (el && !map.current && location) {
      initMap(el);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const requestLocation = () => {
    setIsLocating(true);
    setLocationError(null);
    
    if (!navigator.geolocation) {
      setLocationError("Geolocalização não é suportada pelo seu navegador.");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsLocating(false);
      },
      (error) => {
        console.error("Erro GPS:", error);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Permissão de localização negada. Por favor, ative o GPS para usar o app.");
        } else {
          setLocationError("Não foi possível obter sua localização. Tente novamente.");
        }
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const result = await checkCityAvailabilityFn({
          data: { coords: location || undefined }
        });
        setIsCityAvailable(result.isAvailable);
        setCityName(result.cityName);
      } catch (err) {
        console.error("Erro ao verificar cidade:", err);
        setIsCityAvailable(false);
      }
    };

    if (!isLocating && location) {
      checkAvailability();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.lat, location?.lng, isLocating]);

  useEffect(() => {
    if (!location || map.current) return;

    const initMap = async () => {
      try {
        const token = await getMapboxTokenFn();
        
        if (!token) {
          toast.error("Configuração de mapa ausente (Token não encontrado).");
          return;
        }

        if (!token.startsWith("pk.")) {
          toast.error("Configuração de mapa inválida: use um token PÚBLICO (pk.xxx).");
          return;
        }

        mapboxgl.accessToken = token;
        
        if (!mapContainer.current) return;

        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: "mapbox://styles/mapbox/dark-v11",
          center: [location.lng, location.lat],
          zoom: 15,
          attributionControl: false
        });

        map.current.on('error', (e) => {
          console.error("Mapbox error:", e);
          toast.error("Não foi possível carregar o mapa: verifique o token do Mapbox.");
        });

        new mapboxgl.Marker({ color: "#C6FF3D" })
          .setLngLat([location.lng, location.lat])
          .addTo(map.current);
      } catch (err) {
        console.error("Erro ao inicializar mapa:", err);
        toast.error("Falha ao inicializar o mapa.");
      }
    };

    initMap();

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.lat, location?.lng]);

  return (
    <div className="relative min-h-screen bg-zuvvi-indigo text-foreground overflow-hidden">
      <div 
        ref={mapContainer} 
        className={`fixed inset-0 z-0 transition-opacity duration-1000 ${location ? 'opacity-100' : 'opacity-0'}`} 
      />

      <div className="relative z-10 flex flex-col min-h-screen pointer-events-none">
        <header className="px-5 py-4 pointer-events-auto">
          <div className="mx-auto max-w-md flex items-center justify-between bg-zuvvi-indigo/60 backdrop-blur-lg border border-white/10 rounded-3xl px-4 py-3 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zuvvi-volt/20 flex items-center justify-center border border-zuvvi-volt/30">
                <User className="text-zuvvi-volt w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Olá, {nome.split(" ")[0]}</p>
                <h1 className="text-sm font-bold">Zuvvi Moto</h1>
              </div>
            </div>
            <button 
              onClick={handleLogout} 
              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 transition-colors hover:bg-white/10"
              title="Sair"
            >
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col justify-end px-5 pb-24 mx-auto w-full max-w-md space-y-4">
          
          {isLocating && (
            <div className="bg-zuvvi-indigo/90 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center space-y-4 shadow-2xl pointer-events-auto animate-rise">
              <Loader2 className="w-10 h-10 text-zuvvi-volt animate-spin" />
              <p className="text-sm font-medium">Buscando sua localização...</p>
            </div>
          )}

          {!isLocating && locationError && (
            <div className="bg-zuvvi-indigo/90 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center space-y-6 shadow-2xl pointer-events-auto animate-rise">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">GPS Necessário</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{locationError}</p>
              </div>
              <button 
                onClick={requestLocation}
                className="w-full bg-zuvvi-volt text-zuvvi-indigo py-4 rounded-2xl font-black uppercase tracking-widest text-xs zuvvi-glow transition-transform active:scale-95"
              >
                TENTAR NOVAMENTE
              </button>
            </div>
          )}

          {!isLocating && !locationError && isCityAvailable === false && (
            <div className="bg-zuvvi-indigo/90 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center space-y-6 shadow-2xl pointer-events-auto animate-rise">
              <div className="w-16 h-16 rounded-full bg-zuvvi-volt/20 flex items-center justify-center">
                <Bike className="text-zuvvi-volt w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Zuvvi ainda não chegou <br/><span className="volt-text">até aqui</span></h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {cityName ? `Estamos trabalhando para liberar as corridas em ${cityName} em breve.` : "Sua localização atual ainda não está coberta pela nossa rede."}
                </p>
                <p className="text-[10px] text-zuvvi-volt/60 font-bold uppercase tracking-widest mt-4">
                  Você será avisado quando liberarmos
                </p>
              </div>
            </div>
          )}

          {!isLocating && !locationError && isCityAvailable === true && (
            <div className="space-y-4 animate-rise pointer-events-auto">
              <div className="relative group">
                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                  <div className="w-2 h-2 rounded-full bg-zuvvi-volt zuvvi-glow" />
                </div>
                <input
                  type="text"
                  placeholder="Para onde vamos?"
                  className="w-full bg-zuvvi-indigo/90 backdrop-blur-xl border border-white/10 rounded-[2rem] py-6 pl-14 pr-4 focus:ring-2 focus:ring-zuvvi-volt/50 focus:border-zuvvi-volt outline-none transition-all shadow-2xl text-base font-bold placeholder:text-muted-foreground/50"
                  disabled
                />
                <div className="absolute top-full left-0 right-0 mt-3 p-3 bg-zuvvi-volt/10 border border-zuvvi-volt/20 rounded-xl text-[10px] text-zuvvi-volt font-black uppercase tracking-[0.1em] text-center animate-pulse">
                  Qual o seu destino? (Em breve)
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 pb-4">
                <button className="bg-zuvvi-indigo/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-3 transition-transform active:scale-[0.98]">
                  <div className="w-8 h-8 rounded-lg bg-zuvvi-volt/10 flex items-center justify-center">
                    <Star className="text-zuvvi-volt w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Favoritos</span>
                </button>
                <button className="bg-zuvvi-indigo/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-3 transition-transform active:scale-[0.98]">
                  <div className="w-8 h-8 rounded-lg bg-zuvvi-volt/10 flex items-center justify-center">
                    <Clock className="text-zuvvi-volt w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Recentes</span>
                </button>
              </div>
            </div>
          )}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zuvvi-indigo/80 backdrop-blur-xl border-t border-white/10 px-5 py-4 pointer-events-auto">
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