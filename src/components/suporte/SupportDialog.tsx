import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { criarChamadoSuporte } from "@/lib/suporte.functions";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { AlertCircle, HelpCircle, MessageSquare, ShieldAlert, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  corridaId?: string | undefined;
  defaultTipo?: "duvida" | "sos" | "reclamacao";
}

export function SupportDialog({ 
  open, 
  onOpenChange, 
  corridaId, 
  defaultTipo = "duvida" 
}: SupportDialogProps) {
  const criarChamadoFn = useServerFn(criarChamadoSuporte);
  const [loading, setLoading] = React.useState(false);
  
  const [tipo, setTipo] = React.useState<"duvida" | "sos" | "reclamacao">(defaultTipo);
  const [assunto, setAssunto] = React.useState("");
  const [descricao, setDescricao] = React.useState("");

  const resetForm = () => {
    setTipo(defaultTipo);
    setAssunto("");
    setDescricao("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (assunto.length < 3) {
      toast.error("O assunto deve ter pelo menos 3 caracteres.");
      return;
    }
    if (descricao.length < 10) {
      toast.error("A descrição deve ter pelo menos 10 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const result = await criarChamadoFn({
        data: {
          tipo,
          assunto,
          descricao,
          corrida_id: corridaId
        }
      });
      
      toast.success(`Chamado ${(result as any).protocolo || result.id} criado com sucesso!`);
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao criar chamado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!loading) onOpenChange(val);
    }}>
      <DialogContent className="bg-zuvvi-indigo-dark border-white/10 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {tipo === "sos" ? (
              <ShieldAlert className="w-6 h-6 text-red-500" />
            ) : (
              <HelpCircle className="w-6 h-6 text-zuvvi-volt" />
            )}
            Central de Ajuda
          </DialogTitle>
          <DialogDescription className="text-white/60">
            {tipo === "sos" 
              ? "Use este canal para emergências durante a corrida." 
              : "Como podemos ajudar você hoje?"}
          </DialogDescription>
        </DialogHeader>

        {tipo === "sos" && (
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-[11px] text-red-200/80 leading-tight">
              <span className="font-bold text-red-500">AVISO IMPORTANTE:</span> O SOS do app não substitui os serviços de emergência públicos. Em caso de perigo imediato, ligue <span className="text-white font-bold">190 (PM)</span> ou <span className="text-white font-bold">192 (SAMU)</span>.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/40">Tipo de Solicitação</label>
            <Select 
              value={tipo} 
              onValueChange={(val: any) => setTipo(val)}
              disabled={loading}
            >
              <SelectTrigger className="bg-white/5 border-white/10 h-12 rounded-xl focus:ring-zuvvi-volt">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent className="bg-zuvvi-indigo-dark border-white/10 text-white">
                <SelectItem value="duvida" className="focus:bg-zuvvi-volt focus:text-indigo-950">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" /> Dúvida
                  </div>
                </SelectItem>
                <SelectItem value="reclamacao" className="focus:bg-zuvvi-volt focus:text-indigo-950">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Reclamação
                  </div>
                </SelectItem>
                <SelectItem value="sos" className="focus:bg-red-500 focus:text-white">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> SOS / Emergência
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/40">Assunto</label>
            <Input 
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Ex: Problema com pagamento"
              className="bg-white/5 border-white/10 h-12 rounded-xl focus:ring-zuvvi-volt"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/40">Descrição</label>
            <Textarea 
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva detalhadamente o ocorrido..."
              className="bg-white/5 border-white/10 min-h-[100px] rounded-xl focus:ring-zuvvi-volt resize-none"
              disabled={loading}
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full h-12 rounded-xl font-bold transition-all",
                tipo === "sos" 
                  ? "bg-red-600 hover:bg-red-700 text-white" 
                  : "bg-zuvvi-volt hover:bg-zuvvi-volt/90 text-indigo-950"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                "Enviar Chamado"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
