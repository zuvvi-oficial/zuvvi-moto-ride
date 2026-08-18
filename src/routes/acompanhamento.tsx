import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { getCorrida, getMapboxToken } from '@/lib/user.functions';
import { Bike, Loader2, ChevronLeft, User, Star } from 'lucide-react';
import { z } from 'zod';
import { MapView } from '@/components/MapView';

const searchSchema = z.object({
  rideId: z.string(),
});

export const Route = createFileRoute('/acompanhamento')({
  validateSearch: (search) => searchSchema.parse(search),
  component: AcompanhamentoCorrida,
});

function AcompanhamentoCorrida() {
  const { rideId } = Route.useSearch();
  const navigate = useNavigate();
  const [corrida, setCorrida] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);

  const getCorridaFn = useServerFn(getCorrida);
  const getMapboxTokenFn = useServerFn(getMapboxToken);

  useEffect(() => {
    async function init() {
      try {
        const [rideData, token] = await Promise.all([
          getCorridaFn({ data: { rideId } }),
          getMapboxTokenFn()
        ]);
        setCorrida(rideData);
        setMapboxToken(token);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [rideId, getCorridaFn, getMapboxTokenFn]);

  if (isLoading || !corrida) {
    return (
      <div className="min-h-[100dvh] bg-zuvvi-indigo flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-zuvvi-volt animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] bg-zuvvi-indigo overflow-hidden font-poppins">
      {/* Mapa */}
      <div className="absolute inset-0 z-0">
        {mapboxToken && (
          <MapView 
            center={{ lat: corrida.origem_lat, lng: corrida.origem_lng }} 
            token={mapboxToken} 
          />
        )}
      </div>

      {/* Overlay Superior */}
      <div className="relative z-10 p-6 flex items-center justify-between pointer-events-none">
        <button 
          onClick={() => navigate({ to: '/' })}
          className="w-12 h-12 bg-zuvvi-indigo/80 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/10 pointer-events-auto active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="bg-zuvvi-indigo/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 pointer-events-auto">
          <p className="text-[10px] text-zuvvi-volt font-black uppercase tracking-widest text-center">Corrida em curso</p>
        </div>
        <div className="w-12" />
      </div>

      {/* Card do Motorista (Placeholder UI) */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-10 pointer-events-none">
        <div className="max-w-md mx-auto bg-zuvvi-indigo/90 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-6 shadow-2xl pointer-events-auto animate-rise space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-zuvvi-volt/20 flex items-center justify-center border border-zuvvi-volt/30">
                <User className="w-8 h-8 text-zuvvi-volt" />
              </div>
              <div>
                <h3 className="text-white font-bold">Motorista Parceiro</h3>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-zuvvi-volt fill-zuvvi-volt" />
                  <span className="text-xs text-zuvvi-volt font-bold">4.9</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Placa</p>
              <p className="text-sm font-black text-white">ZVV-2026</p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zuvvi-volt/10 flex items-center justify-center">
                <Bike className="w-5 h-5 text-zuvvi-volt" />
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Veículo</p>
                <p className="text-xs font-bold text-white">Honda CG 160</p>
              </div>
            </div>
            <button className="bg-zuvvi-volt text-zuvvi-indigo px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform zuvvi-glow">
              Mensagem
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
