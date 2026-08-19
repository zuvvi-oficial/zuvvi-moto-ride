import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { queryOptions } from '@tanstack/react-query';
import { getCidadesAdmin, updateStatusCidade } from '@/lib/admin.functions';
import { getUFs } from '@/lib/locations.functions';
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, Search, MapPin, Rocket, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';


const cidadesQueryOptions = (params: { 
  pagina: number; 
  uf: string | undefined; 
  status: string | undefined; 
  busca: string; 
}) => queryOptions({
  queryKey: ['admin-cidades', params],
  queryFn: () => getCidadesAdmin({ data: params }),
});

const ufsQueryOptions = queryOptions({
  queryKey: ['admin-ufs'],
  queryFn: () => getUFs(),
});

export const Route = createFileRoute('/admin/cidades')({
  component: CidadesAdmin,
});

function CidadesAdmin() {
  const [pagina, setPagina] = useState(0);
  const [uf, setUf] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [busca, setBusca] = useState('');
  const [selectedCidade, setSelectedCidade] = useState<any>(null);
  const [novoStatus, setNovoStatus] = useState<'piloto' | 'ativa' | 'em_breve' | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryClient = useQueryClient();
  const updateStatusFn = useServerFn(updateStatusCidade);

  const { data: result } = useSuspenseQuery(cidadesQueryOptions({ 
    pagina, 
    uf: uf === 'all' ? undefined : uf, 
    status: status === 'all' ? undefined : status, 
    busca 
  }));
  const { data: ufs } = useSuspenseQuery(ufsQueryOptions);

  const totalPaginas = Math.ceil(result.total / result.limite);

  const handleUpdateStatus = async () => {
    if (!selectedCidade || !novoStatus || !justificativa) return;
    
    setIsSubmitting(true);
    try {
      const res = await updateStatusFn({
        data: {
          cidadeId: selectedCidade.id,
          novoStatus: novoStatus,
          justificativa: justificativa,
        }
      });

      if (res.success) {
        toast.success(`Cidade ${selectedCidade.nome} atualizada para ${res.novoStatus}!`);
        queryClient.invalidateQueries({ queryKey: ['admin-cidades'] });
        setSelectedCidade(null);
        setNovoStatus(null);
        setJustificativa('');
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar status da cidade");
    } finally {
      setIsSubmitting(false);
    }
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'piloto':
        return <Badge className="bg-volt text-black hover:bg-volt/80">Piloto</Badge>;
      case 'ativa':
        return <Badge className="bg-green-500 hover:bg-green-600">Ativa</Badge>;
      case 'em_breve':
        return <Badge variant="outline" className="text-amber-500 border-amber-500">Em Breve</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 bg-zuvvi-indigo min-h-screen text-white">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            <Link to="/admin">← Voltar</Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="w-8 h-8 text-volt" />
            Gestão de Cidades
          </h1>
        </div>
        <div className="text-sm text-gray-400">
          Total: {result.total} cidades cadastradas
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white/5 p-4 rounded-lg border border-white/10">
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Buscar Nome</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Ex: Brasília"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(0);
              }}
              className="pl-9 bg-zuvvi-indigo border-white/10 text-white"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Filtrar por UF</label>
          <Select value={uf || 'all'} onValueChange={(val) => {
            setUf(val);
            setPagina(0);
          }}>
            <SelectTrigger className="bg-zuvvi-indigo border-white/10 text-white">
              <SelectValue placeholder="Todos os Estados" />
            </SelectTrigger>
            <SelectContent className="bg-zuvvi-indigo border-white/10 text-white">
              <SelectItem value="all">Todos os Estados</SelectItem>
              {ufs?.map((ufItem) => (
                <SelectItem key={ufItem} value={ufItem}>{ufItem}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Status Operacional</label>
          <Select value={status || 'all'} onValueChange={(val) => {
            setStatus(val);
            setPagina(0);
          }}>
            <SelectTrigger className="bg-zuvvi-indigo border-white/10 text-white">
              <SelectValue placeholder="Todos os Status" />
            </SelectTrigger>
            <SelectContent className="bg-zuvvi-indigo border-white/10 text-white">
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="piloto">Piloto</SelectItem>
              <SelectItem value="ativa">Ativa</SelectItem>
              <SelectItem value="em_breve">Em Breve</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-end pb-1">
           <p className="text-[10px] text-volt italic">Fase 2: Liberação Individual</p>
        </div>
      </div>

      <div className="rounded-md border border-white/10 bg-zuvvi-indigo/50 overflow-hidden">
        <Table>
          <TableHeader className="bg-white/5">
            <TableRow className="hover:bg-transparent border-white/10">
              <TableHead className="text-gray-400">Cidade</TableHead>
              <TableHead className="text-gray-400">UF</TableHead>
              <TableHead className="text-gray-400">Status</TableHead>
              <TableHead className="text-gray-400 text-right">Bandeirada</TableHead>
              <TableHead className="text-gray-400 text-right">KM</TableHead>
              <TableHead className="text-gray-400 text-right">Minuto</TableHead>
              <TableHead className="text-gray-400 text-right">Mínima</TableHead>
              <TableHead className="text-gray-400 text-right">Comissão %</TableHead>
              <TableHead className="text-gray-400 text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {result.cidades.map((cidade: any) => (
              <TableRow key={cidade.id} className="border-white/10 hover:bg-white/5 transition-colors">
                <TableCell className="font-medium">{cidade.nome}</TableCell>
                <TableCell>{cidade.estado_uf}</TableCell>
                <TableCell>{getStatusBadge(cidade.status)}</TableCell>
                <TableCell className="text-right">R$ {Number(cidade.bandeirada).toFixed(2)}</TableCell>
                <TableCell className="text-right">R$ {Number(cidade.valor_km).toFixed(2)}</TableCell>
                <TableCell className="text-right">R$ {Number(cidade.valor_min).toFixed(2)}</TableCell>
                <TableCell className="text-right">R$ {Number(cidade.tarifa_minima).toFixed(2)}</TableCell>
                <TableCell className="text-right">{cidade.comissao_pct}%</TableCell>
                <TableCell className="text-right">
                  {cidade.status === 'em_breve' && (
                    <Button 
                      size="sm" 
                      className="bg-volt text-black hover:bg-volt/80 text-[10px] font-bold h-7 px-2"
                      onClick={() => {
                        setSelectedCidade(cidade);
                        setNovoStatus('piloto');
                      }}
                    >
                      <Rocket className="w-3 h-3 mr-1" />
                      PILOTO
                    </Button>
                  )}
                  {cidade.status === 'piloto' && (
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold h-7 px-2"
                      onClick={() => {
                        setSelectedCidade(cidade);
                        setNovoStatus('ativa');
                      }}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      ATIVAR
                    </Button>
                  )}
                  {cidade.status === 'ativa' && (
                    <Badge variant="secondary" className="text-green-500 bg-green-500/10 border-green-500/20 text-[10px]">OPERANTE</Badge>
                  )}

                </TableCell>
              </TableRow>

            ))}
            {result.cidades.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                  Nenhuma cidade encontrada com os filtros selecionados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between py-4">
        <div className="text-sm text-gray-400">
          Página {pagina + 1} de {totalPaginas}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
            disabled={pagina === 0}
            className="border-white/10 bg-transparent text-white hover:bg-white/5"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
            disabled={pagina >= totalPaginas - 1}
            className="border-white/10 bg-transparent text-white hover:bg-white/5"
          >
            Próxima
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>


      <Dialog open={!!selectedCidade} onOpenChange={(open) => !open && setSelectedCidade(null)}>
        <DialogContent className="bg-zuvvi-indigo border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {novoStatus === 'piloto' ? <Rocket className="w-5 h-5 text-volt" /> : <CheckCircle className="w-5 h-5 text-green-500" />}
              {novoStatus === 'piloto' ? 'Liberar para Piloto' : 'Promover para Ativa'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Cidade: <span className="text-white font-bold">{selectedCidade?.nome} - {selectedCidade?.estado_uf}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-white/5 p-3 rounded border border-white/5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Status Atual:</span>
                <span className="font-bold uppercase">{selectedCidade?.status}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Novo Status:</span>
                <span className="font-bold uppercase text-volt">{novoStatus}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] bg-black/20 p-2 rounded">
              <div><span className="text-gray-500">Bandeirada:</span> R$ {Number(selectedCidade?.bandeirada).toFixed(2)}</div>
              <div><span className="text-gray-500">KM:</span> R$ {Number(selectedCidade?.valor_km).toFixed(2)}</div>
              <div><span className="text-gray-500">Minuto:</span> R$ {Number(selectedCidade?.valor_min).toFixed(2)}</div>
              <div><span className="text-gray-500">Mínima:</span> R$ {Number(selectedCidade?.tarifa_minima).toFixed(2)}</div>
              <div className="col-span-2"><span className="text-gray-500">Comissão:</span> {selectedCidade?.comissao_pct}%</div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded flex gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-[11px] text-amber-200">
                {novoStatus === 'piloto' 
                  ? "A liberação em modo piloto permite que motoristas aprovados fiquem online, mas pode haver restrições de visibilidade pública."
                  : "Promover para ativa torna a cidade totalmente operacional para todos os usuários."}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Justificativa Obrigatória</label>
              <Textarea 
                placeholder="Descreva o motivo desta alteração..."
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                className="bg-white/5 border-white/10 text-white min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => setSelectedCidade(null)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateStatus}
              disabled={!justificativa || isSubmitting}
              className={novoStatus === 'piloto' ? 'bg-volt text-black hover:bg-volt/80' : 'bg-green-600 hover:bg-green-700 text-white'}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar Liberação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

