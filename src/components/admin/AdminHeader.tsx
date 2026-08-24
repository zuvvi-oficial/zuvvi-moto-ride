import { ZuvviLogo } from '@/components/brand/ZuvviLogo';
import { ReactNode } from 'react';

interface AdminHeaderProps {
  action?: ReactNode;
}

export function AdminHeader({ action }: AdminHeaderProps) {
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
        
        {/* LADO DIREITO: ÁREA DE AÇÃO OPCIONAL */}
        <div className="flex items-center gap-2 sm:gap-3">
          {action && (
            <div className="flex items-center gap-2">
              {action}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

