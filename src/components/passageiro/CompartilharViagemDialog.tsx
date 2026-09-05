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

export function CompartilharViagemDialog({ open, onOpenChange, rideId }: CompartilharViagemDialogProps) {
  const compartilharFn = useServerFn(compartilharCorrida);
  const encerrarFn = useServerFn(encerrarCompartilhamentoCorrida);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);

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
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const handleWhatsapp = () => {
    if (!shareUrl) return;
    const mensagem = `Estou numa corrida Zuvvi. Acompanhe em tempo real: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-zuvvi-volt" />
            Compartilhar viagem
          </DialogTitle>
          <DialogDescription>
            Quem receber o link acompanha sua corrida em tempo real, sem precisar de conta na Zuvvi.
          </DialogDescription>
        </DialogHeader>

        {compartilharMutation.isPending ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-zuvvi-volt" />
          </div>
        ) : shareUrl ? (
          <div className="space-y-3">
            <div className="truncate rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
              {shareUrl}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar link
              </Button>
              <Button type="button" className="flex-1 bg-zuvvi-volt text-zuvvi-indigo hover:opacity-90" onClick={handleWhatsapp}>
                <MessageCircleHeart className="mr-2 h-4 w-4" />
                WhatsApp
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-red-400 hover:text-red-300"
              onClick={() => encerrarMutation.mutate()}
              disabled={encerrarMutation.isPending}
            >
              {encerrarMutation.isPending ? "Encerrando..." : "Encerrar compartilhamento"}
            </Button>
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Não foi possível gerar o link agora.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
