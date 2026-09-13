import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportarMeusDados } from "@/lib/exportacao-dados.functions";

export function BaixarMeusDadosButton() {
  const exportarFn = useServerFn(exportarMeusDados);
  const [isExportando, setIsExportando] = useState(false);

  const baixar = async () => {
    setIsExportando(true);
    try {
      const dados = await exportarFn();
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `zuvvi-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível baixar seus dados.";
      toast.error(message);
    } finally {
      setIsExportando(false);
    }
  };

  return (
    <button
      type="button"
      onClick={baixar}
      disabled={isExportando}
      className="w-full bg-zuvvi-indigo/40 border border-white/5 rounded-2xl p-5 flex items-center justify-between transition-all hover:bg-zuvvi-indigo/60 group disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-zuvvi-volt/10 flex items-center justify-center border border-zuvvi-volt/20 group-hover:border-zuvvi-volt/40">
          {isExportando ? (
            <Loader2 className="w-5 h-5 text-zuvvi-volt animate-spin" />
          ) : (
            <Download className="w-5 h-5 text-zuvvi-volt" />
          )}
        </div>
        <div className="text-left">
          <p className="font-bold">Baixar meus dados</p>
          <p className="text-[11px] text-muted-foreground">
            Um arquivo com tudo que temos sobre você
          </p>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-zuvvi-volt" />
    </button>
  );
}
