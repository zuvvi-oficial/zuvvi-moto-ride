import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Clock, HelpCircle, LifeBuoy, User, ChevronRight, LogOut, IdCard } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { resolveDestinationForLoader } from "@/lib/auth-status.functions";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validarCpfBrasileiro } from "@/lib/pix-cpf";
import { SupportDialog } from "@/components/suporte/SupportDialog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const getMeuCpf = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("usuarios")
      .select("cpf")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar CPF do usuário:", error);
      return { cpf: "" };
    }

    return { cpf: data?.cpf ?? "" };
  });

const atualizarCpf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    cpf: z.string().length(11, "CPF deve ter 11 dígitos").refine(validarCpfBrasileiro, "CPF inválido"),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Nunca aceitar um id vindo do cliente: sempre resolver pelo auth_user_id da sessão autenticada
    const { error } = await supabaseAdmin
      .from("usuarios")
      .update({ cpf: data.cpf })
      .eq("auth_user_id", context.userId);

    if (error) {
      if (error.code === '23505' && error.message?.includes('usuarios_cpf_key')) {
        throw new Error("Este CPF já está cadastrado em outra conta.");
      }
      throw new Error("Erro ao atualizar CPF. Tente novamente.");
    }

    return { success: true };
  });

export const Route = createFileRoute("/perfil")({
  loader: async () => {
    const dest = await resolveDestinationForLoader();
    const canAccess = dest.isPassageiro === true && dest.redirectTo === "/" && !dest.isAdmin && !dest.isMotorista;
    
    if (!canAccess) {
      throw redirect({ to: (dest.redirectTo || "/auth/login") as any });
    }
  },
  component: PerfilPassageiro,
});

function PerfilPassageiro() {
  const navigate = useNavigate();
  const [supportOpen, setSupportOpen] = useState(false);

  const getMeuCpfFn = useServerFn(getMeuCpf);
  const atualizarCpfFn = useServerFn(atualizarCpf);

  const [cpf, setCpf] = useState("");
  const [isLoadingCpf, setIsLoadingCpf] = useState(true);
  const [isSavingCpf, setIsSavingCpf] = useState(false);
  const [cpfError, setCpfError] = useState<string | null>(null);

  useEffect(() => {
    getMeuCpfFn()
      .then((res) => setCpf(formatCPF(res.cpf || "")))
      .catch(() => {})
      .finally(() => setIsLoadingCpf(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const handleSalvarCpf = async () => {
    const digits = cpf.replace(/\D/g, "");

    if (!validarCpfBrasileiro(digits)) {
      setCpfError("CPF inválido");
      return;
    }

    setCpfError(null);
    setIsSavingCpf(true);
    try {
      await atualizarCpfFn({ data: { cpf: digits } });
      toast.success("CPF atualizado!");
    } catch (error: any) {
      const message = error?.message || "Erro ao atualizar CPF.";
      setCpfError(message);
      toast.error(message);
    } finally {
      setIsSavingCpf(false);
    }
  };

  return (
    <div className="min-h-screen bg-zuvvi-indigo-dark text-foreground flex flex-col pb-10">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zuvvi-indigo/90 backdrop-blur-xl border-b border-white/10 px-5 py-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link 
            to="/" 
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 transition-colors hover:bg-white/10"
          >
            <ChevronLeft className="w-6 h-6 text-zuvvi-volt" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Perfil</h1>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-5 py-8 space-y-8 animate-rise">
        {/* User Info Placeholder */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-24 h-24 rounded-full bg-zuvvi-volt/10 flex items-center justify-center border-2 border-zuvvi-volt/20">
            <User className="w-12 h-12 text-zuvvi-volt" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Minha Conta</h2>
            <p className="text-sm text-muted-foreground">Passageiro Zuvvi</p>
          </div>
        </div>

        {/* CPF */}
        <div className="bg-zuvvi-indigo/40 border border-white/5 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <IdCard className="w-3.5 h-3.5" />
            CPF
          </div>
          <div className="flex items-center gap-3">
            <Input
              value={cpf}
              onChange={(e) => {
                setCpf(formatCPF(e.target.value));
                setCpfError(null);
              }}
              placeholder="000.000.000-00"
              disabled={isLoadingCpf || isSavingCpf}
              className="bg-zuvvi-indigo border-white/10 text-white focus-visible:border-zuvvi-volt h-12"
            />
            <Button
              onClick={handleSalvarCpf}
              disabled={isLoadingCpf || isSavingCpf}
              className="h-12 bg-zuvvi-volt hover:bg-zuvvi-volt/90 text-zuvvi-indigo font-bold shrink-0"
            >
              {isSavingCpf ? "Salvando..." : "Salvar"}
            </Button>
          </div>
          {cpfError && <p className="text-red-500 text-xs">{cpfError}</p>}
        </div>

        {/* Menu Actions */}
        <div className="space-y-3">
          <Link
            to="/corridas"
            className="w-full bg-zuvvi-indigo/40 border border-white/5 rounded-2xl p-5 flex items-center justify-between transition-all hover:bg-zuvvi-indigo/60 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-zuvvi-volt/10 flex items-center justify-center border border-zuvvi-volt/20 group-hover:border-zuvvi-volt/40">
                <Clock className="w-5 h-5 text-zuvvi-volt" />
              </div>
              <div className="text-left">
                <p className="font-bold">Histórico de Corridas</p>
                <p className="text-[11px] text-muted-foreground">Veja suas viagens anteriores</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-zuvvi-volt" />
          </Link>

          <Link 
            to="/meus-chamados"
            className="w-full bg-zuvvi-indigo/40 border border-white/5 rounded-2xl p-5 flex items-center justify-between transition-all hover:bg-zuvvi-indigo/60 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-zuvvi-volt/10 flex items-center justify-center border border-zuvvi-volt/20 group-hover:border-zuvvi-volt/40">
                <LifeBuoy className="w-5 h-5 text-zuvvi-volt" />
              </div>
              <div className="text-left">
                <p className="font-bold">Meus Chamados</p>
                <p className="text-[11px] text-muted-foreground">Acompanhe suas conversas com o suporte</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-zuvvi-volt" />
          </Link>

          <button 

            onClick={() => setSupportOpen(true)}
            className="w-full bg-zuvvi-indigo/40 border border-white/5 rounded-2xl p-5 flex items-center justify-between transition-all hover:bg-zuvvi-indigo/60 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-zuvvi-volt/10 flex items-center justify-center border border-zuvvi-volt/20 group-hover:border-zuvvi-volt/40">
                <HelpCircle className="w-5 h-5 text-zuvvi-volt" />
              </div>
              <div className="text-left">
                <p className="font-bold">Preciso de ajuda</p>
                <p className="text-[11px] text-muted-foreground">Fale com nosso suporte</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-zuvvi-volt" />
          </button>

          <button 
            onClick={handleLogout}
            className="w-full bg-red-500/5 border border-red-500/10 rounded-2xl p-5 flex items-center justify-between transition-all hover:bg-red-500/10 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20 group-hover:border-red-500/40">
                <LogOut className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-left">
                <p className="font-bold text-red-500">Sair</p>
                <p className="text-[11px] text-red-500/60">Encerrar sessão no dispositivo</p>
              </div>
            </div>
          </button>
        </div>

        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Zuvvi Mobilidade v1.0.0</p>
        </div>
      </main>

      <SupportDialog 
        open={supportOpen} 
        onOpenChange={setSupportOpen} 
      />
    </div>
  );
}