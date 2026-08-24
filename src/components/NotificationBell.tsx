import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useSoundStore } from '@/hooks/use-sound';

interface Notificacao {
  id: string;
  usuario_id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  corrida_id: string | null;
  lida: boolean;
  created_at: string;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const playSound = useSoundStore((state: any) => state.play);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) {
        supabase
          .from('usuarios')
          .select('id')
          .eq('auth_user_id', data.user.id)
          .single()
          .then(({ data: usuario }) => {
            if (usuario) setUserId(usuario.id);
          });
      }
    });
  }, []);

  const { data: notificacoes = [] } = useQuery({
    queryKey: ['notificacoes', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('notificacoes' as any)
        .select('*')
        .eq('usuario_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!userId,
  });

  const unreadCount = notificacoes.filter((n: any) => !n.lida).length;

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notificacoes' as any)
        .update({ lida: true } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
    },
  });

  const playNotification = () => {
    playSound('/sounds/zuvvi_volt_ping.mp3').catch((e: any) => console.error('[NotificationBell] Audio play failed', e));
    if ('vibrate' in navigator) {
      navigator.vibrate([200]);
    }
  };

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notificacoes:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
          filter: `usuario_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notificacao;
          queryClient.setQueryData(['notificacoes', userId], (old: Notificacao[] = []) => [newNotif, ...old]);
          
          toast(newNotif.titulo, {
            description: newNotif.mensagem,
          });
          
          playNotification();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
        aria-label="Notificações"
      >
        <Bell className="w-6 h-6 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-zuvvi-volt text-[10px] leading-none font-extrabold text-zuvvi-indigo border-2 border-zuvvi-indigo shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]" 
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+96px)] z-50 w-[calc(100vw-32px)] max-w-[420px] max-h-[70dvh] -translate-x-1/2 overflow-hidden flex flex-col rounded-3xl border border-white/10 bg-zuvvi-indigo-dark/95 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-white text-base font-semibold tracking-tight">Notificações</h3>
              <button 
                onClick={() => setIsOpen(false)} 
                className="h-9 w-9 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1">
              {notificacoes.length === 0 ? (
                <div className="p-10 text-center text-white/60 text-sm">
                  Nenhuma notificação por aqui.
                </div>
              ) : (
                notificacoes.map((n) => (
                  <div 
                    key={n.id}
                    className={cn(
                      "px-5 py-4 border-b border-white/[0.06] transition-colors cursor-pointer hover:bg-white/[0.04]",
                      !n.lida && "bg-zuvvi-volt/5"
                    )}
                    onClick={() => {
                      if (!n.lida) markAsReadMutation.mutate(n.id);
                    }}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <span className="text-sm font-semibold text-white leading-snug">{n.titulo}</span>
                      <span className="text-[11px] font-medium text-white/40 whitespace-nowrap">
                        {format(new Date(n.created_at), "HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-white/65 mt-1.5">{n.mensagem}</p>
                    {!n.lida && (
                      <div className="w-2 h-2 rounded-full bg-zuvvi-volt mt-2 shadow-[0_0_10px_rgba(198,255,61,0.55)]" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
