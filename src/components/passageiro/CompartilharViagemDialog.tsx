import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  compartilharCorrida,
  encerrarCompartilhamentoCorrida,
} from "@/lib/viagem-compartilhada.functions";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Share2, Copy, MessageCircleHeart } from "lucide-react";

interface CompartilharViagemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
}

function buildShareUrl(linkPublico: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://zuvvi-moto-ride.lovable.app";
  return `${origin}/viagem-compartilhada?token=${encodeURIComponent(linkPublico)}`;
}

function copyWithFallback(text: string, container?: HTMLElement | null) {
  // O Radix Dialog prende o foco dentro do próprio conteúdo do modal
  // (FocusScope): um textarea anexado a document.body nunca fica de fato
  // focado, porque o Radix redireciona o foco de volta pro dialog assim que
  // ele sai do escopo. O fallback só funciona se o elemento temporário viver
  // dentro do próprio DialogContent.
  const parent = container ?? document.body;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  parent.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const ok = document.execCommand("copy");
  parent.removeChild(textarea);
  if (!ok) throw new Error("execCommand copy failed");
}

export function CompartilharViagemDialog({ open, onOpenChange, rideId }: CompartilharViagemDialogProps) {
  const compartilharFn = useServerFn(compartilharCorrida);
  const encerrarFn = useServerFn(encerrarCompartilhamentoCorrida);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const compartilharMutation = useMutation({
    mutationFn: () => compartilharFn({ data: { rideId } }),
    onSuccess: (result) => {
      setShareUrl(buildShareUrl(result.linkPublico));
    },
    onError: () => {
      toast.error("Não foi possível gerar o link de compartilhamento.");
    },
  });

  const encerrarMutation = useMutation({
    mutationFn: () => encerrarFn({ data: { rideId } }),
    onSuccess: () => {
      setShareUrl(null);
      toast.success("Compartilhamento encerrado.");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Não foi possível encerrar o compartilhamento.");
    },
  });

  React.useEffect(() => {
    if (open && !shareUrl && !compartilharMutation.isPending) {
      compartilharMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        copyWithFallback(shareUrl, contentRef.current);
      }
      toast.success("Link copiado.");
    } catch {
      try {
        copyWithFallback(shareUrl, contentRef.current);
        toast.success("Link copiado.");
      } catch {
        toast.error("Não foi possível copiar o link.");
      }
    }
  };

  const handleWhatsapp = () => {
    if (!shareUrl) return;
    const mensagem = `Estou numa corrida Zuvvi. Acompanhe em tempo real: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        className="w-[92vw] max-w-[92vw] sm:max-w-md rounded-[2rem] border-white/10 bg-zuvvi-indigo text-white p-6"
      >
        <DialogHeader className="items-center text-center space-y-3 sm:items-start sm:text-left">
          <div className="w-12 h-12 rounded-2xl bg-zuvvi-volt/15 border border-zuvvi-volt/30 flex items-center justify-center shrink-0">
            <Share2 className="h-5 w-5 text-zuvvi-volt" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-white text-lg font-bold">Compartilhar viagem</DialogTitle>
            <DialogDescription className="text-white/60 text-sm leading-relaxed">
              Quem receber o link acompanha sua corrida em tempo real, sem precisar de conta na Zuvvi.
            </DialogDescription>
          </div>
        </DialogHeader>

        {compartilharMutation.isPending ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-zuvvi-volt" />
          </div>
        ) : shareUrl ? (
          <div className="space-y-4 min-w-0">
            <div className="flex items-center justify-between gap-3 min-w-0 rounded-xl bg-zuvvi-indigo/60 border border-white/10 px-4 py-3">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-white/80">{shareUrl}</span>
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copiar link"
                className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 hover:bg-white/10 transition-colors"
              >
                <Copy className="w-4 h-4 text-zuvvi-volt" />
              </button>
            </div>

            <Button
              type="button"
              className="w-full h-12 rounded-xl bg-zuvvi-volt text-zuvvi-indigo font-bold hover:bg-zuvvi-volt/90"
              onClick={handleWhatsapp}
            >
              <MessageCircleHeart className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">Compartilhar no WhatsApp</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/5"
              onClick={() => encerrarMutation.mutate()}
              disabled={encerrarMutation.isPending}
            >
              <span className="truncate">
                {encerrarMutation.isPending ? "Encerrando..." : "Encerrar compartilhamento"}
              </span>
            </Button>
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-white/60">
            Não foi possível gerar o link agora.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
