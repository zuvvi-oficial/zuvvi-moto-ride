import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useServerFn } from '@tanstack/react-start';
import { updateUserInfo } from '@/lib/auth-google.functions';
import { checkUserProfileStatus } from '@/lib/auth-status.functions';
import { getLocations } from '@/lib/locations.functions';

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
  data_nascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  uf: z.string().min(1, "Estado é obrigatório"),
  cidade_id: z.string().uuid("Cidade é obrigatória"),
});

type CompletionForm = z.infer<typeof completionSchema>;

export const Route = createFileRoute('/auth/completar-cadastro')({
  component: CompletarCadastroPage,
});

function CompletarCadastroPage() {
  const navigate = useNavigate();
  const executeUpdate = useServerFn(updateUserInfo);
  const checkStatus = useServerFn(checkUserProfileStatus);
  const fetchLocations = useServerFn(getLocations);
  
  const [isLoading, setIsLoading] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);

  const { 
    handleSubmit, 
    formState: { errors }, 
    control,
    watch,
    setValue
  } = useForm<CompletionForm>({
    resolver: zodResolver(completionSchema),
    defaultValues: {
      cpf: '',
      celular: '',
      data_nascimento: '',
      uf: '',
      cidade_id: '',
    }
  });

  const selectedUF = watch('uf');

  useEffect(() => {
    const loadLocations = async () => {
      try {
        const data = await fetchLocations();
        setLocations(data);
      } catch (error) {
        toast.error("Erro ao carregar cidades. Tente recarregar a página.");
      } finally {
        setIsLoadingLocations(false);
      }
    };
    loadLocations();
  }, [fetchLocations]);

  const estados = useMemo(() => {
    const ufs = Array.from(new Set(locations.map(c => c.estado_uf))).sort();
    return ufs;
  }, [locations]);

  const cidadesFiltradas = useMemo(() => {
    if (!selectedUF) return [];
    return locations.filter(c => c.estado_uf === selectedUF).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [selectedUF, locations]);

  // Limpa a cidade quando o UF muda
  useEffect(() => {
    if (selectedUF) {
      setValue('cidade_id', '');
    }
  }, [selectedUF, setValue]);

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

        <div className="space-y-2">
          <Label htmlFor="data_nascimento" className="text-white/80">Data de Nascimento</Label>
          <Controller
            name="data_nascimento"
            control={control}
            render={({ field }) => (
              <Input 
                {...field}
                type="date"
                id="data_nascimento" 
                className="bg-zuvvi-indigo border-white/10 text-white focus:border-zuvvi-volt [color-scheme:dark]"
              />
            )}
          />
          {errors.data_nascimento && <p className="text-red-500 text-xs">{errors.data_nascimento.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="uf" className="text-white/80">Estado</Label>
            <Controller
              name="uf"
              control={control}
              render={({ field }) => (
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value}
                  disabled={isLoadingLocations}
                >
                  <SelectTrigger className="bg-zuvvi-indigo border-white/10 text-white focus:border-zuvvi-volt">
                    <SelectValue placeholder={isLoadingLocations ? "Carregando..." : "UF"} />
                  </SelectTrigger>
                  <SelectContent className="bg-zuvvi-indigo border-white/10 text-white">
                    {estados.map(uf => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.uf && <p className="text-red-500 text-xs">{errors.uf.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cidade_id" className="text-white/80">Cidade</Label>
            <Controller
              name="cidade_id"
              control={control}
              render={({ field }) => (
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value}
                  disabled={!selectedUF || isLoadingLocations}
                >
                  <SelectTrigger className="bg-zuvvi-indigo border-white/10 text-white focus:border-zuvvi-volt">
                    <SelectValue placeholder="Cidade" />
                  </SelectTrigger>
                  <SelectContent className="bg-zuvvi-indigo border-white/10 text-white max-h-60">
                    {cidadesFiltradas.map(cidade => (
                      <SelectItem key={cidade.id} value={cidade.id}>{cidade.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.cidade_id && <p className="text-red-500 text-xs">{errors.cidade_id.message}</p>}
          </div>
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
