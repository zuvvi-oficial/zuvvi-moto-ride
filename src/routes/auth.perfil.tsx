import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { selectPassageiroPerfil, selectMotoristaPerfil } from '@/lib/perfil.functions';
import { useServerFn } from '@tanstack/react-start';
import { Bike, User } from 'lucide-react';

export const Route = createFileRoute('/auth/perfil')({
  component: PerfilPage,
});

function PerfilPage() {
  const navigate = useNavigate();
  const executeSelectPassageiro = useServerFn(selectPassageiroPerfil);
  const executeSelectMotorista = useServerFn(selectMotoristaPerfil);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectPassageiro = async () => {
    setIsLoading(true);
    try {
      await executeSelectPassageiro();
      toast.success("Perfil de passageiro ativado!");
      navigate({ to: "/" });
    } catch (error: any) {
      toast.error("Erro ao selecionar perfil. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectMotorista = async () => {
    setIsLoading(true);
    try {
      await executeSelectMotorista();
      toast.success("Perfil de motorista ativado!");
      navigate({ to: "/onboarding-motorista" as any }); // Placeholder route
    } catch (error: any) {
      toast.error("Erro ao selecionar perfil. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-rise">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white">Como você quer usar o Zuvvi?</h2>
        <p className="text-muted-foreground text-sm mt-2">Escolha seu caminho na cidade</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card Passageiro */}
        <button
          onClick={handleSelectPassageiro}
          disabled={isLoading}
          className="group relative flex flex-col items-center p-8 rounded-2xl bg-zuvvi-indigo-dark border border-white/10 transition-all hover:border-zuvvi-volt hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-16 h-16 rounded-full bg-zuvvi-volt/10 flex items-center justify-center mb-4 transition-colors group-hover:bg-zuvvi-volt/20">
            <User className="text-zuvvi-volt w-8 h-8" />
          </div>
          <h3 className="text-white font-bold text-lg mb-2">Quero pedir corridas</h3>
          <p className="text-muted-foreground text-sm text-center">
            Mova-se pela cidade com rapidez e segurança.
          </p>
        </button>

        {/* Card Motorista */}
        <button
          onClick={handleSelectMotorista}
          disabled={isLoading}
          className="group relative flex flex-col items-center p-8 rounded-2xl bg-zuvvi-indigo-dark border border-white/10 transition-all hover:border-zuvvi-volt hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-16 h-16 rounded-full bg-zuvvi-violet/10 flex items-center justify-center mb-4 transition-colors group-hover:bg-zuvvi-violet/20">
            <Bike className="text-zuvvi-violet w-8 h-8" />
          </div>
          <h3 className="text-white font-bold text-lg mb-2">Quero dirigir e ganhar</h3>
          <p className="text-muted-foreground text-sm text-center">
            Seja seu próprio chefe e aumente sua renda.
          </p>
        </button>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Você poderá adicionar o outro perfil mais tarde nas configurações.
      </div>
    </div>
  );
}
