import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostLoginDestination } from "@/lib/auth-status.functions";

const redefinirSenhaSchema = z
  .object({
    senha: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres"),
    confirmarSenha: z.string().min(1, "Confirme sua nova senha"),
  })
  .refine((data) => data.senha === data.confirmarSenha, {
    message: "As senhas não coincidem",
    path: ["confirmarSenha"],
  });

type RedefinirSenhaForm = z.infer<typeof redefinirSenhaSchema>;

export const Route = createFileRoute("/auth/redefinir-senha")({
  component: RedefinirSenhaPage,
});

function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const resolveDestination = useServerFn(resolvePostLoginDestination);
  const [status, setStatus] = useState<"verificando" | "pronto" | "invalido">("verificando");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RedefinirSenhaForm>({
    resolver: zodResolver(redefinirSenhaSchema),
  });

  useEffect(() => {
    // O link do e-mail (fluxo PKCE) já chega com ?error=... quando expirado/inválido,
    // ou com o código que o supabase-js troca pela sessão de recuperação sozinho
    // (detectSessionInUrl: true no client) — só precisamos observar o resultado.
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) {
      setStatus("invalido");
      return;
    }

    let resolved = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        resolved = true;
        setStatus("pronto");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!resolved && data.session) {
        resolved = true;
        setStatus("pronto");
      }
    });

    const timeout = setTimeout(() => {
      if (!resolved) setStatus("invalido");
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const onSubmit = async (data: RedefinirSenhaForm) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: data.senha });
      if (error) {
        toast.error("Não foi possível redefinir sua senha. Tente solicitar um novo link.");
        return;
      }

      toast.success("Senha redefinida com sucesso!");
      const result = await resolveDestination();
      navigate({ to: result.redirectTo as any });
    } catch {
      toast.error("Ocorreu um erro ao redefinir sua senha. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "verificando") {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
        <div className="w-10 h-10 border-4 border-zuvvi-volt/20 border-t-zuvvi-volt rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">Verificando seu link...</p>
      </div>
    );
  }

  if (status === "invalido") {
    return (
      <div className="space-y-6 text-center">
        <div>
          <h2 className="text-2xl font-semibold text-white">Link inválido ou expirado</h2>
          <p className="text-muted-foreground text-sm mt-2">
            Este link de redefinição de senha não é mais válido. Solicite um novo.
          </p>
        </div>
        <Button
          asChild
          className="w-full bg-zuvvi-volt hover:bg-zuvvi-volt/90 text-zuvvi-indigo font-bold h-12"
        >
          <Link to="/auth/esqueci-senha">Solicitar novo link</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white">Defina sua nova senha</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="senha" className="text-white/80">
            Nova senha
          </Label>
          <div className="relative">
            <Input
              id="senha"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className="bg-zuvvi-indigo border-white/10 text-white pr-10 focus:border-zuvvi-volt"
              {...register("senha")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.senha && <p className="text-red-500 text-xs">{errors.senha.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmarSenha" className="text-white/80">
            Confirmar nova senha
          </Label>
          <Input
            id="confirmarSenha"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            className="bg-zuvvi-indigo border-white/10 text-white focus:border-zuvvi-volt"
            {...register("confirmarSenha")}
          />
          {errors.confirmarSenha && (
            <p className="text-red-500 text-xs">{errors.confirmarSenha.message}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-zuvvi-volt hover:bg-zuvvi-volt/90 text-zuvvi-indigo font-bold h-12 text-lg mt-4 transition-all active:scale-[0.98]"
        >
          {isLoading ? "Salvando..." : "SALVAR NOVA SENHA"}
        </Button>
      </form>
    </div>
  );
}
