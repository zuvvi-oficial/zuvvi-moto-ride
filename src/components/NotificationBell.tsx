import React, { useEffect, useState, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import zuvviPingAsset from '@/assets/zuvvi_volt_ping.mp3.asset.json';

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

    // Destravar áudio na primeira interação do usuário (Autoplay policy)
    const unlockAudio = () => {
      if (audioRef.current) {
        audioRef.current.play()
          .then(() => {
            audioRef.current?.pause();
            if (audioRef.current) audioRef.current.currentTime = 0;
          })
          .catch(() => {
            // Silencioso, apenas para destravar
          });
      }
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
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
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.warn('Audio play failed', e));
    }
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
      <audio ref={audioRef} src={zuvviPingAsset.url} preload="auto" />
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
        aria-label="Notificações"
      >
        <Bell className="w-6 h-6 text-white" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-volt text-[10px] font-bold text-indigo-dark border-2 border-indigo-dark">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 max-h-[400px] bg-white rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col border border-gray-100 animate-in fade-in slide-in-from-top-2">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-semibold text-indigo-dark">Notificações</h3>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-200 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 bg-white">
              {notificacoes.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  Nenhuma notificação por aqui.
                </div>
              ) : (
                notificacoes.map((n) => (
                  <div 
                    key={n.id}
                    className={cn(
                      "p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer",
                      !n.lida && "bg-indigo-50/30"
                    )}
                    onClick={() => {
                      if (!n.lida) markAsReadMutation.mutate(n.id);
                    }}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-medium text-sm text-indigo-dark leading-tight">{n.titulo}</span>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {format(new Date(n.created_at), "HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{n.mensagem}</p>
                    {!n.lida && (
                      <div className="w-2 h-2 rounded-full bg-volt mt-2" />
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
