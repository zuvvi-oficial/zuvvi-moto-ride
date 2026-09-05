import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const esqueciSenhaSchema = z.object({
  email: z
    .string()
    .email("E-mail inválido")
    .transform((val) => val.trim().toLowerCase()),
});

type EsqueciSenhaForm = z.infer<typeof esqueciSenhaSchema>;

export const Route = createFileRoute("/auth/esqueci-senha")({
  component: EsqueciSenhaPage,
});

function EsqueciSenhaPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EsqueciSenhaForm>({
    resolver: zodResolver(esqueciSenhaSchema),
  });

  const onSubmit = async (data: EsqueciSenhaForm) => {
    setIsLoading(true);
    try {
      // Nunca revelamos se o e-mail existe ou não na base — evita
      // enumeração de contas cadastradas por quem só quer testar e-mails.
      await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/auth/redefinir-senha`,
      });
      setEnviado(true);
    } catch {
      // Mesmo em erro inesperado, mostramos a mesma tela de sucesso
      // pelo motivo acima; o e-mail simplesmente não chega.
      setEnviado(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (enviado) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="bg-zuvvi-volt/10 p-4 rounded-full">
            <MailCheck className="text-zuvvi-volt" size={32} />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-white">Verifique seu e-mail</h2>
          <p className="text-muted-foreground text-sm mt-2">
            Se houver uma conta com este e-mail, enviamos um link para redefinir sua senha.
          </p>
        </div>
        <Button
          asChild
          className="w-full bg-zuvvi-volt hover:bg-zuvvi-volt/90 text-zuvvi-indigo font-bold h-12"
        >
          <Link to="/auth/login">Voltar ao login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white">Esqueceu sua senha?</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Informe seu e-mail e enviaremos um link para redefinir sua senha.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-white/80">
            E-mail
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            className="bg-zuvvi-indigo border-white/10 text-white focus:border-zuvvi-volt"
            {...register("email")}
          />
          {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-zuvvi-volt hover:bg-zuvvi-volt/90 text-zuvvi-indigo font-bold h-12 text-lg mt-4 transition-all active:scale-[0.98]"
        >
          {isLoading ? "Enviando..." : "ENVIAR LINK"}
        </Button>

        <p className="text-center text-muted-foreground text-sm mt-4">
          Lembrou a senha?{" "}
          <Link to="/auth/login" className="volt-text cursor-pointer hover:underline">
            Voltar ao login
          </Link>
        </p>
      </form>
    </div>
  );
}
