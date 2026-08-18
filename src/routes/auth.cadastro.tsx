import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
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
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GoogleLoginButton, AuthSeparator } from '@/components/auth/SocialLogin';

const titleCase = (str: string) => {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

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
    .transform((val) => titleCase(val.trim().replace(/\s+/g, ' '))),
  email: z
    .string()
    .email("E-mail inválido")
    .transform((val) => val.trim().toLowerCase()),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
  cpf: z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .refine((val) => val.length === 11, "CPF deve conter 11 números")
    .refine(validateCPF, "CPF inválido"),
  celular: z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .refine((val) => val.length >= 10 && val.length <= 11, "Celular inválido"),
  
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type CadastroForm = z.infer<typeof cadastroSchema>;

export const Route = createFileRoute('/auth/cadastro')({
  component: CadastroPage,
});

function CadastroPage() {
  const navigate = useNavigate();
  const executeSignUp = useServerFn(signUp);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const calculatePasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: "" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    
    if (score <= 1) return { score: 1, label: "Fraca", color: "bg-red-500" };
    if (score <= 3) return { score: 2, label: "Média", color: "bg-amber-500" };
    return { score: 3, label: "Forte", color: "bg-green-500" };
  };

  const { 
    register, 
    handleSubmit, 
    formState: { errors }, 
    setValue, 
    watch,
    control
  } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: {}
  });

  const passwordValue = watch("password");

  const passwordStrength = useMemo(() => calculatePasswordStrength(passwordValue || ""), [passwordValue]);

  const onSubmit = async (formData: CadastroForm) => {
    setIsLoading(true);
    const { confirmPassword, ...submitData } = formData;
    try {
      await executeSignUp({ data: submitData as any });
      toast.success("Cadastro realizado com sucesso!");
      navigate({ to: "/auth/completar-cadastro" });
    } catch (error: any) {
      const userFriendlyMessage = error.message?.includes('violates unique constraint')
        ? "Este e-mail, CPF ou celular já está cadastrado."
        : "Ocorreu um erro ao processar seu cadastro. Tente novamente.";
      toast.error(userFriendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white">Criar Conta</h2>
        <p className="text-muted-foreground text-sm mt-1">Junte-se à revolução da moto-táxi</p>
      </div>

      <GoogleLoginButton />
      <AuthSeparator />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nome" className="text-white/80">Nome Completo</Label>
          <Input 
            id="nome" 
            placeholder="Ex: João Silva" 
            className="bg-zuvvi-indigo border-white/10 text-white focus:border-zuvvi-volt"
            {...register("nome")}
          />
          {errors.nome && <p className="text-red-500 text-xs">{errors.nome.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cpf" className="text-white/80">CPF</Label>
            <Controller
              name="cpf"
              control={control}
              render={({ field }) => (
                <Input 
                  {...field}
                  id="cpf" 
                  placeholder="000.000.000-00" 
                  className="bg-zuvvi-indigo border-white/10 text-white focus:border-zuvvi-volt"
                  onChange={(e) => field.onChange(formatCPF(e.target.value))}
                />
              )}
            />
            {errors.cpf && <p className="text-red-500 text-xs">{errors.cpf.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="celular" className="text-white/80">Celular</Label>
            <Controller
              name="celular"
              control={control}
              render={({ field }) => (
                <Input 
                  {...field}
                  id="celular" 
                  placeholder="(00) 00000-0000" 
                  className="bg-zuvvi-indigo border-white/10 text-white focus:border-zuvvi-volt"
                  onChange={(e) => field.onChange(formatPhone(e.target.value))}
                />
              )}
            />
            {errors.celular && <p className="text-red-500 text-xs">{errors.celular.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-white/80">E-mail</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="seu@email.com" 
            className="bg-zuvvi-indigo border-white/10 text-white focus:border-zuvvi-volt"
            {...register("email")}
          />
          {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-white/80">Senha</Label>
          <div className="relative">
            <Input 
              id="password" 
              type={showPassword ? "text" : "password"} 
              placeholder="••••••••" 
              className="bg-zuvvi-indigo border-white/10 text-white pr-10 focus:border-zuvvi-volt"
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
          {passwordValue && (
            <div className="space-y-1.5 pt-1">
              <div className="flex gap-1 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                <div className={cn("h-full transition-all duration-300", passwordStrength.score >= 1 ? passwordStrength.color : "w-0", passwordStrength.score === 1 ? "w-1/3" : passwordStrength.score === 2 ? "w-2/3" : "w-full")} />
              </div>
              <p className={cn("text-[10px] font-medium uppercase tracking-wider", 
                passwordStrength.score === 1 ? "text-red-500" : 
                passwordStrength.score === 2 ? "text-amber-500" : 
                "text-green-500"
              )}>
                Senha {passwordStrength.label}
              </p>
            </div>
          )}
          {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-white/80">Confirmar Senha</Label>
          <div className="relative">
            <Input 
              id="confirmPassword" 
              type={showConfirmPassword ? "text" : "password"} 
              placeholder="••••••••" 
              className="bg-zuvvi-indigo border-white/10 text-white pr-10 focus:border-zuvvi-volt"
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-red-500 text-xs">{errors.confirmPassword.message}</p>}
        </div>


        <Button 
          type="submit" 
          disabled={isLoading}
          className="w-full bg-zuvvi-volt hover:bg-zuvvi-volt/90 text-zuvvi-indigo font-bold h-12 text-lg mt-4 transition-all active:scale-[0.98]"
        >
          {isLoading ? "Cadastrando..." : "CRIAR CONTA ZUVVI"}
        </Button>

        <p className="text-center text-muted-foreground text-sm mt-4">
          Já tem uma conta? <Link to="/auth/login" className="volt-text cursor-pointer hover:underline">Fazer login</Link>
        </p>
      </form>
    </div>
  );
}
