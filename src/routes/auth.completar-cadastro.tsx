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
import { getUFs, getCitiesByUF } from '@/lib/locations.functions';

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

const meses = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

function CompletarCadastroPage() {
  const navigate = useNavigate();
  const executeUpdate = useServerFn(updateUserInfo);
  const checkStatus = useServerFn(checkUserProfileStatus);
  const fetchUFs = useServerFn(getUFs);
  const fetchCities = useServerFn(getCitiesByUF);
  
  const [isLoading, setIsLoading] = useState(false);
  const [ufs, setUfs] = useState<string[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [isLoadingUfs, setIsLoadingUfs] = useState(true);
  const [isLoadingCities, setIsLoadingCities] = useState(false);

  // Estados locais para os seletores de data
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

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
  const prevUF = useMemo(() => {
    return { value: selectedUF };
  }, []); // Mantém a referência estável do objeto, mas o valor interno precisa de acompanhamento customizado
  
  // UseRef é melhor para rastrear o valor anterior sem disparar re-renders
  const lastSelectedUF = useRef(selectedUF);

  // Atualiza o valor de data_nascimento no formulário quando os seletores mudam
  useEffect(() => {
    if (day && month && year) {
      setValue('data_nascimento', `${year}-${month}-${day.padStart(2, '0')}`);
    } else {
      setValue('data_nascimento', '');
    }
  }, [day, month, year, setValue]);

  useEffect(() => {
    const loadUFs = async () => {
      try {
        const data = await fetchUFs();
        setUfs(data);
      } catch (error) {
        toast.error("Erro ao carregar estados. Tente recarregar a página.");
      } finally {
        setIsLoadingUfs(false);
      }
    };
    loadUFs();
  }, [fetchUFs]);

  useEffect(() => {
    const loadCities = async () => {
      if (!selectedUF) {
        setCities([]);
        return;
      }
      
      setIsLoadingCities(true);
      try {
        const data = await fetchCities({ data: selectedUF });
        setCities(data);
      } catch (error) {
        toast.error("Erro ao carregar cidades do estado selecionado.");
      } finally {
        setIsLoadingCities(false);
      }
    };
    
    // Só limpa a cidade e recarrega se o UF realmente mudou
    if (selectedUF !== prevUFRef.current) {
      setValue('cidade_id', '');
      prevUFRef.current = selectedUF;
      loadCities();
    } else if (cities.length === 0 && selectedUF) {
      // Caso inicial onde temos UF mas não temos cidades
      loadCities();
    }
  }, [selectedUF, fetchCities, setValue, cities.length]);

  // Lógica para anos (do ano atual até 100 anos atrás)
  const anos = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= currentYear - 100; i--) {
      years.push(i.toString());
    }
    return years;
  }, []);

  // Lógica para dias baseada no mês e ano
  const dias = useMemo(() => {
    if (!month) return Array.from({ length: 31 }, (_, i) => (i + 1).toString());
    
    let daysInMonth = 31;
    const m = parseInt(month);
    
    if ([4, 6, 9, 11].includes(m)) {
      daysInMonth = 30;
    } else if (m === 2) {
      const y = parseInt(year);
      const isLeapYear = y ? (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0) : false;
      daysInMonth = isLeapYear ? 29 : 28;
    }
    
    return Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
  }, [month, year]);

  // Reseta o dia se o novo mês tiver menos dias
  useEffect(() => {
    if (day && parseInt(day) > dias.length) {
      setDay('');
    }
  }, [dias, day]);

  const onSubmit = async (data: CompletionForm) => {
    // Validação extra para não permitir data futura
    const birthDate = new Date(data.data_nascimento);
    const today = new Date();
    if (birthDate > today) {
      toast.error("Data de nascimento não pode ser no futuro.");
      return;
    }

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

  const onInvalid = (errors: any) => {
    console.log("Validation errors:", errors);
    toast.error("Por favor, preencha todos os campos obrigatórios corretamente.");
    
    // Rola para o primeiro erro
    const firstError = Object.keys(errors)[0];
    const element = firstError ? document.getElementById(firstError) : null;
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.focus();
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white font-poppins">Quase lá!</h2>
        <p className="text-muted-foreground text-sm mt-1 font-poppins">Precisamos de mais alguns dados para sua segurança</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cpf" className="text-white/80 font-poppins text-sm">CPF</Label>
          <Controller
            name="cpf"
            control={control}
            render={({ field }) => (
              <Input 
                {...field}
                id="cpf" 
                placeholder="000.000.000-00" 
                className="bg-zuvvi-indigo border-white/10 text-white focus:border-zuvvi-volt h-12"
                onChange={(e) => field.onChange(formatCPF(e.target.value))}
              />
            )}
          />
          {errors.cpf && <p className="text-red-500 text-xs font-poppins">{errors.cpf.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="celular" className="text-white/80 font-poppins text-sm">Celular</Label>
          <Controller
            name="celular"
            control={control}
            render={({ field }) => (
              <Input 
                {...field}
                id="celular" 
                placeholder="(00) 00000-0000" 
                className="bg-zuvvi-indigo border-white/10 text-white focus:border-zuvvi-volt h-12"
                onChange={(e) => field.onChange(formatPhone(e.target.value))}
              />
            )}
          />
          {errors.celular && <p className="text-red-500 text-xs font-poppins">{errors.celular.message}</p>}
        </div>

        <div className="space-y-2">
          <Label className="text-white/80 font-poppins text-sm">Data de Nascimento</Label>
          <div className="grid grid-cols-3 gap-2">
            <Select onValueChange={setDay} value={day}>
              <SelectTrigger className="bg-zuvvi-indigo border-white/10 text-white focus:border-zuvvi-volt h-12">
                <SelectValue placeholder="Dia" />
              </SelectTrigger>
              <SelectContent className="bg-zuvvi-indigo border-white/10 text-white max-h-60">
                {dias.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select onValueChange={setMonth} value={month}>
              <SelectTrigger className="bg-zuvvi-indigo border-white/10 text-white focus:border-zuvvi-volt h-12">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent className="bg-zuvvi-indigo border-white/10 text-white max-h-60">
                {meses.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select onValueChange={setYear} value={year}>
              <SelectTrigger className="bg-zuvvi-indigo border-white/10 text-white focus:border-zuvvi-volt h-12">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent className="bg-zuvvi-indigo border-white/10 text-white max-h-60">
                {anos.map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input type="hidden" {...control.register('data_nascimento')} />
          {errors.data_nascimento && <p className="text-red-500 text-xs font-poppins">{errors.data_nascimento.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="uf" className="text-white/80 font-poppins text-sm">Estado</Label>
            <Controller
              name="uf"
              control={control}
              render={({ field }) => (
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value}
                  disabled={isLoadingUfs}
                >
                  <SelectTrigger className="bg-zuvvi-indigo border-white/10 text-white focus:border-zuvvi-volt h-12">
                    <SelectValue placeholder={isLoadingUfs ? "..." : "UF"} />
                  </SelectTrigger>
                  <SelectContent className="bg-zuvvi-indigo border-white/10 text-white pointer-events-auto touch-pan-y">
                    {ufs.map(uf => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.uf && <p className="text-red-500 text-xs font-poppins">{errors.uf.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cidade_id" className="text-white/80 font-poppins text-sm">Cidade</Label>
            <Controller
              name="cidade_id"
              control={control}
              render={({ field }) => (
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value}
                  disabled={!selectedUF || isLoadingCities}
                >
                  <SelectTrigger className="bg-zuvvi-indigo border-white/10 text-white focus:border-zuvvi-volt h-12">
                    <SelectValue placeholder={isLoadingCities ? "Carregando..." : "Cidade"} />
                  </SelectTrigger>
                  <SelectContent className="bg-zuvvi-indigo border-white/10 text-white max-h-60">
                    {cities.map(cidade => (
                      <SelectItem key={cidade.id} value={cidade.id}>{cidade.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.cidade_id && <p className="text-red-500 text-xs font-poppins">{errors.cidade_id.message}</p>}
          </div>
        </div>

        <Button 
          type="submit" 
          disabled={isLoading}
          className="w-full bg-zuvvi-volt hover:bg-zuvvi-volt/90 text-zuvvi-indigo font-bold h-14 text-lg mt-6 transition-all active:scale-[0.98] font-poppins"
        >
          {isLoading ? "Salvando..." : "CONCLUIR CADASTRO"}
        </Button>
      </form>
    </div>
  );
}
