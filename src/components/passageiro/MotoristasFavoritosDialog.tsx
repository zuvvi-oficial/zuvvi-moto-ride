import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listarMotoristasFavoritos, removerMotoristaFavorito } from "@/lib/motoristas-favoritos.functions";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, Trash2 } from "lucide-react";

interface MotoristasFavoritosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MotoristasFavoritosDialog({ open, onOpenChange }: MotoristasFavoritosDialogProps) {
  const queryClient = useQueryClient();
  const listarFn = useServerFn(listarMotoristasFavoritos);
  const removerFn = useServerFn(removerMotoristaFavorito);

  const { data: favoritos = [], isLoading } = useQuery({
    queryKey: ["motoristas-favoritos"],
    queryFn: () => listarFn(),
    enabled: open,
  });

  const removerMutation = useMutation({
    mutationFn: (motoristaId: string) => removerFn({ data: { motoristaId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motoristas-favoritos"] });
      toast.success("Motorista removido dos favoritos.");
    },
    onError: () => {
      toast.error("Não foi possível remover este favorito.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-zuvvi-volt" />
            Meus motoristas favoritos
          </DialogTitle>
          <DialogDescription>
            Favorite motoristas com quem você já andou logo após a corrida. Em breve eles terão prioridade
            quando você chamar uma nova viagem.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : favoritos.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum motorista favoritado ainda. Favorite alguém ao final de uma corrida.
            </p>
          ) : (
            favoritos.map((favorito: { motoristaId: string; nome: string; favoritadoEm: string }) => (
              <div
                key={favorito.motoristaId}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <p className="min-w-0 truncate text-sm font-semibold">{favorito.nome}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removerMutation.mutate(favorito.motoristaId)}
                  disabled={removerMutation.isPending}
                  aria-label={`Remover ${favorito.nome} dos favoritos`}
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
