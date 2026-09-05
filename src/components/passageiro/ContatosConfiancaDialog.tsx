import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listarContatosConfianca,
  criarContatoConfianca,
  excluirContatoConfianca,
} from "@/lib/contatos-confianca.functions";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Trash2, Loader2, Plus } from "lucide-react";

interface ContatosConfiancaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContatosConfiancaDialog({ open, onOpenChange }: ContatosConfiancaDialogProps) {
  const queryClient = useQueryClient();
  const listarFn = useServerFn(listarContatosConfianca);
  const criarFn = useServerFn(criarContatoConfianca);
  const excluirFn = useServerFn(excluirContatoConfianca);

  const [nome, setNome] = React.useState("");
  const [telefone, setTelefone] = React.useState("");

  const { data: contatos = [], isLoading } = useQuery({
    queryKey: ["contatos-confianca"],
    queryFn: () => listarFn(),
    enabled: open,
  });

  const criarMutation = useMutation({
    mutationFn: () => criarFn({ data: { nome, telefone } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contatos-confianca"] });
      setNome("");
      setTelefone("");
      toast.success("Contato adicionado.");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o contato.");
    },
  });

  const excluirMutation = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contatos-confianca"] });
      toast.success("Contato removido.");
    },
    onError: () => {
      toast.error("Não foi possível excluir o contato.");
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!nome.trim() || !telefone.trim()) return;
    criarMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-zuvvi-volt" />
            Contatos de confiança
          </DialogTitle>
          <DialogDescription>
            Quem você adicionar aqui pode acompanhar suas corridas em tempo real quando você compartilhar uma viagem.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Nome"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            maxLength={60}
            disabled={criarMutation.isPending}
          />
          <Input
            placeholder="Telefone"
            value={telefone}
            onChange={(event) => setTelefone(event.target.value)}
            maxLength={20}
            inputMode="tel"
            disabled={criarMutation.isPending}
          />
          <Button type="submit" size="icon" disabled={criarMutation.isPending || contatos.length >= 5}>
            {criarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </form>

        {contatos.length >= 5 && (
          <p className="text-xs text-muted-foreground">
            Limite de 5 contatos atingido. Exclua um para adicionar outro.
          </p>
        )}

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : contatos.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum contato de confiança ainda.
            </p>
          ) : (
            contatos.map((contato: { id: string; nome: string; telefone: string }) => (
              <div
                key={contato.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{contato.nome}</p>
                  <p className="text-xs text-muted-foreground">{contato.telefone}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => excluirMutation.mutate(contato.id)}
                  disabled={excluirMutation.isPending}
                  aria-label={`Excluir ${contato.nome}`}
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
