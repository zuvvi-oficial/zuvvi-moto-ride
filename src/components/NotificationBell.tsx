import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BadgeCheck,
  Bell,
  BellRing,
  Bike,
  CheckCheck,
  CircleCheck,
  CircleX,
  FileCheck2,
  FileX2,
  Flag,
  MapPin,
  Navigation,
  Play,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, isThisYear, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useSoundStore } from '@/hooks/use-sound';

export interface NotificationBellItem {
  id: string;
  usuario_id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  corrida_id: string | null;
  lida: boolean;
  created_at: string;
}

interface NotificationBellProps {
  onImportantNotification?: (notification: NotificationBellItem) => void;
}

const isPixOperationalNotice = (notification: NotificationBellItem) =>
  notification.titulo === 'Pagamento não concluído' ||
  (
    notification.titulo === 'Corrida cancelada' &&
    notification.mensagem.includes('pagamento Pix')
  );

type NotificationVisual = {
  icon: LucideIcon;
  iconClassName: string;
};

const NOTIFICATION_VISUALS: Record<string, NotificationVisual> = {
  motorista_aceitou: { icon: Bike, iconClassName: 'text-zuvvi-volt' },
  motorista_a_caminho: { icon: Navigation, iconClassName: 'text-zuvvi-volt' },
  motorista_chegou: { icon: Flag, iconClassName: 'text-amber-300' },
  corrida_iniciada: { icon: Play, iconClassName: 'text-sky-300' },
  corrida_concluida: { icon: CircleCheck, iconClassName: 'text-emerald-300' },
  corrida_cancelada: { icon: CircleX, iconClassName: 'text-red-300' },
  nova_oferta_corrida: { icon: MapPin, iconClassName: 'text-zuvvi-volt' },
  documento_aprovado: { icon: FileCheck2, iconClassName: 'text-emerald-300' },
  documento_recusado: { icon: FileX2, iconClassName: 'text-red-300' },
  motorista_aprovado: { icon: BadgeCheck, iconClassName: 'text-zuvvi-volt' },
};

const getNotificationVisual = (tipo: string): NotificationVisual =>
  NOTIFICATION_VISUALS[tipo] || {
    icon: BellRing,
    iconClassName: 'text-zuvvi-volt',
  };

const getNotificationTitle = (titulo: string) =>
  titulo.replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Atualização Zuvvi';

const getDateGroupLabel = (date: Date) => {
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';

  const label = format(
    date,
    isThisYear(date) ? "d 'de' MMMM" : "d 'de' MMMM 'de' yyyy",
    { locale: ptBR }
  );

  return label.charAt(0).toUpperCase() + label.slice(1);
};

const groupNotificationsByDate = (notifications: NotificationBellItem[]) =>
  notifications.reduce<Array<{
    key: string;
    label: string;
    items: NotificationBellItem[];
  }>>((groups, notification) => {
    const date = new Date(notification.created_at);
    const key = format(date, 'yyyy-MM-dd');
    const currentGroup = groups[groups.length - 1];

    if (currentGroup?.key === key) {
      currentGroup.items.push(notification);
      return groups;
    }

    groups.push({
      key,
      label: getDateGroupLabel(date),
      items: [notification],
    });

    return groups;
  }, []);

