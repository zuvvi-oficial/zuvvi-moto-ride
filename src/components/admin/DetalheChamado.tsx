import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ChevronLeft, X, AlertCircle, MessageSquare, Clock, User, MapPin, Navigation, Bike } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DetalheChamadoProps {
  chamado: any;
  isOpen: boolean;
  onClose: () => void;
}

export function DetalheChamado({ chamado, isOpen, onClose }: DetalheChamadoProps) {
  if (!chamado) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberto': return 'text-amber-500 bg-amber-500/10';
      case 'em_atendimento': return 'text-blue-500 bg-blue-500/10';
      case 'resolvido': return 'text-green-500 bg-green-500/10';
      default: return 'text-white/50 bg-white/5';
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'duvida': return 'Dúvida';
      case 'reclamacao': return 'Reclamação';
      case 'sos': return 'SOS';
      default: return tipo;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-xl bg-zuvvi-indigo border-white/10 p-0 h-[100dvh] overflow-y-auto"
      >
        {/* Cabeçalho Fixo para Mobile */}
        <div className="sticky top-0 z-50 bg-zuvvi-indigo/90 backdrop-blur-md border-b border-white/10 px-4 py-4 flex items-center justify-between">
          <button 
            onClick={onClose}
            className="p-2 -ml-2 text-white/70 hover:text-white transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="text-center flex-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-zuvvi-volt/70">Detalhes do Chamado</div>
            <div className="text-sm font-bold text-white truncate px-4">#{chamado.protocolo}</div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-white/70 hover:text-white transition-colors hidden sm:block"
          >
            <X size={20} />
          </button>
          <div className="w-10 sm:hidden" /> {/* Spacer for centering */}
        </div>

        <div className="p-6 space-y-8 pb-32">
          {/* Status e Tipo */}
          <div className="flex flex-wrap gap-3">
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusColor(chamado.status)}`}>
              {chamado.status.replace('_', ' ')}
            </span>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-white/70`}>
              {getTipoLabel(chamado.tipo)}
            </span>
            {chamado.tipo === 'sos' && (
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                EMERGÊNCIA
              </span>
            )}
          </div>

          {/* Conteúdo Principal */}
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Assunto</div>
              <h2 className="text-xl font-bold text-white">{chamado.assunto}</h2>
            </div>
            
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Descrição</div>
              <p className="text-white/70 leading-relaxed whitespace-pre-wrap">{chamado.descricao}</p>
            </div>

            <div className="flex items-center gap-2 text-white/40 text-xs">
              <Clock size={14} />
              <span>{format(new Date(chamado.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</span>
            </div>
          </div>

          {/* Dados do Usuário */}
          {chamado.usuarios && (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zuvvi-volt/70">
                <User size={12} />
                <span>Solicitante</span>
              </div>
              <div>
                <div className="font-bold text-white">{chamado.usuarios.nome}</div>
                <div className="text-xs text-white/50">{chamado.usuarios.email || 'E-mail não informado'}</div>
                <div className="text-xs text-white/50">{chamado.usuarios.celular || 'Celular não informado'}</div>
              </div>
            </div>
          )}

          {/* Contexto (Cidade/Corrida) */}
          <div className="grid grid-cols-1 gap-4">
            {chamado.cidades && (
              <div className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                <MapPin size={18} className="text-white/30" />
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/30">Cidade</div>
                  <div className="text-sm font-medium">{chamado.cidades.nome} / {chamado.cidades.uf}</div>
                </div>
              </div>
            )}

            {chamado.corridas && (
              <div className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                <Navigation size={18} className="text-white/30" />
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/30">Corrida</div>
                  <div className="text-sm font-medium">#{chamado.corridas.codigo_embarque}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
