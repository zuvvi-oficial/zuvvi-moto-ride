import { createFileRoute } from '@tanstack/react-router';
import { Bike } from 'lucide-react';

export const Route = createFileRoute('/onboarding-motorista')({
  component: OnboardingMotoristaPage,
});

function OnboardingMotoristaPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-6 zuvvi-glow p-10 rounded-3xl border border-border bg-card">
        <div className="w-20 h-20 rounded-full bg-zuvvi-volt/10 flex items-center justify-center mx-auto mb-4">
          <Bike className="text-zuvvi-volt w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold volt-text">Bem-vindo, Piloto!</h1>
        <p className="text-white text-lg">
          Seu cadastro básico foi concluído com sucesso.
        </p>
        <div className="space-y-4 text-muted-foreground text-sm">
          <p>
            Para começar a dirigir com o Zuvvi, precisamos que você complete seu cadastro de motorista na próxima etapa.
          </p>
          <div className="bg-zuvvi-indigo-dark/50 p-4 rounded-xl border border-white/5 text-left space-y-2">
            <p className="font-semibold text-white">Próximos passos:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Enviar foto da CNH (Categoria A ou AB)</li>
              <li>Documentação do Veículo (CRLV)</li>
              <li>Dados para pagamento (Pix)</li>
              <li>Foto de perfil</li>
            </ul>
          </div>
        </div>
        <p className="text-zuvvi-amber text-xs font-medium uppercase tracking-widest">
          Em breve: Módulo de documentos
        </p>
        <a 
          href="/"
          className="inline-block w-full py-3 bg-zuvvi-volt text-zuvvi-indigo font-bold rounded-full hover:scale-[1.02] transition-transform"
        >
          VOLTAR PARA HOME
        </a>
      </div>
    </div>
  );
}
