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
  defaultTipo?: "duvida" | "sos" | "reclamacao";
}

export function SupportDialog({ 
  open, 
  onOpenChange, 
  defaultTipo = "duvida" 
}: SupportDialogProps) {
  const criarChamadoFn = useServerFn(criarChamadoSuporte);
  const [loading, setLoading] = React.useState(false);
  
  const [tipo, setTipo] = React.useState<"duvida" | "sos" | "reclamacao">(defaultTipo);
  const [descricao, setDescricao] = React.useState("");

  const resetForm = () => {
    setTipo(defaultTipo);
    setDescricao("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (descricao.length < 10) {
      toast.error("A descrição deve ter pelo menos 10 caracteres.");
      return;
    }
    if (descricao.length > 2000) {
      toast.error("A descrição deve ter no máximo 2.000 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const result = await criarChamadoFn({
        data: {
          tipo,
          descricao,
        }
      });
      
      toast.success(`Chamado criado com sucesso!`);
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
            <div className="space-y-1">
              <p className="text-[11px] text-red-200/80 leading-tight">
                <span className="font-bold text-red-500">AVISO IMPORTANTE:</span> O SOS do app não substitui os serviços de emergência públicos. Em caso de perigo imediato, ligue para as autoridades:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">190 (PM)</span>
                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">192 (SAMU)</span>
                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">193 (Bombeiros)</span>
              </div>
            </div>
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
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-widest text-white/40">Descrição</label>
              <span className={cn(
                "text-[10px] font-medium",
                descricao.length > 1900 ? "text-red-400" : "text-white/40"
              )}>
                {descricao.length}/2000
              </span>
            </div>
            <Textarea 
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva detalhadamente o ocorrido..."
              className="bg-white/5 border-white/10 min-h-[120px] rounded-xl focus:ring-zuvvi-volt resize-none"
              disabled={loading}
              maxLength={2000}
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              disabled={loading || descricao.trim().length < 10}
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
