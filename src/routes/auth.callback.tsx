import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { handleGoogleAuthRedirect } from '@/lib/auth-google.functions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const executeRedirectLogic = useServerFn(handleGoogleAuthRedirect);

  useEffect(() => {
    let cancelled = false;

    const waitForSession = async () => {
      for (let i = 0; i < 25; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) return data.session;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return null;
    };

    const processAuth = async () => {
      try {
        console.log("[GoogleAuth] callback_started");
        
        const session = await waitForSession();
        if (cancelled) return;
        
        if (!session) {
          console.log("[GoogleAuth] session_found=false");
          setError('Não conseguimos confirmar seu login com o Google. Tente novamente.');
          return;
        }

        console.log("[GoogleAuth] session_found=true");
        console.log("[GoogleAuth] session_found=true");
        console.log("[GoogleAuth] calling_redirect_logic");
        // We pass the token manually and ensure getSession() is stable
        const currentSession = await supabase.auth.getSession();
        const activeToken = currentSession.data.session?.access_token || session.access_token;
        console.log("[GoogleAuth] access_token_present=" + !!activeToken);
        
        const result = await executeRedirectLogic({
          data: undefined, // Ensure no body interference
          headers: {
            Authorization: `Bearer ${activeToken}`
          }
        });
        
        if (cancelled) return;
        
        console.log("[GoogleAuth] redirect_logic_result_received");
        
        if (result.error) {
          console.log("[GoogleAuth] redirect_logic_failed error=" + result.error);
          setError(result.error);
          toast.error(result.error);
          return;
        }
        
        console.log("[GoogleAuth] redirect_logic_success to=" + result.redirectTo);
        
        // Final redirection (navigation duplication fixed by removing the extra call that was here)
        navigate({ to: result.redirectTo as any });
      } catch (err: any) {
        console.error("[GoogleAuth] unexpected_error:", err);
        if (cancelled) return;
        
        const errorMessage = err?.message || String(err);
        console.log(`[GoogleAuth] error_details: ${errorMessage}`);
        
        // Provide more specific feedback for common auth failures
        if (errorMessage.includes("Unauthorized")) {
          setError("Sessão não autorizada. Por favor, tente o login novamente.");
        } else if (errorMessage.includes("Database") || errorMessage.includes("perfil")) {
          setError("Erro ao sincronizar seu perfil. Tente novamente em instantes.");
        } else {
          setError(`Erro na autenticação: ${errorMessage.slice(0, 100)}`);
        }
        toast.error("Erro na autenticação social.");
      }
    };

    processAuth();
    return () => {
      cancelled = true;
    };
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
