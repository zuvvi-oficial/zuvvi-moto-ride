import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import OnboardingForm from '@/components/motorista/OnboardingForm';
import { resolveDestinationForLoader } from '@/lib/auth-status.functions';
import { getSessionUser } from '@/lib/user.functions';
import { getMotoristaStatusFeedback, getCnhCorrectionState } from '@/lib/motorista.functions';
import CnhCorrectionForm from '@/components/motorista/CnhCorrectionForm';


import { Loader2, User, Clock, AlertOctagon, ShieldAlert, AlertTriangle, Info, Calendar } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useServerFn } from '@tanstack/react-start';

export const Route = createFileRoute('/onboarding-motorista')({
  loader: async () => {
    const status = await resolveDestinationForLoader();
    
    // Se não estiver autenticado ou não for motorista, redireciona
    if (status.redirectTo && status.redirectTo !== '/onboarding-motorista') {
      throw redirect({ to: status.redirectTo });
    }

    if (!status.isMotorista && !status.isAdmin) {
      throw redirect({ to: '/' });
    }
    
    return {};
  },
  component: OnboardingMotorista,
});

function OnboardingMotorista() {
  const navigate = useNavigate();
  const getSessionUserFn = useServerFn(getSessionUser);
  const getStatusFeedbackFn = useServerFn(getMotoristaStatusFeedback);
  const getCnhCorrectionStateFn = useServerFn(getCnhCorrectionState);
  
  const { data: user, isLoading: isUserLoading, refetch } = useQuery({
    queryKey: ['session-user'],
    queryFn: () => getSessionUserFn(),
  });

  const { 
    data: feedback, 
    isLoading: isFeedbackLoading, 
    isError: isFeedbackError 
  } = useQuery({
    queryKey: ['motorista-status-feedback', user?.id],
    queryFn: () => getStatusFeedbackFn(),
    enabled: !!user,
  });

  const {
    data: cnhCorrection,
    isLoading: isCnhLoading,
    isError: isCnhError,
    refetch: refetchCnhCorrection
  } = useQuery({
    queryKey: ['cnh-correction-state', user?.id],
    queryFn: () => getCnhCorrectionStateFn(),
    enabled: !!user && (user as any).motorista?.status_aprovacao === 'em_analise',
  });


  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen bg-zuvvi-indigo flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-zuvvi-volt animate-spin" />
      </div>
    );
  }

  const motorista = (user as any).motorista;
  const statusAprovacao = motorista?.status_aprovacao || "em_preenchimento";

  // Se o motorista já está aprovado, redirecionar para a home operacional correta
  if (statusAprovacao === 'aprovado') {
    throw redirect({ to: '/home-motorista' });
  }

  return (
    <div className="min-h-screen bg-zuvvi-indigo text-white pb-32 font-poppins">
      <header className="p-6 flex items-center justify-between border-b border-white/5 sticky top-0 z-50 bg-zuvvi-indigo/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <User className="w-5 h-5 text-zuvvi-volt" />
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Finalize seu Cadastro</p>
            <h1 className="text-sm font-bold uppercase">{user.nome.split(" ")[0]}</h1>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = '/auth/login';
          }}
          className="text-white/40 hover:text-white hover:bg-white/5 font-bold uppercase text-[10px] tracking-widest"
        >
          Sair
        </Button>
      </header>

      <main className="p-6 max-w-md mx-auto space-y-6">
        {statusAprovacao === 'em_analise' ? (


          <>
            {isCnhLoading ? (
              <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center space-y-4">
                <Loader2 className="w-8 h-8 text-zuvvi-volt animate-spin mx-auto" />
                <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Verificando CNH...</p>
              </div>
            ) : isCnhError ? (
              <div className="bg-red-500/5 border border-red-500/10 rounded-[2rem] p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                  <AlertOctagon className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold italic uppercase italic">Erro de verificação</h2>
                <p className="text-sm text-muted-foreground">
                  Não foi possível verificar a situação da sua CNH.
                </p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 text-[10px] uppercase font-bold"
                  onClick={() => window.location.reload()}
                >
                  Atualizar a página e tente novamente
                </Button>
              </div>
            ) : cnhCorrection?.needs_correction ? (
              <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8 text-amber-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold italic uppercase">ATUALIZE SUA CNH</h2>
                  <p className="text-sm text-muted-foreground">
                    Sua CNH precisa ser atualizada antes que você possa operar como mototaxista.
                  </p>
                </div>

                {cnhCorrection.is_expired && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] text-red-500 font-black uppercase tracking-widest">CNH vencida</span>
                    </div>
                    <p className="text-xs text-white/70">
                      Seu acesso operacional está bloqueado automaticamente até a regularização.
                    </p>
                  </div>
                )}

                {cnhCorrection.motivo_correcao && (
                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 text-left">
                    <p className="text-[10px] text-amber-500 uppercase font-black tracking-widest mb-1">MOTIVO DA CORREÇÃO</p>
                    <p className="text-sm text-white/80">{cnhCorrection.motivo_correcao}</p>
                  </div>
                )}

                <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-3 text-left">
                  <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">DADOS ATUAIS (SOMENTE CONSULTA)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[9px] text-white/40 uppercase">Número</p>
                      <p className="text-xs font-bold">{cnhCorrection.cnh_numero || '---'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/40 uppercase">Categoria</p>
                      <p className="text-xs font-bold uppercase">{cnhCorrection.cnh_categoria || '---'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] text-white/40 uppercase">Validade atual</p>
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-bold ${cnhCorrection.is_expired ? 'text-red-500' : ''}`}>
                          {cnhCorrection.cnh_validade ? new Date(cnhCorrection.cnh_validade + 'T12:00:00').toLocaleDateString('pt-BR') : '---'}
                        </p>
                        {cnhCorrection.is_expired && <Calendar className="w-3 h-3 text-red-500" />}
                      </div>
                    </div>
                  </div>
                </div>

                <CnhCorrectionForm 
                  cnhNumero={cnhCorrection.cnh_numero || ''}
                  cnhCategoria={cnhCorrection.cnh_categoria || ''}
                  cnhValidade={cnhCorrection.cnh_validade || ''}
                  onSubmitted={async () => {
                    await refetchCnhCorrection();
                  }}
                />

              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-zuvvi-volt/10 rounded-full flex items-center justify-center mx-auto">
                  <Clock className="w-8 h-8 text-zuvvi-volt" />
                </div>
                <h2 className="text-xl font-bold italic uppercase">Perfil em análise</h2>
                <p className="text-sm text-muted-foreground">
                  Estamos verificando seus documentos. Você receberá um aviso assim que for aprovado para pilotar.
                </p>
              </div>
            )}
          </>
        ) : statusAprovacao === 'recusado' ? (
          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <AlertOctagon className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold italic uppercase">Cadastro recusado</h2>
            <p className="text-sm text-muted-foreground">
              Seu cadastro não foi aprovado.
            </p>
            
            {isFeedbackLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 text-zuvvi-volt animate-spin" />
              </div>
            ) : isFeedbackError ? (
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-center">
                <p className="text-xs text-white/80 mb-3">Não foi possível carregar os detalhes do seu cadastro.</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 text-[10px] uppercase font-bold"
                  onClick={() => window.location.reload()}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : feedback?.justificativa && (
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-left">
                <p className="text-[10px] text-red-500 uppercase font-black tracking-widest mb-1">Motivo</p>
                <p className="text-sm text-white/80">{feedback.justificativa}</p>
              </div>
            )}
            
            <p className="text-xs text-white/40 pt-2">
              Revise a informação apresentada e aguarde orientação da equipe Zuvvi.
            </p>
          </div>
        ) : statusAprovacao === 'suspenso' ? (
          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold italic uppercase">Cadastro suspenso</h2>
            <p className="text-sm text-muted-foreground">
              Seu acesso como mototaxista está temporariamente suspenso.
            </p>
            
            {isFeedbackLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 text-zuvvi-volt animate-spin" />
              </div>
            ) : isFeedbackError ? (
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 text-center">
                <p className="text-xs text-white/80 mb-3">Não foi possível carregar os detalhes do seu cadastro.</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 text-[10px] uppercase font-bold"
                  onClick={() => window.location.reload()}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : feedback?.justificativa && (
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 text-left">
                <p className="text-[10px] text-amber-500 uppercase font-black tracking-widest mb-1">Motivo</p>
                <p className="text-sm text-white/80">{feedback.justificativa}</p>
              </div>
            )}

            <p className="text-xs text-white/40 pt-2">
              Entre em contato com o suporte Zuvvi para mais informações.
            </p>
          </div>
        ) : statusAprovacao === 'em_preenchimento' ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white uppercase italic">
                Estamos quase <span className="text-zuvvi-volt">prontos!</span>
              </h2>
              <p className="text-sm text-white/60">
                Envie seus documentos para começar a lucrar com a Zuvvi.
              </p>
            </div>
            <OnboardingForm onSubmitted={() => refetch()} />
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto">
              <AlertOctagon className="w-8 h-8 text-white/40" />
            </div>
            <h2 className="text-xl font-bold italic uppercase">Aguardando</h2>
            <p className="text-sm text-muted-foreground">
              Não foi possível determinar a situação do seu cadastro.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
