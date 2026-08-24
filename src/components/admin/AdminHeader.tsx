import { ZuvviLogo } from '@/components/brand/ZuvviLogo';
import { ReactNode } from 'react';
import { ChevronLeft, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { supabase } from "@/integrations/supabase/client";

interface AdminHeaderProps {
  action?: ReactNode;
}

export function AdminHeader({ action }: AdminHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isInternalPage = location.pathname !== '/admin' && location.pathname !== '/admin/';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-zuvvi-indigo/90 backdrop-blur-xl border-b border-white/5 pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-20 flex items-center justify-between gap-4">
        {/* LADO ESQUERDO: VOLTAR OU LOGO */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {isInternalPage && (
            <button 
              onClick={() => navigate({ to: '/admin' })}
              className="md:hidden w-8 h-8 flex items-center justify-center bg-white/5 rounded-full border border-white/10 active:scale-95 transition-transform"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          )}
          <ZuvviLogo surface="dark" className="h-4 sm:h-6 w-auto" />
          <div className="h-4 w-px bg-white/10 hidden xs:block" />
          <span className="text-[9px] font-black tracking-[0.2em] text-white/20 uppercase hidden xs:block">
            Administrativo
          </span>
        </div>
        
        {/* LADO DIREITO: AÇÕES */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile "Sair" action if no specific action provided, or alongside it */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSignOut}
            className="h-8 px-2 sm:px-4 rounded-xl text-white/40 hover:text-white hover:bg-white/5 font-black uppercase text-[9px] tracking-widest flex items-center gap-1.5 transition-all active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="sm:inline">Sair</span>
          </Button>

          {/* Reserved area for page-specific actions (like filters or toggles) on Desktop */}
          {action && (
            <div className="hidden md:flex items-center gap-2">
              {action}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

