import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import OnboardingForm from '@/components/motorista/OnboardingForm';
import { resolveDestinationForLoader } from '@/lib/auth-status.functions';
import { getSessionUser } from '@/lib/user.functions';
import { Loader2, User, Clock } from 'lucide-react';
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
  
  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ['session-user'],
    queryFn: () => getSessionUserFn(),
  });

  if (isLoading || !user) {
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
          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-zuvvi-volt/10 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-zuvvi-volt" />
            </div>
            <h2 className="text-xl font-bold">Perfil em análise</h2>
            <p className="text-sm text-muted-foreground">
              Estamos verificando seus documentos. Você receberá um aviso assim que for aprovado para pilotar.
            </p>
          </div>
        ) : (
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
        )}
      </main>
    </div>
  );
}
