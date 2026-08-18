import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useServerFn } from '@tanstack/react-start';
import { updateUserInfo } from '@/lib/auth-google.functions';
import { checkUserProfileStatus } from '@/lib/auth-status.functions';

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

const completionSchema = z.object({
  cpf: z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .refine((val) => val.length === 11, "CPF deve conter 11 números"),
  celular: z
    .string()
    .transform((val) => val.replace(/\D/g, ''))
    .refine((val) => val.length >= 10 && val.length <= 11, "Celular inválido"),
});

type CompletionForm = z.infer<typeof completionSchema>;

export const Route = createFileRoute('/auth/completar-cadastro')({
  component: CompletarCadastroPage,
});

function CompletarCadastroPage() {
  const navigate = useNavigate();
  const executeUpdate = useServerFn(updateUserInfo);
  const checkStatus = useServerFn(checkUserProfileStatus);
  const [isLoading, setIsLoading] = useState(false);

  const { 
    handleSubmit, 
    formState: { errors }, 
    control
  } = useForm<CompletionForm>({
    resolver: zodResolver(completionSchema),
  });

  const onSubmit = async (data: CompletionForm) => {
    setIsLoading(true);
    try {
      await executeUpdate({ data });
      toast.success("Informações atualizadas!");
      
      const status = await checkStatus();
      if (status.hasProfile) {
        navigate({ to: "/" });
      } else {
        navigate({ to: "/auth/perfil" });
      }
    } catch (error: any) {
      // Use the specific message from the server if available
      const message = error.message || "Erro ao salvar informações. Verifique os dados.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white">Quase lá!</h2>
        <p className="text-muted-foreground text-sm mt-1">Precisamos de mais alguns dados para sua segurança</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

        <Button 
          type="submit" 
          disabled={isLoading}
          className="w-full bg-zuvvi-volt hover:bg-zuvvi-volt/90 text-zuvvi-indigo font-bold h-12 text-lg mt-4 transition-all active:scale-[0.98]"
        >
          {isLoading ? "Salvando..." : "CONCLUIR CADASTRO"}
        </Button>
      </form>
    </div>
  );
}

