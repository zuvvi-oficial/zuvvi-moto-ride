import React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMotoristaStatusHome, updateMotoristaDisponibilidade } from '@/lib/motorista-status.functions';
import { Button } from '@/components/ui/button';
import { Power, CheckCircle2, Clock, AlertCircle, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const Route = createFileRoute('/home-motorista')({
  component: HomeMotorista,
});

function HomeMotorista() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getStatusFn = useServerFn(getMotoristaStatusHome);
  const updateStatusFn = useServerFn(updateMotoristaDisponibilidade);

  const { data: status, isLoading, isError } = useQuery({
    queryKey: ['motorista-status'],
    queryFn: () => getStatusFn(),
    refetchInterval: 10000, // Atualiza a cada 10s para refletir mudanças externas
  });

  const mutation = useMutation({
    mutationFn: (disponivel: boolean) => updateStatusFn({ data: { disponivel } }),
    onSuccess: (data) => {
      queryClient.setQueryData(['motorista-status'], (old: any) => ({
        ...old,
        is_disponivel: data.is_disponivel
      }));
      toast.success(data.is_disponivel ? "Você está online!" : "Você está offline.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao alterar status.");
    }
  });

  const handleToggle = () => {
    if (!status) return;
    mutation.mutate(!status.is_disponivel);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#130F36] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#C6FF3D]"></div>
        <p className="mt-4 font-poppins">Carregando perfil...</p>
      </div>
    );
  }

  if (isError || !status || !status.is_motorista) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#130F36] text-white p-6 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold font-poppins mb-2">Acesso Negado</h1>
        <p className="mb-6 opacity-80">Esta área é exclusiva para motoristas cadastrados.</p>
        <Button onClick={() => navigate({ to: "/" })} className="bg-[#6C3CE9] hover:bg-[#5a32c2]">
          Voltar para Home
        </Button>
      </div>
    );
  }

  // Redirecionamento se não estiver aprovado (opcional, mas a tela mostra o status de qualquer forma)
  const isAprovado = status.status_aprovacao === 'aprovado';

  return (
    <div className="flex flex-col min-h-screen bg-[#130F36] text-white font-poppins pb-24">
      {/* Header */}
      <header className="p-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Olá, {status.nome.split(' ')[0]}</h1>
          <p className="text-sm opacity-60">Portal do Parceiro Zuvvi</p>
        </div>
        <button 
          onClick={handleLogout}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          title="Sair"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 p-6 flex flex-col items-center justify-center">
        {/* Card de Status de Aprovação */}
        {!isAprovado && (
          <div className="w-full max-w-sm bg-white/5 rounded-2xl p-6 mb-8 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-4 mb-4">
              {status.status_aprovacao === 'em_analise' ? (
                <div className="bg-amber-500/20 p-3 rounded-full">
                  <Clock className="w-6 h-6 text-amber-500" />
                </div>
              ) : (
                <div className="bg-red-500/20 p-3 rounded-full">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
              )}
              <div>
                <h3 className="font-semibold text-lg">
                  {status.status_aprovacao === 'em_analise' ? 'Em Análise' : 'Perfil Pendente'}
                </h3>
                <p className="text-sm opacity-70">
                  {status.status_aprovacao === 'em_analise' 
                    ? 'Aguarde a validação dos seus documentos.' 
                    : 'Complete seu cadastro no onboarding.'}
                </p>
              </div>
            </div>
            {status.status_aprovacao !== 'em_analise' && (
              <Button 
                onClick={() => navigate({ to: "/onboarding-motorista" })}
                className="w-full bg-[#6C3CE9] hover:bg-[#5a32c2]"
              >
                Completar Onboarding
              </Button>
            )}
          </div>
        )}

        {/* Interface de Disponibilidade (Apenas para Aprovados) */}
        {isAprovado ? (
          <div className="flex flex-col items-center">
            <div className={`mb-8 flex flex-col items-center transition-all duration-500 ${status.is_disponivel ? 'scale-110' : 'scale-100'}`}>
              <div className={`w-48 h-48 rounded-full flex items-center justify-center border-4 ${status.is_disponivel ? 'border-[#C6FF3D] shadow-[0_0_40px_rgba(198,255,61,0.3)]' : 'border-white/20'}`}>
                <div className={`w-40 h-40 rounded-full flex items-center justify-center ${status.is_disponivel ? 'bg-[#C6FF3D] text-[#130F36]' : 'bg-white/10 text-white/40'}`}>
                  <Power className="w-20 h-20" />
                </div>
              </div>
            </div>

            <div className="text-center mb-12">
              <h2 className={`text-3xl font-bold mb-2 ${status.is_disponivel ? 'text-[#C6FF3D]' : 'text-white'}`}>
                {status.is_disponivel ? 'ONLINE' : 'OFFLINE'}
              </h2>
              <p className="text-lg opacity-80">
                {status.is_disponivel 
                  ? 'Você está online e recebendo corridas' 
                  : 'Fique online para começar a ganhar'}
              </p>
            </div>

            <Button
              onClick={handleToggle}
              disabled={mutation.isPending}
              className={`w-64 h-16 rounded-full text-lg font-bold transition-all ${
                status.is_disponivel 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-[#C6FF3D] hover:bg-[#b5eb37] text-[#130F36]'
              }`}
            >
              {mutation.isPending ? (
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-current"></div>
              ) : (
                status.is_disponivel ? 'FICAR INDISPONÍVEL' : 'FICAR DISPONÍVEL'
              )}
            </Button>
          </div>
        ) : (
          <div className="opacity-40 pointer-events-none grayscale flex flex-col items-center">
             <div className="w-48 h-48 rounded-full flex items-center justify-center border-4 border-white/20">
                <div className="w-40 h-40 rounded-full flex items-center justify-center bg-white/10 text-white/40">
                  <Power className="w-20 h-20" />
                </div>
              </div>
              <p className="mt-8 text-xl font-bold">INDISPONÍVEL</p>
              <p className="mt-2">Seu perfil não está ativo</p>
          </div>
        )}
      </main>

      {/* Footer Nav Simples */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#1e194d] border-t border-white/10 p-4 flex justify-around">
        <div className="flex flex-col items-center text-[#C6FF3D]">
          <CheckCircle2 className="w-6 h-6" />
          <span className="text-[10px] mt-1">Início</span>
        </div>
        <div className="flex flex-col items-center opacity-40">
          <Clock className="w-6 h-6" />
          <span className="text-[10px] mt-1">Histórico</span>
        </div>
        <div className="flex flex-col items-center opacity-40">
          <div className="w-6 h-6 rounded-full bg-white/20"></div>
          <span className="text-[10px] mt-1">Ganhos</span>
        </div>
      </div>
    </div>
  );
}
