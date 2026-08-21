import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAuthStatus } from "@/lib/auth-status.functions";
import heroMoto from "@/assets/hero-moto.jpg";
import { User, MapPin, Clock, Star, Shield, Bike, FileText, CreditCard, LogOut, ChevronRight, LocateFixed, AlertTriangle, Loader2, Trash2, X, ChevronLeft, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import { getMapboxToken, checkCityAvailability, getReverseGeocoding } from "@/lib/user.functions";
import { listarFavoritos, criarFavorito, excluirFavorito } from "@/lib/favoritos.functions";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";


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
  const navigate = useNavigate();

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [isCityAvailable, setIsCityAvailable] = useState<boolean | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [originAddress, setOriginAddress] = useState<string>("Buscando endereço...");
  const [isManualOrigin, setIsManualOrigin] = useState(false);
  const [manualLocation, setManualLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [manualAddress, setManualAddress] = useState<string | null>(null);
  const [isEditingOrigin, setIsEditingOrigin] = useState(false);
  const [favoritosOpen, setFavoritosOpen] = useState(false);
  

  const getMapboxTokenFn = useServerFn(getMapboxToken);
  const checkCityAvailabilityFn = useServerFn(checkCityAvailability);
  const getReverseGeocodingFn = useServerFn(getReverseGeocoding);


  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const requestLocation = () => {
    if (isUpdatingLocation) return;
    
    setIsUpdatingLocation(true);
    setIsLocating(true);
    setLocationError(null);
    setIsManualOrigin(false);
    setManualLocation(null);
    setManualAddress(null);
    setIsEditingOrigin(false);
    
    if (!navigator.geolocation) {
      setLocationError("Geolocalização não é suportada pelo seu navegador.");
      setIsLocating(false);
      setIsUpdatingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setLocation(newCoords);
        setIsLocating(false);
        setIsUpdatingLocation(false);

      },
      (error) => {
        console.error("Erro GPS:", error);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Permissão de localização negada. Por favor, ative o GPS para usar o app.");
        } else {
          setLocationError("Não foi possível obter sua localização. Tente novamente.");
        }
        setIsLocating(false);
        setIsUpdatingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  useEffect(() => {
    const checkAvailabilityAndAddress = async () => {
      if (!isLocating && location) {
        try {
          // Dispara as duas chamadas em paralelo
          const [availabilityResult, addressResult] = await Promise.all([
            checkCityAvailabilityFn({ data: { coords: location } }),
            getReverseGeocodingFn({ data: { lat: location.lat, lng: location.lng } })
          ]);
          
          setIsCityAvailable(availabilityResult.isAvailable);
          setCityName(availabilityResult.cityName);
          setOriginAddress(addressResult.address);
        } catch (err) {
          console.error("Erro ao verificar cidade ou endereço:", err);
          setIsCityAvailable(false);
          setOriginAddress("Sua localização");
        }
      }
    };

    checkAvailabilityAndAddress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.lat, location?.lng, isLocating]);


  return (
    <div 
      className="relative bg-zuvvi-indigo text-foreground overflow-hidden"
      style={{ height: '100dvh', width: '100vw' }}
    >
      {/* 1. Fundo (Z-INDEX 0) */}
      <div 
        style={{ position: 'absolute', inset: 0, zIndex: 0 }}
        className="bg-zuvvi-indigo-dark"
      />


      {/* 2. Camada de Interface (Z-INDEX 10) - Sobreposta ao mapa */}
      <div 
        className="absolute inset-0 z-10 flex flex-col pointer-events-none overflow-hidden overscroll-none"
        style={{ height: '100dvh', width: '100vw' }}
      >
        {/* Header */}
        <header className="px-5 py-4 pointer-events-auto shrink-0">
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

        {/* Conteúdo Principal */}
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end px-5 pb-28 mx-auto w-full max-w-md space-y-4">
          
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
              {/* Card de Origem */}
              <div className="bg-zuvvi-indigo/90 backdrop-blur-xl border border-white/10 rounded-[2rem] p-4 shadow-2xl space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-zuvvi-volt/10 flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-zuvvi-volt zuvvi-glow" />
                    </div>
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setIsEditingOrigin(!isEditingOrigin)}
                    >
                      <p className="text-[10px] text-zuvvi-volt font-black uppercase tracking-[0.2em] mb-0.5">Origem</p>
                      <p className="text-sm font-bold truncate pr-2">
                        {isManualOrigin ? manualAddress : originAddress}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={requestLocation}
                    disabled={isUpdatingLocation}
                    className={`w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 transition-all hover:bg-white/10 active:scale-95 ${isUpdatingLocation ? 'opacity-50' : ''}`}
                  >
                    <LocateFixed className={`w-4 h-4 text-zuvvi-volt ${isUpdatingLocation ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {isEditingOrigin && (
                  <div className="pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <DestinoSearch 
                      location={location} 
                      placeholder="Pesquisar nova origem..."
                      autoFocus={true}
                      onSelect={(res) => {
                        setIsManualOrigin(true);
                        setManualLocation({ lat: res.center[1], lng: res.center[0] });
                        setManualAddress(res.place_name);
                        setIsEditingOrigin(false);

                      }}
                    />
                  </div>
                )}
              </div>

              {/* Card de Destino */}
              <DestinoSearch 
                location={isManualOrigin ? manualLocation : location} 
                onSelect={(dest) => {
                  const currentOrigin = isManualOrigin ? manualLocation : location;
                  const currentOriginName = isManualOrigin ? manualAddress : originAddress;
                  
                  if (currentOrigin && currentOriginName) {
                    navigate({
                      to: '/confirmar-corrida',
                      search: {
                        originLat: currentOrigin.lat,
                        originLng: currentOrigin.lng,
                        destLat: dest.center[1],
                        destLng: dest.center[0],
                        destName: dest.place_name.split(',')[0],
                        originName: currentOriginName.split(',')[0] + (currentOriginName.split(',')[1] ? ', ' + currentOriginName.split(',')[1] : '')
                      }
                    });
                  }
                }}
              />
              
              <div className="grid grid-cols-2 gap-3 pb-4">
                <button 
                  onClick={() => setFavoritosOpen(true)}
                  className="bg-zuvvi-indigo/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-3 transition-transform active:scale-[0.98]"
                >
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
          <FavoritosDialog 
            open={favoritosOpen} 
            onOpenChange={setFavoritosOpen}
            location={isManualOrigin ? manualLocation : location}
          />
        </main>


        {/* Menu Inferior */}
        <nav className="bottom-0 left-0 right-0 bg-zuvvi-indigo/80 backdrop-blur-xl border-t border-white/10 px-5 py-4 pointer-events-auto shrink-0">
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

function FavoritosDialog({ 
  open, 
  onOpenChange, 
  location 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  location: { lat: number; lng: number } | null;
}) {
  const [mode, setMode] = useState<"list" | "add">("list");
  const [nome, setNome] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<{
    endereco: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<{
    height: number;
    width: number;
    offsetTop: number;
    offsetLeft: number;
  } | null>(null);

  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    if (!open || mode !== "add" || !isMobile || typeof window === 'undefined' || !window.visualViewport) {
      if (!open) setViewport(null);
      return;
    }

    const syncViewport = () => {
      const vv = window.visualViewport;
      if (vv) {
        setViewport({
          height: vv.height,
          width: vv.width,
          offsetTop: vv.offsetTop,
          offsetLeft: vv.offsetLeft
        });
      }
    };

    const vv = window.visualViewport;
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    syncViewport();

    return () => {
      vv.removeEventListener('resize', syncViewport);
      vv.removeEventListener('scroll', syncViewport);
    };
  }, [open, mode]);


  const listarFavoritosFn = useServerFn(listarFavoritos);
  const criarFavoritoFn = useServerFn(criarFavorito);
  const excluirFavoritoFn = useServerFn(excluirFavorito);
  const queryClient = useQueryClient();

  const { data: favoritos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["favoritos-passageiro"],
    queryFn: () => listarFavoritosFn(),
    enabled: open,
  });

  const resetForm = () => {
    setMode("list");
    setNome("");
    setSelectedAddress(null);
    setConfirmDeleteId(null);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => criarFavoritoFn({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favoritos-passageiro"] });
      toast.success("Favorito salvo.");
      resetForm();
    },
    onError: (error: any) => {
      const message = error.message || "";
      if (message.includes("Você já possui um favorito com esse nome.")) {
        toast.error("Você já possui um favorito com esse nome.");
      } else {
        toast.error("Não foi possível salvar o favorito.");
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => excluirFavoritoFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favoritos-passageiro"] });
      toast.success("Favorito excluído.");
      setConfirmDeleteId(null);
    },
    onError: () => {
      toast.error("Não foi possível excluir o favorito.");
    }
  });

  return (
    <Dialog 
      open={open} 
      onOpenChange={(val) => {
        if (!val) resetForm();
        onOpenChange(val);
      }}
    >
      <DialogContent 
        className={`max-w-[calc(100vw-2rem)] sm:max-w-md bg-zuvvi-indigo/95 backdrop-blur-2xl border-white/10 rounded-[2rem] shadow-2xl p-6 transition-all duration-300 ${
          mode === "add" 
            ? "top-0 translate-y-0 sm:top-1/2 sm:-translate-y-1/2" 
            : ""
        }`}
        style={{
          top: (mode === "add" && viewportOffsetTop !== null) 
            ? `${viewportOffsetTop + 12}px` 
            : undefined,
          maxHeight: (mode === "add" && viewportHeight !== null)
            ? `${viewportHeight - 24}px`
            : undefined,
          transform: (mode === "add" && viewportOffsetTop !== null)
            ? 'translateX(-50%)'
            : undefined,
          left: (mode === "add" && viewportOffsetTop !== null)
            ? '50%'
            : undefined
        }}
      >
        <DialogHeader className="mb-4">
          <div className="flex items-center gap-3">
            {mode === "add" && (
              <button 
                onClick={() => setMode("list")}
                aria-label="Voltar para favoritos"
                className="w-11 h-11 min-w-11 min-h-11 rounded-full bg-white/5 flex items-center justify-center border border-white/10 transition-all active:scale-95"
              >
                <ChevronLeft className="w-5 h-5 text-zuvvi-volt" />
              </button>
            )}

            <div className="w-10 h-10 rounded-xl bg-zuvvi-volt/10 flex items-center justify-center">
              <Star className="text-zuvvi-volt w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {mode === "list" ? "Seus favoritos" : "Novo favorito"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {mode === "list" 
                  ? "Salve lugares para chegar mais rápido." 
                  : "Adicione um nome e escolha o local."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-zuvvi-volt animate-spin" />
            <p className="text-xs font-medium text-muted-foreground">Carregando seus favoritos...</p>
          </div>
        ) : isError ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <p className="text-sm font-medium text-muted-foreground">Não foi possível carregar seus favoritos.</p>
            <button 
              onClick={() => refetch()}
              className="px-6 py-4 min-h-[44px] bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
            >
              TENTAR NOVAMENTE
            </button>

          </div>
        ) : mode === "list" ? (
          <div className="space-y-4">
            {favoritos.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-center space-y-4 bg-white/5 rounded-3xl border border-white/10">
                <Star className="w-10 h-10 text-zuvvi-volt/20" />
                <div>
                  <h3 className="text-sm font-bold">Nenhum favorito ainda</h3>
                  <p className="text-xs text-muted-foreground px-10">Salve Casa, Trabalho ou qualquer lugar importante.</p>
                </div>
                <button 
                  onClick={() => setMode("add")}
                  className="bg-zuvvi-volt text-zuvvi-indigo px-6 py-4 min-h-[44px] rounded-2xl text-[10px] font-black uppercase tracking-widest zuvvi-glow transition-transform active:scale-95 flex items-center gap-2"
                >
                  <Plus className="w-3 h-3" strokeWidth={3} />
                  ADICIONAR ENDEREÇO
                </button>

              </div>
            ) : (
              <>
                <div className="max-h-[min(42dvh,22rem)] overflow-y-auto overscroll-contain pr-1 custom-scrollbar space-y-2">
                  {favoritos.map((fav: any) => (
                    <div 
                      key={fav.id}
                      className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3 group transition-colors hover:border-white/20"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-zuvvi-volt/10 flex items-center justify-center shrink-0">
                          <Star className="text-zuvvi-volt w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          {confirmDeleteId === fav.id ? (
                            <p className="text-xs font-bold volt-text">Excluir este favorito?</p>
                          ) : (
                            <>
                              <p className="text-sm font-bold truncate">{fav.nome}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{fav.endereco}</p>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {confirmDeleteId === fav.id ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <button 
                            onClick={() => setConfirmDeleteId(null)}
                            aria-label="Cancelar exclusão"
                            className="w-11 h-11 min-w-11 min-h-11 rounded-full hover:bg-white/5 transition-colors flex items-center justify-center"
                          >
                            <X className="w-5 h-5 text-muted-foreground" />
                          </button>
                          <button 
                            onClick={() => deleteMutation.mutate(fav.id)}
                            disabled={deleteMutation.isPending}
                            aria-label={`Confirmar exclusão de ${fav.nome}`}
                            className="w-11 h-11 min-w-11 min-h-11 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors flex items-center justify-center"
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
                            ) : (
                              <Trash2 className="w-5 h-5 text-red-500" />
                            )}
                          </button>

                        </div>
                      ) : (
                        <button 
                          onClick={() => setConfirmDeleteId(fav.id)}
                          aria-label={`Excluir favorito ${fav.nome}`}
                          className="w-11 h-11 min-w-11 min-h-11 rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-white/5 transition-all shrink-0"
                        >
                          <Trash2 className="w-5 h-5 text-muted-foreground hover:text-red-500" />
                        </button>

                      )}
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setMode("add")}
                  className="w-full bg-white/5 border border-white/10 text-foreground py-4 min-h-[44px] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Plus className="w-3 h-3" strokeWidth={3} />
                  ADICIONAR ENDEREÇO
                </button>

              </>
            )}
          </div>
        ) : (
          <div className="space-y-6 overflow-y-auto overscroll-contain pr-1 custom-scrollbar">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zuvvi-volt pl-1">Nome do lugar</label>
              <input 
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Casa, Trabalho, Academia"
                maxLength={40}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 focus:ring-2 focus:ring-zuvvi-volt/50 focus:border-zuvvi-volt outline-none transition-all text-sm font-bold placeholder:text-muted-foreground/30"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zuvvi-volt pl-1">Endereço</label>
              <DestinoSearch 
                location={location}
                placeholder="Buscar endereço..."
                onSelect={(res) => setSelectedAddress({
                  endereco: res.place_name,
                  latitude: res.center[1],
                  longitude: res.center[0]
                })}
              />
            </div>

            {selectedAddress && (
              <div className="bg-zuvvi-volt/10 border border-zuvvi-volt/20 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2">
                <p className="text-[8px] font-black uppercase tracking-widest text-zuvvi-volt mb-1">ENDEREÇO SELECIONADO</p>
                <p className="text-xs font-bold leading-tight">{selectedAddress.endereco}</p>
              </div>
            )}

            <button 
              disabled={!nome.trim() || !selectedAddress || createMutation.isPending}
              onClick={() => createMutation.mutate({
                nome: nome.trim(),
                endereco: selectedAddress?.endereco,
                latitude: selectedAddress?.latitude,
                longitude: selectedAddress?.longitude
              })}
              className="w-full bg-zuvvi-volt text-zuvvi-indigo py-4 rounded-2xl font-black uppercase tracking-widest text-xs zuvvi-glow transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "SALVAR FAVORITO"
              )}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DestinoSearch({ 

  location, 
  onSelect, 
  placeholder = "Para onde vamos?", 
  autoFocus = false 
}: { 
  location: { lat: number; lng: number } | null, 
  onSelect: (dest: any) => void,
  placeholder?: string,
  autoFocus?: boolean
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const getMapboxTokenFn = useServerFn(getMapboxToken);

  useEffect(() => {
    const search = async () => {
      if (query.length < 3) {
        setResults([]);
        return;
      }

      const token = await getMapboxTokenFn();
      if (!token) return;

      const proximity = location ? `&proximity=${location.lng},${location.lat}` : '';
      // Limitando a busca ao Brasil e usando proximity com a localização atual do usuário.
      // Adicionamos limit=5 para focar em resultados mais relevantes.
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&country=br&language=pt&types=address,poi,place${proximity}&limit=5`;
      
      try {
        const response = await fetch(url);
        const data = await response.json();
        setResults(data.features || []);
        setIsOpen(true);
      } catch (err) {
        console.error("Erro geocoding:", err);
      }
    };

    const timer = setTimeout(search, 500);
    return () => clearTimeout(timer);
  }, [query, location]);

  return (
    <div className="relative group">
      <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
        <div className="w-2 h-2 rounded-full bg-zuvvi-volt zuvvi-glow" />
      </div>
      <input
        type="text"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zuvvi-indigo/90 backdrop-blur-xl border border-white/10 rounded-[2rem] py-6 pl-14 pr-4 focus:ring-2 focus:ring-zuvvi-volt/50 focus:border-zuvvi-volt outline-none transition-all shadow-2xl text-base font-bold placeholder:text-muted-foreground/50"
      />
      
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-zuvvi-indigo/95 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="max-h-[min(36dvh,18rem)] overflow-y-auto overscroll-contain custom-scrollbar">
            {results.map((result) => (
            <button
              key={result.id}
              onClick={() => {
                onSelect(result);
                setIsOpen(false);
                setQuery('');
              }}
              className="w-full text-left px-6 py-4 flex items-start gap-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
            >
              <div className="w-8 h-8 rounded-full bg-zuvvi-volt/10 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="text-zuvvi-volt w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{result.text}</p>
                <p className="text-[10px] text-muted-foreground truncate">{result.place_name}</p>
              </div>
            </button>
            ))}
          </div>
        </div>
      )}
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