export function NotificationBell({ onImportantNotification }: NotificationBellProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const queryClient = useQueryClient();
  const initialImportantDeliveredRef = useRef(false);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
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

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowClearConfirm(false);
        setIsOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('aria-hidden'));

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen]);

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

  const notificacoesVisiveis = notificacoes.filter(
    (notification: NotificationBellItem) => !isPixOperationalNotice(notification)
  );
  const unreadCount = notificacoesVisiveis.filter((n: NotificationBellItem) => !n.lida).length;
  const notificationGroups = groupNotificationsByDate(notificacoesVisiveis);

  useEffect(() => {
    if (
      initialImportantDeliveredRef.current ||
      !onImportantNotification ||
      notificacoes.length === 0
    ) {
      return;
    }

    initialImportantDeliveredRef.current = true;
    const limiteRecente = Date.now() - 15 * 60 * 1000;
    const latestImportant = notificacoes.find(
      (notification: NotificationBellItem) =>
        !notification.lida &&
        isPixOperationalNotice(notification) &&
        new Date(notification.created_at).getTime() >= limiteRecente
    );

    if (latestImportant) onImportantNotification(latestImportant);
  }, [notificacoes, onImportantNotification]);

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

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Usuário não identificado');
      const { error } = await supabase
        .from('notificacoes' as any)
        .update({ lida: true } as any)
        .eq('usuario_id', userId)
        .eq('lida', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes', userId] });
    },
    onError: () => {
      toast.error('Não foi possível marcar as notificações como lidas.');
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Usuário não identificado');
      const { error } = await supabase
        .from('notificacoes' as any)
        .delete()
        .eq('usuario_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes', userId] });
      setShowClearConfirm(false);
      toast.success('Notificações limpas');
    },
    onError: () => {
      toast.error('Não foi possível limpar as notificações.');
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
          const newNotif = payload.new as NotificationBellItem;
          queryClient.setQueryData(['notificacoes', userId], (old: NotificationBellItem[] = []) => [newNotif, ...old]);

          if (isPixOperationalNotice(newNotif)) {
            onImportantNotification?.(newNotif);
          } else {
            toast(newNotif.titulo, {
              description: newNotif.mensagem,
            });
          }

          playNotification();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient, onImportantNotification]);

  const closeNotifications = () => {
    setShowClearConfirm(false);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={triggerButtonRef}
        type="button"
        onClick={() => (isOpen ? closeNotifications() : setIsOpen(true))}
        className="relative flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zuvvi-volt focus-visible:ring-offset-2 focus-visible:ring-offset-zuvvi-indigo"
        aria-label={
          unreadCount > 0
            ? `Notificações, ${unreadCount} não ${unreadCount === 1 ? 'lida' : 'lidas'}`
            : 'Notificações, nenhuma não lida'
        }
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className="h-6 w-6 text-white" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-zuvvi-indigo bg-zuvvi-volt px-1 text-[10px] font-extrabold leading-none text-zuvvi-indigo shadow-sm"
            aria-hidden="true"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm"
            onClick={closeNotifications}
            aria-hidden="true"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-dialog-title"
            tabIndex={-1}
            className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[9999] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-32px)] max-w-[420px] -translate-x-1/2 flex-col overflow-hidden rounded-3xl border border-white/10 bg-zuvvi-indigo-dark shadow-[0_24px_80px_rgba(0,0,0,0.65)] animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    id="notification-dialog-title"
                    className="text-base font-semibold tracking-tight text-white"
                  >
                    Notificações
                  </h2>
                  {notificacoesVisiveis.length > 0 && (
                    <p className="mt-0.5 text-[11px] font-medium text-white/45">
                      {unreadCount > 0
                        ? `${unreadCount} ${unreadCount === 1 ? 'nova atualização' : 'novas atualizações'}`
                        : 'Você está em dia'}
                    </p>
                  )}
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={closeNotifications}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zuvvi-volt"
                  aria-label="Fechar notificações"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {notificacoesVisiveis.length > 0 && (
                <div className="mt-2 flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllAsReadMutation.mutate()}
                      disabled={markAllAsReadMutation.isPending}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-sm font-semibold text-zuvvi-volt transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zuvvi-volt disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCheck className="h-4 w-4" aria-hidden="true" />
                      {markAllAsReadMutation.isPending ? 'Marcando...' : 'Marcar lidas'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    disabled={deleteAllMutation.isPending}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-sm font-semibold text-red-300 transition-colors hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Limpar
                  </button>
                </div>
              )}
            </div>

            {showClearConfirm && notificacoesVisiveis.length > 0 && (
              <div
                className="mx-4 mt-4 rounded-2xl border border-red-300/20 bg-red-400/10 p-4"
                role="alert"
                aria-live="assertive"
              >
                <p className="text-sm font-semibold text-white">Limpar notificações?</p>
                <p className="mt-1.5 text-xs leading-relaxed text-white/65">
                  As notificações serão removidas desta central. Corridas, ganhos e pagamentos não serão afetados.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    disabled={deleteAllMutation.isPending}
                    className="min-h-11 rounded-xl px-4 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteAllMutation.mutate()}
                    disabled={deleteAllMutation.isPending}
                    className="min-h-11 rounded-xl bg-red-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleteAllMutation.isPending ? 'Limpando...' : 'Limpar'}
                  </button>
                </div>
              </div>
            )}

            <div
              className="flex-1 overflow-y-auto overscroll-contain"
              aria-busy={
                markAsReadMutation.isPending ||
                markAllAsReadMutation.isPending ||
                deleteAllMutation.isPending
              }
            >
              {notificacoesVisiveis.length === 0 ? (
                <div className="flex flex-col items-center px-8 py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zuvvi-volt/20 bg-zuvvi-volt/10">
                    <BellRing className="h-7 w-7 text-zuvvi-volt" aria-hidden="true" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-white">Tudo em dia</p>
                  <p className="mt-1 max-w-[260px] text-sm leading-relaxed text-white/55">
                    Quando houver uma atualização importante sobre sua corrida, ela aparecerá aqui.
                  </p>
                </div>
              ) : (
                notificationGroups.map((group) => (
                  <section
                    key={group.key}
                    aria-labelledby={`notification-group-${group.key}`}
                  >
                    <div
                      id={`notification-group-${group.key}`}
                      className="sticky top-0 z-10 border-y border-white/[0.05] bg-zuvvi-indigo-dark/95 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45 backdrop-blur-md"
                    >
                      {group.label}
                    </div>

                    {group.items.map((notification) => {
                      const visual = getNotificationVisual(notification.tipo);
                      const NotificationIcon = visual.icon;
                      const title = getNotificationTitle(notification.titulo);

                      return (
                        <button
                          key={notification.id}
                          type="button"
                          className={cn(
                            'group flex w-full gap-3 border-b border-l-2 border-b-white/[0.06] border-l-transparent px-5 py-4 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zuvvi-volt',
                            !notification.lida && 'border-l-zuvvi-volt bg-zuvvi-volt/[0.055]'
                          )}
                          onClick={() => {
                            if (!notification.lida) {
                              markAsReadMutation.mutate(notification.id);
                            }
                          }}
                          aria-label={`${title}. ${notification.mensagem}. ${format(
                            new Date(notification.created_at),
                            "d 'de' MMMM 'às' HH:mm",
                            { locale: ptBR }
                          )}. ${notification.lida ? 'Lida' : 'Não lida'}.`}
                        >
                          <span
                            className={cn(
                              'relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055]',
                              !notification.lida && 'border-zuvvi-volt/20 bg-zuvvi-volt/10'
                            )}
                            aria-hidden="true"
                          >
                            <NotificationIcon className={cn('h-5 w-5', visual.iconClassName)} />
                            {!notification.lida && (
                              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-zuvvi-indigo-dark bg-zuvvi-volt shadow-[0_0_10px_rgba(198,255,61,0.55)]" />
                            )}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-3">
                              <span className="text-sm font-semibold leading-snug text-white">
                                {title}
                              </span>
                              <time
                                dateTime={notification.created_at}
                                className="whitespace-nowrap text-[11px] font-medium text-white/40"
                              >
                                {format(new Date(notification.created_at), 'HH:mm', {
                                  locale: ptBR,
                                })}
                              </time>
                            </span>
                            <span className="mt-1.5 block text-xs leading-relaxed text-white/65">
                              {notification.mensagem}
                            </span>
                            <span className="sr-only">
                              {notification.lida ? 'Notificação lida' : 'Notificação não lida'}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </section>
                ))
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
