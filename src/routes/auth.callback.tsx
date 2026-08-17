import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { handleGoogleAuthRedirect } from '@/lib/auth-google.functions';
import { toast } from 'sonner';

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const executeRedirectLogic = useServerFn(handleGoogleAuthRedirect);

  useEffect(() => {
    const processAuth = async () => {
      try {
        const result = await executeRedirectLogic();
        if (result.error) {
          toast.error(result.error);
        }
        navigate({ to: result.redirectTo as any });
      } catch (error) {
        console.error("Auth callback error:", error);
        toast.error("Erro na autenticação social.");
        navigate({ to: "/auth/login" });
      }
    };

    processAuth();
  }, [executeRedirectLogic, navigate]);

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="w-8 h-8 border-4 border-zuvvi-volt border-t-transparent rounded-full animate-spin"></div>
      <p className="text-white font-medium">Finalizando autenticação...</p>
    </div>
  );
}
