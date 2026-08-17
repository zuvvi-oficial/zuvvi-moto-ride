import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const loginSchema = z.object({
  email: z
    .string()
    .email("E-mail inválido")
    .transform((val) => val.trim().toLowerCase()),
  password: z.string().min(1, "A senha é obrigatória"),
});

type LoginForm = z.infer<typeof loginSchema>;

export const Route = createFileRoute('/auth/login')({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { 
    register, 
    handleSubmit, 
    formState: { errors } 
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error("E-mail ou senha incorretos.");
        return;
      }

      toast.success("Login realizado com sucesso!");
      navigate({ to: "/" });
    } catch (error: any) {
      toast.error("Ocorreu um erro ao tentar entrar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white font-space">Entrar no Zuvvi</h2>
        <p className="text-zinc-400 text-sm mt-1">Bem-vindo de volta, piloto ou passageiro</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-zinc-300">E-mail</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="seu@email.com" 
            className="bg-zinc-800 border-zinc-700 text-white focus:border-amber-500"
            {...register("email")}
          />
          {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-zinc-300">Senha</Label>
          <div className="relative">
            <Input 
              id="password" 
              type={showPassword ? "text" : "password"} 
              placeholder="••••••••" 
              className="bg-zinc-800 border-zinc-700 text-white pr-10 focus:border-amber-500"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
        </div>

        <Button 
          type="submit" 
          disabled={isLoading}
          className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold h-12 text-lg mt-4 transition-all active:scale-[0.98]"
        >
          {isLoading ? "Entrando..." : "ENTRAR"}
        </Button>

        <p className="text-center text-zinc-500 text-sm mt-4">
          Não tem uma conta?{" "}
          <Link to="/auth/cadastro" className="text-amber-500 cursor-pointer hover:underline">
            Criar conta
          </Link>
        </p>
      </form>
    </div>
  );
}
