import { ZuvviLogo } from '@/components/brand/ZuvviLogo';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from '@tanstack/react-router';
import { ReactNode } from 'react';

interface AdminHeaderProps {
  action?: ReactNode;
}

export function AdminHeader({ action }: AdminHeaderProps) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: '/auth/login' });
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-zuvvi-indigo/90 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
        {/* LADO ESQUERDO: MARCA OFICIAL */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <ZuvviLogo surface="dark" className="h-5 sm:h-6 w-auto" />
          <div className="h-4 w-px bg-white/10 hidden xs:block" />
          <span className="text-[10px] font-bold tracking-[0.25em] text-white/30 uppercase hidden xs:block">
            Administrativo
          </span>
        </div>
        
        {/* LADO DIREITO: ÁREA DE AÇÃO OPCIONAL + SAIR */}
        <div className="flex items-center gap-2 sm:gap-3">
          {action && (
            <div className="flex items-center gap-2">
              {action}
            </div>
          )}
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSignOut}
            className="h-9 px-3 sm:px-4 rounded-xl text-white/40 hover:text-white hover:bg-white/5 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all active:scale-95"
          >
            <LogOut className="w-3 h-3" />
            <span className="hidden sm:inline">Sair do Painel</span>
            <span className="sm:hidden">Sair</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}
