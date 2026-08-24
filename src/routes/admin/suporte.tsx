import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { getChamadosSuporte } from '@/lib/suporte.functions';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminBottomNav } from '@/components/admin/AdminBottomNav';
import { DetalheChamado } from '@/components/admin/DetalheChamado';
import { Card } from '@/components/ui/card';
import { AlertCircle, MessageSquare, ChevronRight, Search, X, Filter } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/admin/suporte')({
  component: SuporteAdmin,
});

function SuporteAdmin() {
  const [tipo, setTipo] = useState<"todos" | "duvida" | "sos" | "reclamacao">("todos");
  const [status, setStatus] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [chamadoSelecionado, setChamadoSelecionado] = useState<any | null>(null);

  const { data: chamados } = useSuspenseQuery({
    queryKey: ['suporte-chamados', tipo],
    queryFn: () => getChamadosSuporte({ data: { tipo: tipo === 'todos' ? undefined : tipo } }),
  });

  const filteredChamados = useMemo(() => {
    if (!chamados) return [];
    
    return chamados.filter(chamado => {
      // Filtro por Status (localmente para manter a performance e reatividade da busca)
      if (status !== 'todos' && chamado.status !== status) return false;
      
      // Filtro por Busca
      if (busca) {
        const termo = busca.toLowerCase();
        const noProtocolo = chamado.protocolo?.toLowerCase().includes(termo);
        const noAssunto = chamado.assunto?.toLowerCase().includes(termo);
        const naDescricao = chamado.descricao?.toLowerCase().includes(termo);
        const noUsuario = chamado.usuarios?.nome?.toLowerCase().includes(termo) || 
                          chamado.usuarios?.email?.toLowerCase().includes(termo);
        
        if (!noProtocolo && !noAssunto && !naDescricao && !noUsuario) return false;
      }
      
      return true;
    });
  }, [chamados, status, busca]);

  const uniqueStatus = useMemo(() => {
    if (!chamados) return [];
    const states = chamados.map(c => c.status);
    return Array.from(new Set(states));
  }, [chamados]);

  const hasActiveFilters = tipo !== 'todos' || status !== 'todos' || busca !== '';

  const clearFilters = () => {
    setTipo('todos');
    setStatus('todos');
    setBusca('');
  };

  const indicadores = {
    novos: chamados?.filter(c => c.status === 'aberto').length || 0,
    atendimento: chamados?.filter(c => c.status === 'em_atendimento').length || 0,
    sos: chamados?.filter(c => c.tipo === 'sos' && c.status !== 'resolvido').length || 0,
    resolvidos: chamados?.filter(c => c.status === 'resolvido').length || 0,
  };

  return (
    <div className="min-h-[100dvh] bg-zuvvi-indigo text-white flex flex-col pb-24">
      <AdminHeader />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Central de Suporte</h1>
          <p className="text-white/60">Triagem de dúvidas, reclamações e SOS.</p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white/[0.02] border-white/10 p-4">
            <div className="text-2xl font-bold text-amber-500">{indicadores.novos}</div>
            <div className="text-xs text-white/50">Chamados Novos</div>
          </Card>
          <Card className="bg-white/[0.02] border-white/10 p-4">
            <div className="text-2xl font-bold text-blue-500">{indicadores.atendimento}</div>
            <div className="text-xs text-white/50">Em Atendimento</div>
          </Card>
          <Card className="bg-white/[0.02] border-white/10 p-4">
            <div className="text-2xl font-bold text-red-500">{indicadores.sos}</div>
            <div className="text-xs text-white/50">SOS Abertos</div>
          </Card>
          <Card className="bg-white/[0.02] border-white/10 p-4">
            <div className="text-2xl font-bold text-green-500">{indicadores.resolvidos}</div>
            <div className="text-xs text-white/50">Resolvidos</div>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(['todos', 'duvida', 'reclamacao', 'sos'] as const).map(t => (
              <button 
                key={t}
                onClick={() => setTipo(t)}
                className={`px-4 py-2 rounded-full text-xs uppercase font-bold transition-all whitespace-nowrap ${tipo === t ? 'bg-zuvvi-violet text-white' : 'bg-white/[0.05] text-white/50'}`}
              >
                {t === 'duvida' ? 'Dúvida' : t === 'reclamacao' ? 'Reclamação' : t}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {chamados?.length === 0 ? (
              <div className="text-center py-20 px-6">
                <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                  <Search size={24} className="text-white/20" />
                </div>
                <h3 className="text-white font-bold mb-1">Nenhum chamado encontrado</h3>
                <p className="text-white/30 text-xs italic">Não existem registros para o filtro selecionado no momento.</p>
              </div>
            ) : (
              chamados?.map(chamado => (
                <Card 
                  key={chamado.id} 
                  onClick={() => setChamadoSelecionado(chamado)}
                  className="bg-white/[0.025] border-white/10 p-4 rounded-xl flex items-center gap-4 transition-all hover:bg-white/[0.05] cursor-pointer active:scale-[0.98]"
                >
                  <div className={`p-2 rounded-lg ${chamado.tipo === 'sos' ? 'bg-red-500 text-white' : 'bg-white/5 text-white/50'}`}>
                    {chamado.tipo === 'sos' ? <AlertCircle size={20} /> : <MessageSquare size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{chamado.usuarios?.nome || 'Usuário'}</div>
                    <div className="flex gap-2 text-[10px] text-white/50 uppercase font-bold">
                      <span className={chamado.tipo === 'sos' ? 'text-red-400' : ''}>
                        {chamado.tipo === 'duvida' ? 'Dúvida' : chamado.tipo === 'reclamacao' ? 'Reclamação' : chamado.tipo}
                      </span>
                      <span>•</span>
                      <span>{chamado.status.replace('_', ' ')}</span>
                      <span>•</span>
                      <span>{new Date(chamado.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-white/30" />
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
      
      <DetalheChamado 
        chamado={chamadoSelecionado} 
        isOpen={!!chamadoSelecionado} 
        onClose={() => setChamadoSelecionado(null)} 
      />

      <AdminBottomNav isHidden={!!chamadoSelecionado} />
    </div>
  );
}
