import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { getMapboxToken, calcularValorCorrida } from '@/lib/user.functions';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ChevronLeft, Bike, Clock, Navigation, CheckCircle2, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const searchSchema = z.object({
  originLat: z.number(),
  originLng: z.number(),
  destLat: z.number(),
  destLng: z.number(),
  destName: z.string(),
});

export const Route = createFileRoute('/confirmar-corrida')({
  validateSearch: (search) => searchSchema.parse(search),
  component: ConfirmarCorrida,
});

function ConfirmarCorrida() {
  const { originLat, originLng, destLat, destLng, destName } = Route.useSearch();
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getMapboxTokenFn = useServerFn(getMapboxToken);
  const calcularValorCorridaFn = useServerFn(calcularValorCorrida);

  useEffect(() => {
    async function init() {
      try {
        const token = await getMapboxTokenFn();
        if (!token) throw new Error("Token do Mapbox não encontrado");
        mapboxgl.accessToken = token;

        // Obter rota via Mapbox Directions API
        const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${originLng},${originLat};${destLng},${destLat}?geometries=geojson&access_token=${token}`;
        const response = await fetch(directionsUrl);
        const data = await response.json();

        if (data.code !== 'Ok') throw new Error("Não foi possível calcular a rota");

        const route = data.routes[0];
        const distanceKm = route.distance / 1000;
        const durationMin = route.duration / 60;
        
        setRouteInfo({ distance: distanceKm, duration: durationMin });

        // Calcular valor da corrida via servidor
        const fareData = await calcularValorCorridaFn({
          data: { distanciaKm: distanceKm, tempoMin: durationMin }
        });
        setEstimatedFare(fareData.valor);

        // Inicializar Mapa
        if (mapContainer.current) {
          map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [ (originLng + destLng) / 2, (originLat + destLat) / 2 ],
            zoom: 12,
            attributionControl: false,
          });

          map.current.on('load', () => {
            // Desenhar a rota
            if (!map.current) return;

            map.current.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: route.geometry
              }
            });

            map.current.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#C6FF3D', 'line-width': 5, 'line-opacity': 0.8 }
            });

            // Marcadores
            new mapboxgl.Marker({ color: "#FFFFFF" }).setLngLat([originLng, originLat]).addTo(map.current);
            new mapboxgl.Marker({ color: "#C6FF3D" }).setLngLat([destLng, destLat]).addTo(map.current);

            // Ajustar bounds para caber a rota
            const coordinates = route.geometry.coordinates;
            const bounds = coordinates.reduce((acc: mapboxgl.LngLatBounds, coord: [number, number]) => {
              return acc.extend(coord);
            }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

            map.current.fitBounds(bounds, { padding: 80 });
            setIsLoading(false);
          });
        }
      } catch (err) {
        console.error(err);
        toast.error("Erro ao carregar detalhes da corrida");
        navigate({ to: '/' });
      }
    }

    init();

    return () => {
      if (map.current) map.current.remove();
    };
  }, []);

  return (
    <div className="relative h-[100dvh] w-full bg-zuvvi-indigo text-foreground overflow-hidden font-poppins">
      {/* Mapa de Fundo */}
      <div ref={mapContainer} className="absolute inset-0 z-0" />
      
      {/* Botão Voltar */}
      <button 
        onClick={() => navigate({ to: '/' })}
        className="absolute top-6 left-6 z-20 w-12 h-12 bg-zuvvi-indigo/80 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center transition-transform active:scale-90"
      >
        <ChevronLeft className="w-6 h-6 text-white" />
      </button>

      {/* Camada de Interface */}
      <div className="absolute inset-0 z-10 flex flex-col justify-end pointer-events-none p-5">
        <div className="mx-auto w-full max-w-md pointer-events-auto animate-rise">
          
          <div className="bg-zuvvi-indigo/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 shadow-2xl space-y-6">
            {/* Resumo da Rota */}
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center py-1">
                  <div className="w-2 h-2 rounded-full bg-white/40" />
                  <div className="w-0.5 h-10 border-l border-dashed border-white/20 my-1" />
                  <div className="w-2 h-2 rounded-full bg-zuvvi-volt zuvvi-glow" />
                </div>
                <div className="flex-1 space-y-4 min-w-0">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Origem</p>
                    <p className="text-sm font-medium truncate opacity-60">Sua localização atual</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zuvvi-volt uppercase tracking-widest mb-1">Destino</p>
                    <p className="text-sm font-bold truncate">{destName}</p>
                  </div>
                </div>
              </div>

              {routeInfo && (
                <div className="flex items-center gap-4 p-3 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-3 h-3 text-zuvvi-volt" />
                    <span className="text-xs font-bold">{routeInfo.distance.toFixed(1)} km</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-white/20" />
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-zuvvi-volt" />
                    <span className="text-xs font-bold">{Math.round(routeInfo.duration)} min</span>
                  </div>
                </div>
              )}
            </div>

            {/* Valor e Ação */}
            <div className="pt-2 border-t border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Valor Estimado</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-bold text-zuvvi-volt">R$</span>
                    <span className="text-3xl font-black text-white">
                      {estimatedFare ? estimatedFare.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '--,--'}
                    </span>
                  </div>
                </div>
                <div className="bg-zuvvi-volt/10 border border-zuvvi-volt/20 rounded-xl px-3 py-2 flex items-center gap-2">
                  <Bike className="w-4 h-4 text-zuvvi-volt" />
                  <span className="text-[10px] font-black text-zuvvi-volt uppercase tracking-wider">Zuvvi Moto</span>
                </div>
              </div>

              <button 
                className="w-full bg-zuvvi-volt text-zuvvi-indigo py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-sm zuvvi-glow transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    CONFIRMAR E CHAMAR
                    <CheckCircle2 className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="text-[9px] text-center text-muted-foreground mt-4 uppercase tracking-[0.2em] px-4 leading-relaxed">
            Ao confirmar, você concorda que o valor final pode variar dependendo do trajeto real.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 z-50 bg-zuvvi-indigo/80 backdrop-blur-md flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-10 h-10 text-zuvvi-volt animate-spin" />
          <p className="text-sm font-bold uppercase tracking-widest text-zuvvi-volt animate-pulse">Calculando Rota...</p>
        </div>
      )}
    </div>
  );
}
