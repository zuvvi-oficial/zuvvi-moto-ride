import * as React from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Check,
  CheckCheck,
  MessageCircle,
  ChevronLeft,
  Loader2,
  ArrowDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Mensagem {
  id: string;
  clientMessageId: string;
  remetenteId: string;
  conteudo: string;
  createdAt: string;
  entregueAt: string | null;
  lidoAt: string | null;
}

interface ChatConversationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meuUsuarioId: string;
  interlocutor: {
    id: string;
    nome: string;
  };
  mensagens: Mensagem[];
  presenca: {
    ultimoVistoAt: string;
    digitandoAte: string | null;
  } | null;
  podeEnviar: boolean;
  loading?: boolean;
  error?: string | null;
  enviando?: boolean;
  onEnviar: (conteudo: string) => void | Promise<void>;
  onDigitandoChange?: (digitando: boolean) => void;
  onRetry?: () => void | Promise<void>;
}

export function ChatConversation({
  open,
  onOpenChange,
  meuUsuarioId,
  interlocutor,
  mensagens,
  presenca,
  podeEnviar,
  loading = false,
  error = null,
  enviando = false,
  onEnviar,
  onDigitandoChange,
  onRetry,
}: ChatConversationProps) {
  const [draft, setDraft] = React.useState("");
  const [isLocalDigitando, setIsLocalDigitando] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const typingIdleTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [showScrollBottom, setShowScrollBottom] = React.useState(false);
  const [now, setNow] = React.useState(new Date());
  const [retrying, setRetrying] = React.useState(false);

  // Clock local para expiração visual
  React.useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [open]);

  const onDigitandoChangeRef = React.useRef(onDigitandoChange);
  React.useEffect(() => {
    onDigitandoChangeRef.current = onDigitandoChange;
  }, [onDigitandoChange]);

  // Heartbeat de digitação (3000ms)
  React.useEffect(() => {
    if (!open || !isLocalDigitando) return;
    
    const interval = setInterval(() => {
      onDigitandoChangeRef.current?.(true);
    }, 3000);

    return () => {
      clearInterval(interval);
      // O cleanup de false é tratado explicitamente nos eventos (blur, send, inactivity)
      // Mas garantimos aqui também para segurança no unmount
      onDigitandoChangeRef.current?.(false);
    };
  }, [open, isLocalDigitando]);

  // Cleanup de timers no fechamento/unmount
  React.useEffect(() => {
    return () => {
      if (typingIdleTimeoutRef.current) {
        clearTimeout(typingIdleTimeoutRef.current);
        typingIdleTimeoutRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (!open) {
      if (typingIdleTimeoutRef.current) {
        clearTimeout(typingIdleTimeoutRef.current);
        typingIdleTimeoutRef.current = null;
      }
      setIsLocalDigitando(false);
      onDigitandoChangeRef.current?.(false);
    }
  }, [open]);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  // Scroll inicial e novas mensagens
  React.useEffect(() => {
    if (open && !loading && mensagens.length > 0) {
      const container = scrollRef.current;
      if (!container) return;

      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 150;

      if (isNearBottom || !showScrollBottom) {
        scrollToBottom("instant");
      }
    }
  }, [open, loading, mensagens.length, scrollToBottom, showScrollBottom]);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    setShowScrollBottom(!isNearBottom);
  };

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || content.length > 1000 || enviando) return;

    if (typingIdleTimeoutRef.current) {
      clearTimeout(typingIdleTimeoutRef.current);
      typingIdleTimeoutRef.current = null;
    }

    try {
      await onEnviar(content);
      setDraft("");
      setIsLocalDigitando(false);
      onDigitandoChangeRef.current?.(false);
      scrollToBottom();
    } catch (err) {
      // Draft mantido em caso de erro conforme requisito
    }
  };

  const handleBlur = () => {
    if (typingIdleTimeoutRef.current) {
      clearTimeout(typingIdleTimeoutRef.current);
      typingIdleTimeoutRef.current = null;
    }
    if (isLocalDigitando) {
      setIsLocalDigitando(false);
      onDigitandoChangeRef.current?.(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDraft(value);

    const isNowDigitando = value.trim().length > 0;
    if (isNowDigitando !== isLocalDigitando) {
      setIsLocalDigitando(isNowDigitando);
      onDigitandoChange?.(isNowDigitando);
    }
  };

  const formatStatus = () => {
    if (!presenca) return "Disponível no chat";

    const agora = now;
    const digitandoAte = presenca.digitandoAte ? new Date(presenca.digitandoAte) : null;
    if (digitandoAte && digitandoAte > agora) {
      return <span className="text-primary font-medium animate-pulse">Escrevendo...</span>;
    }

    const vistoAt = new Date(presenca.ultimoVistoAt);
    const diffSegundos = Math.floor((agora.getTime() - vistoAt.getTime()) / 1000);

    if (diffSegundos < 30) return "Online";
    if (diffSegundos < 60) return "Visto por último agora";
    if (diffSegundos < 3600) {
      const mins = Math.floor(diffSegundos / 60);
      return `Visto por último há ${mins} min`;
    }

    if (isToday(vistoAt)) {
      return `Visto por último às ${format(vistoAt, "HH:mm")}`;
    }

    return `Visto por último em ${format(vistoAt, "dd/MM 'às' HH:mm", { locale: ptBR })}`;
  };

  const renderMessages = () => {
    if (loading) {
      return (
        <div className="space-y-4 p-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "flex flex-col gap-1 max-w-[82%]",
                i % 2 === 0 ? "ml-auto items-end" : "items-start",
              )}
            >
              <div
                className={cn(
                  "h-12 w-32 rounded-2xl animate-pulse bg-muted",
                  i % 2 === 0 ? "rounded-tr-none" : "rounded-tl-none",
                )}
              />
            </div>
          ))}
        </div>
      );
    }

    if (error && mensagens.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
          <p className="text-muted-foreground">Não foi possível carregar a conversa.</p>
          {onRetry && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={async () => {
                setRetrying(true);
                try {
                  await onRetry();
                } finally {
                  setRetrying(false);
                }
              }}
              disabled={retrying}
            >
              {retrying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Carregando...
                </>
              ) : (
                "Tentar novamente"
              )}
            </Button>
          )}
        </div>
      );
    }

    if (mensagens.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
            <MessageCircle className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground">Comece a conversa</h3>
          <p className="text-sm text-muted-foreground">
            Combine detalhes do embarque com segurança.
          </p>
        </div>
      );
    }

    const grouped: { [key: string]: Mensagem[] } = {};
    mensagens.forEach((m) => {
      const date = format(new Date(m.createdAt), "yyyy-MM-dd");
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(m);
    });

    return (
      <div className="flex flex-col gap-4 p-4 min-h-full">
        {error && (
          <div className="flex items-center justify-center p-2 mb-2 bg-destructive/10 text-destructive text-[11px] rounded-lg animate-in fade-in slide-in-from-top-2">
            Falha na sincronização.
            {onRetry && (
              <button 
                onClick={async () => {
                  setRetrying(true);
                  try {
                    await onRetry();
                  } finally {
                    setRetrying(false);
                  }
                }}
                disabled={retrying}
                className="ml-2 underline font-bold disabled:opacity-50"
              >
                {retrying ? "Carregando..." : "Tentar agora"}
              </button>
            )}
          </div>
        )}
        {Object.entries(grouped).map(([dateStr, msgs]) => {
          const date = new Date(dateStr + "T12:00:00");
          let label = format(date, "dd/MM/yyyy");
          if (isToday(date)) label = "Hoje";
          else if (isYesterday(date)) label = "Ontem";

          return (
            <React.Fragment key={dateStr}>
              <div className="flex justify-center my-2">
                <span className="bg-muted text-muted-foreground text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full">
                  {label}
                </span>
              </div>
              {msgs.map((m) => {
                const isMine = m.remetenteId === meuUsuarioId;
                return (
                  <div
                    key={m.id || m.clientMessageId}
                    className={cn(
                      "flex flex-col gap-1 max-w-[82%] group relative",
                      isMine ? "ml-auto items-end" : "items-start",
                    )}
                  >
                    <div
                      className={cn(
                        "px-4 py-2.5 rounded-2xl text-sm break-words whitespace-pre-wrap shadow-sm",
                        isMine
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-card text-foreground border rounded-tl-none",
                      )}
                    >
                      {m.conteudo}
                    </div>
                    <div className="flex items-center gap-1.5 px-1">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {format(new Date(m.createdAt), "HH:mm")}
                      </span>
                      {isMine && (
                        <div className="flex items-center">
                          {m.lidoAt ? (
                            <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                          ) : m.entregueAt ? (
                            <CheckCheck className="w-3.5 h-3.5 text-muted-foreground/60" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-muted-foreground/60" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden border-none sm:border flex flex-col sm:rounded-3xl",
          "w-full h-[100dvh] sm:max-w-[460px] sm:h-[90vh] sm:max-h-[720px]",
          "sm:shadow-2xl transition-all duration-300",
          "[&>button]:hidden",
        )}
        overlayClassName="bg-black/[0.86]"
      >
        <DialogHeader className="p-0 space-y-0 text-left border-b bg-background z-20 shrink-0">
          <div className="flex items-center h-16 px-4 gap-3 pt-[env(safe-area-inset-top)] box-content">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full shrink-0 sm:hidden"
              onClick={() => onOpenChange(false)}
              aria-label="Fechar chat"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>

            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                <span className="text-primary font-bold text-lg">
                  {interlocutor.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex flex-col overflow-hidden">
                <DialogTitle className="text-base font-bold truncate">
                  {interlocutor.nome}
                </DialogTitle>
                <div
                  className="text-xs text-muted-foreground leading-none mt-0.5"
                  aria-live="polite"
                >
                  {formatStatus()}
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:flex h-11 w-11 rounded-full shrink-0 ml-auto"
              onClick={() => onOpenChange(false)}
              aria-label="Fechar chat"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </DialogHeader>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto bg-muted/30 scroll-smooth relative"
          aria-label="Mensagens da conversa"
        >
          {renderMessages()}
        </div>

        {showScrollBottom && !loading && mensagens.length > 0 && (
          <Button
            size="sm"
            variant="secondary"
            className="absolute bottom-24 right-4 z-30 rounded-full shadow-lg h-9 gap-2 px-3 border border-border animate-in fade-in slide-in-from-bottom-2"
            onClick={() => scrollToBottom()}
          >
            Novas mensagens
            <ArrowDown className="w-4 h-4" />
          </Button>
        )}

        <div className="shrink-0 bg-background border-t pb-[env(safe-area-inset-bottom)] z-20">
          {podeEnviar ? (
            <div className="p-3 sm:p-4">
              <div className="flex items-end gap-2 bg-muted/50 rounded-2xl p-2 border border-border focus-within:border-primary/30 focus-within:bg-background transition-all">
                <div className="flex-1 flex flex-col">
                  {draft.length >= 850 && (
                    <span className="text-[10px] text-right font-medium text-muted-foreground mb-1 mr-2">
                      {draft.length}/1000
                    </span>
                  )}
                  <Textarea
                    placeholder="Digite uma mensagem..."
                    aria-label="Digite uma mensagem"
                    className="min-h-[44px] max-h-32 bg-transparent border-none focus-visible:ring-0 resize-none py-2.5"
                    value={draft}
                    onChange={handleDraftChange}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    maxLength={1000}
                  />
                </div>
                <Button
                  size="icon"
                  className="rounded-full h-11 w-11 shrink-0 mb-0.5"
                  disabled={!draft.trim() || draft.length > 1000 || enviando}
                  onClick={handleSend}
                  aria-label="Enviar mensagem"
                >
                  {enviando ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 ml-0.5" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center space-y-1">
              <p className="font-semibold text-foreground text-sm">
                Chat pausado durante ou após a corrida.
              </p>
              <p className="text-xs text-muted-foreground">
                Por segurança, novas mensagens não estão disponíveis.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
