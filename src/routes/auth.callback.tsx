import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { handleGoogleAuthRedirect } from '@/lib/auth-google.functions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const executeRedirectLogic = useServerFn(handleGoogleAuthRedirect);

  useEffect(() => {
    const processAuth = async () => {
      try {
        const result = await executeRedirectLogic();
        if (result.error) {
          setError(result.error);
          toast.error(result.error);
          return;
        }
        
        // Final redirection
        navigate({ to: result.redirectTo as any });
      } catch (err) {
        console.error("Auth callback error:", err);
        setError("Ocorreu um erro inesperado na autenticação social.");
        toast.error("Erro na autenticação social.");
      }
    };

    processAuth();
  }, [executeRedirectLogic, navigate]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-6 text-center animate-in fade-in duration-500">
        <div className="bg-red-500/10 p-4 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Falha na Autenticação</h2>
          <p className="text-muted-foreground text-sm max-w-[280px]">
            {error}
          </p>
        </div>
        <Button asChild className="w-full bg-zuvvi-volt text-zuvvi-indigo hover:bg-zuvvi-volt/90 font-bold">
          <Link to="/auth/login">Voltar ao Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-6 text-center">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-zuvvi-volt/20 border-t-zuvvi-volt rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-zuvvi-volt rounded-full animate-pulse"></div>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-white font-bold text-lg">Processando...</p>
        <p className="text-muted-foreground text-sm">Validando sua conta Google</p>
      </div>
    </div>
  );
}
