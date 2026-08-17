import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { useServerFn } from '@tanstack/react-start';
import { signUp } from '@/lib/auth.functions';

const validateCPF = (cpf: string) => {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleanCPF)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCPF.charAt(9))) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCPF.charAt(10))) return false;
  return true;
};

const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
};

const cadastroSchema = z.object({
  nome: z
    .string()
    .min(3, "O nome deve ter pelo menos 3 caracteres")
    .transform((val) => val.trim().replace(/\s+/g, ' ')),
  email: z
    .string()
    .email("E-mail inválido")
    .transform((val) => val.trim().toLowerCase()),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  cpf: z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .refine((val) => val.length === 11, "CPF deve conter 11 números")
    .refine(validateCPF, "CPF inválido"),
  celular: z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .refine((val) => val.length >= 10 && val.length <= 11, "Celular inválido"),
  perfil_inicial: z.enum(["passageiro", "motorista"]),
});

type CadastroForm = z.infer<typeof cadastroSchema>;

export const Route = createFileRoute('/auth/cadastro')({
  component: CadastroPage,
});

function CadastroPage() {
  const navigate = useNavigate();
  const executeSignUp = useServerFn(signUp);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: {
      perfil_inicial: "passageiro",
    }
  });

  const perfil = watch("perfil_inicial");

  const onSubmit = async (data: CadastroForm) => {
    setIsLoading(true);
    try {
      await executeSignUp({ data });
      toast.success("Cadastro realizado com sucesso!");
      navigate({ to: "/" }); // Redireciona para home por enquanto
    } catch (error: any) {
      toast.error(error.message || "Erro ao realizar cadastro");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white font-space">Criar Conta</h2>
        <p className="text-zinc-400 text-sm mt-1">Junte-se à revolução da moto-táxi</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nome" className="text-zinc-300">Nome Completo</Label>
          <Input 
            id="nome" 
            placeholder="Ex: João Silva" 
            className="bg-zinc-800 border-zinc-700 text-white focus:border-amber-500"
            {...register("nome")}
          />
          {errors.nome && <p className="text-red-500 text-xs">{errors.nome.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cpf" className="text-zinc-300">CPF</Label>
            <Input 
              id="cpf" 
              placeholder="Apenas números" 
              className="bg-zinc-800 border-zinc-700 text-white"
              {...register("cpf")}
            />
            {errors.cpf && <p className="text-red-500 text-xs">{errors.cpf.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="celular" className="text-zinc-300">Celular</Label>
            <Input 
              id="celular" 
              placeholder="(00) 00000-0000" 
              className="bg-zinc-800 border-zinc-700 text-white"
              {...register("celular")}
            />
            {errors.celular && <p className="text-red-500 text-xs">{errors.celular.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-zinc-300">E-mail</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="seu@email.com" 
            className="bg-zinc-800 border-zinc-700 text-white"
            {...register("email")}
          />
          {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-zinc-300">Senha</Label>
          <Input 
            id="password" 
            type="password" 
            placeholder="••••••••" 
            className="bg-zinc-800 border-zinc-700 text-white"
            {...register("password")}
          />
          {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
        </div>

        <div className="space-y-3">
          <Label className="text-zinc-300">Eu quero ser:</Label>
          <RadioGroup 
            defaultValue="passageiro" 
            onValueChange={(value) => setValue("perfil_inicial", value as any)}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2 bg-zinc-800 p-3 rounded-lg border border-zinc-700 cursor-pointer hover:border-amber-500 transition-colors">
              <RadioGroupItem value="passageiro" id="passageiro" className="text-amber-500 border-zinc-500" />
              <Label htmlFor="passageiro" className="text-white cursor-pointer">Passageiro</Label>
            </div>
            <div className="flex items-center space-x-2 bg-zinc-800 p-3 rounded-lg border border-zinc-700 cursor-pointer hover:border-amber-500 transition-colors">
              <RadioGroupItem value="motorista" id="motorista" className="text-amber-500 border-zinc-500" />
              <Label htmlFor="motorista" className="text-white cursor-pointer">Motorista</Label>
            </div>
          </RadioGroup>
        </div>

        <Button 
          type="submit" 
          disabled={isLoading}
          className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold h-12 text-lg mt-4 transition-all active:scale-[0.98]"
        >
          {isLoading ? "Cadastrando..." : "CRIAR CONTA ZUVVI"}
        </Button>

        <p className="text-center text-zinc-500 text-sm mt-4">
          Já tem uma conta? <span className="text-amber-500 cursor-pointer hover:underline">Fazer login</span>
        </p>
      </form>
    </div>
  );
}
