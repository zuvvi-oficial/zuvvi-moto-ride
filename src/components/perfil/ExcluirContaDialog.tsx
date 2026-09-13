import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { excluirContaUsuario } from "@/lib/exclusao-conta.functions";
import { supabase } from "@/integrations/supabase/client";

export function ExcluirContaDialog() {
  const navigate = useNavigate();
  const excluirFn = useServerFn(excluirContaUsuario);
  const [isExcluindo, setIsExcluindo] = useState(false);

  const excluir = async () => {
    setIsExcluindo(true);
    try {
      await excluirFn();
      await supabase.auth.signOut();
      toast.success("Sua conta foi excluída.");
      navigate({ to: "/auth/login" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível excluir a conta.";
      toast.error(message);
      setIsExcluindo(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="w-full bg-red-500/5 border border-red-500/10 rounded-2xl p-5 flex items-center justify-between transition-all hover:bg-red-500/10 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20 group-hover:border-red-500/40">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div className="text-left">
              <p className="font-bold text-red-500">Excluir minha conta</p>
              <p className="text-[11px] text-red-500/60">Apaga seus dados pessoais</p>
            </div>
          </div>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-white/10 bg-zuvvi-indigo text-white font-poppins">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir sua conta permanentemente?</AlertDialogTitle>
          <AlertDialogDescription className="text-white/60">
            Seus dados pessoais (nome, CPF, documentos, contatos de confiança) serão apagados e você
            não poderá mais entrar nesta conta. O histórico de corridas e pagamentos é mantido, como
            a lei exige, mas sem nenhuma informação que identifique você. Essa ação não pode ser
            desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isExcluindo}
            className="border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={excluir}
            disabled={isExcluindo}
            className="bg-red-600 text-white hover:bg-red-500"
          >
            {isExcluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir permanentemente"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
