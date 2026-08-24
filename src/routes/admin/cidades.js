import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { queryOptions } from '@tanstack/react-query';
import { getCidadesAdmin, updateStatusCidade, updateTarifasCidade } from '@/lib/admin.functions';
import { getUFs } from '@/lib/locations.functions';
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, Search, MapPin, Rocket, CheckCircle, AlertTriangle, Loader2, Settings2 } from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminBottomNav } from '@/components/admin/AdminBottomNav';
import { ChevronDown, ChevronUp } from 'lucide-react';
const cidadesQueryOptions = (params) => queryOptions({
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
    const [uf, setUf] = useState(undefined);
    const [status, setStatus] = useState(undefined);
    const [busca, setBusca] = useState('');
    const [selectedCidade, setSelectedCidade] = useState(null);
    const [selectedCidadeTarifas, setSelectedCidadeTarifas] = useState(null);
    const [expandedCidade, setExpandedCidade] = useState(null);
    const [tarifasForm, setTarifasForm] = useState({
        bandeirada: 0,
        valor_km: 0,
        valor_min: 0,
        tarifa_minima: 0,
        comissao_pct: 0,
        raio_atuacao_km: 0,
    });
    const [novoStatus, setNovoStatus] = useState(null);
    const [justificativa, setJustificativa] = useState('');
    const [justificativaTarifa, setJustificativaTarifa] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const queryClient = useQueryClient();
    const updateStatusFn = useServerFn(updateStatusCidade);
    const updateTarifasFn = useServerFn(updateTarifasCidade);
    const { data: result } = useSuspenseQuery(cidadesQueryOptions({
        pagina,
        uf: uf === 'all' ? undefined : uf,
        status: status === 'all' ? undefined : status,
        busca
    }));
    const { data: ufs } = useSuspenseQuery(ufsQueryOptions);
    const totalPaginas = Math.ceil(result.total / result.limite);
    const handleUpdateStatus = async () => {
        if (!selectedCidade || !novoStatus || !justificativa)
            return;
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
        }
        catch (error) {
            toast.error(error.message || "Erro ao atualizar status da cidade");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleUpdateTarifas = async () => {
        if (!selectedCidadeTarifas || !justificativaTarifa)
            return;
        setIsSubmitting(true);
        try {
            const res = await updateTarifasFn({
                data: {
                    cidadeId: selectedCidadeTarifas.id,
                    ...tarifasForm,
                    justificativa: justificativaTarifa,
                }
            });
            if (res.success) {
                toast.success(`Tarifas de ${selectedCidadeTarifas.nome} atualizadas!`);
                queryClient.invalidateQueries({ queryKey: ['admin-cidades'] });
                setSelectedCidadeTarifas(null);
                setJustificativaTarifa('');
            }
        }
        catch (error) {
            toast.error(error.message || "Erro ao atualizar tarifas da cidade");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const getStatusBadge = (status) => {
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
    return (<div className="min-h-screen bg-zuvvi-indigo text-white flex flex-col">
      <AdminHeader action={<Button asChild variant="outline" size="sm" className="border-white/10 text-white hover:bg-white/5 h-9 px-4 rounded-xl">
            <Link to="/admin">Voltar</Link>
          </Button>}/>
      <AdminBottomNav />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <MapPin className="w-8 h-8 text-volt"/>
              Gestão de Cidades
            </h1>
          </div>
          <div className="text-sm text-gray-400">
            Total: {result.total} cidades cadastradas
          </div>
        </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Buscar Nome</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"/>
            <Input placeholder="Ex: Brasília" value={busca} onChange={(e) => {
            setBusca(e.target.value);
            setPagina(0);
        }} className="pl-9 bg-zuvvi-indigo border-white/10 text-white"/>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Filtrar por UF</label>
          <Select value={uf || 'all'} onValueChange={(val) => {
            setUf(val);
            setPagina(0);
        }}>
            <SelectTrigger className="bg-zuvvi-indigo border-white/10 text-white">
              <SelectValue placeholder="Todos os Estados"/>
            </SelectTrigger>
            <SelectContent className="bg-zuvvi-indigo border-white/10 text-white">
              <SelectItem value="all">Todos os Estados</SelectItem>
              {ufs?.map((ufItem) => (<SelectItem key={ufItem} value={ufItem}>{ufItem}</SelectItem>))}
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
              <SelectValue placeholder="Todos os Status"/>
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

      <div className="hidden md:block rounded-md border border-white/10 bg-zuvvi-indigo/50 overflow-hidden">
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
            {result.cidades.map((cidade) => (<TableRow key={cidade.id} className="border-white/10 hover:bg-white/5 transition-colors">
                <TableCell className="font-medium">{cidade.nome}</TableCell>
                <TableCell>{cidade.estado_uf}</TableCell>
                <TableCell>{getStatusBadge(cidade.status)}</TableCell>
                <TableCell className="text-right">R$ {Number(cidade.bandeirada).toFixed(2)}</TableCell>
                <TableCell className="text-right">R$ {Number(cidade.valor_km).toFixed(2)}</TableCell>
                <TableCell className="text-right">R$ {Number(cidade.valor_min).toFixed(2)}</TableCell>
                <TableCell className="text-right">R$ {Number(cidade.tarifa_minima).toFixed(2)}</TableCell>
                <TableCell className="text-right">{cidade.comissao_pct}%</TableCell>
                <TableCell className="text-right flex items-center justify-end gap-2">
                  <Button size="sm" variant="outline" className="border-white/20 text-gray-300 hover:text-white hover:bg-white/10 h-8 px-2" aria-label={`Editar tarifas de ${cidade.nome}`} onClick={() => {
                setSelectedCidadeTarifas(cidade);
                setTarifasForm({
                    bandeirada: Number(cidade.bandeirada),
                    valor_km: Number(cidade.valor_km),
                    valor_min: Number(cidade.valor_min),
                    tarifa_minima: Number(cidade.tarifa_minima),
                    comissao_pct: Number(cidade.comissao_pct),
                    raio_atuacao_km: Number(cidade.raio_atuacao_km || 0)
                });
            }}>
                    <Settings2 className="w-4 h-4"/>
                  </Button>

                  {cidade.status === 'em_breve' && (<Button size="sm" className="bg-volt text-black hover:bg-volt/90 text-xs font-bold h-8 px-3 shadow-lg shadow-volt/20" aria-label={`Liberar ${cidade.nome} para piloto`} onClick={() => {
                    setSelectedCidade(cidade);
                    setNovoStatus('piloto');
                }}>
                      <Rocket className="w-4 h-4 mr-2"/>
                      Liberar para piloto
                    </Button>)}
                  {cidade.status === 'piloto' && (<Button size="sm" variant="default" className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold h-8 px-3 shadow-lg shadow-green-500/20" aria-label={`Promover ${cidade.nome} para ativa`} onClick={() => {
                    setSelectedCidade(cidade);
                    setNovoStatus('ativa');
                }}>
                      <CheckCircle className="w-4 h-4 mr-2"/>
                      Promover para ativa
                    </Button>)}
                  {cidade.status === 'ativa' && (<div className="flex items-center justify-end gap-1.5 text-green-400 font-semibold text-xs py-1 px-2 rounded-full bg-green-400/10 border border-green-400/20">
                      <CheckCircle className="w-3.5 h-3.5"/>
                      <span>Cidade Ativa</span>
                    </div>)}

                </TableCell>
              </TableRow>))}
            {result.cidades.length === 0 && (<TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                  Nenhuma cidade encontrada com os filtros selecionados.
                </TableCell>
              </TableRow>)}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-4">
        {result.cidades.map((cidade) => (<div key={cidade.id} className="bg-white/5 border border-white/10 rounded-[1.5rem] overflow-hidden">
            <div className="p-5 flex items-center justify-between cursor-pointer active:bg-white/[0.02]" onClick={() => setExpandedCidade(expandedCidade === cidade.id ? null : cidade.id)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zuvvi-volt/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-zuvvi-volt"/>
                </div>
                <div>
                  <h3 className="font-bold text-base">{cidade.nome}</h3>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-white/40">{cidade.estado_uf}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(cidade.status)}
                {expandedCidade === cidade.id ? <ChevronUp className="w-5 h-5 text-white/20"/> : <ChevronDown className="w-5 h-5 text-white/20"/>}
              </div>
            </div>

            {expandedCidade === cidade.id && (<div className="px-5 pb-5 space-y-5 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-4 border-t border-white/5">
                  {[
                    { label: "Bandeirada", value: `R$ ${Number(cidade.bandeirada).toFixed(2)}` },
                    { label: "KM", value: `R$ ${Number(cidade.valor_km).toFixed(2)}` },
                    { label: "Minuto", value: `R$ ${Number(cidade.valor_min).toFixed(2)}` },
                    { label: "Mínima", value: `R$ ${Number(cidade.tarifa_minima).toFixed(2)}` },
                    { label: "Comissão", value: `${cidade.comissao_pct}%` },
                ].map((item) => (<div key={item.label}>
                      <p className="text-[9px] uppercase font-bold tracking-widest text-white/30">{item.label}</p>
                      <p className="text-sm font-bold">{item.value}</p>
                    </div>))}
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button variant="outline" className="w-full h-12 rounded-xl border-white/10 hover:bg-white/5 font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2" onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCidadeTarifas(cidade);
                    setTarifasForm({
                        bandeirada: Number(cidade.bandeirada),
                        valor_km: Number(cidade.valor_km),
                        valor_min: Number(cidade.valor_min),
                        tarifa_minima: Number(cidade.tarifa_minima),
                        comissao_pct: Number(cidade.comissao_pct),
                        raio_atuacao_km: Number(cidade.raio_atuacao_km || 0)
                    });
                }}>
                    <Settings2 className="w-4 h-4"/>
                    Configurar Tarifas
                  </Button>

                  {cidade.status === 'em_breve' && (<Button className="w-full h-12 rounded-xl bg-volt text-black hover:bg-volt/90 font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-volt/20" onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCidade(cidade);
                        setNovoStatus('piloto');
                    }}>
                      <Rocket className="w-4 h-4 mr-2"/>
                      Liberar para piloto
                    </Button>)}
                  {cidade.status === 'piloto' && (<Button className="w-full h-12 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-green-500/20" onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCidade(cidade);
                        setNovoStatus('ativa');
                    }}>
                      <CheckCircle className="w-4 h-4 mr-2"/>
                      Promover para ativa
                    </Button>)}
                </div>
              </div>)}
          </div>))}
      </div>

      <div className="flex items-center justify-between py-4">
        <div className="text-sm text-gray-400">
          Página {pagina + 1} de {totalPaginas}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={pagina === 0} className="border-white/10 bg-transparent text-white hover:bg-white/5">
            <ChevronLeft className="w-4 h-4 mr-2"/>
            Anterior
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))} disabled={pagina >= totalPaginas - 1} className="border-white/10 bg-transparent text-white hover:bg-white/5">
            Próxima
            <ChevronRight className="w-4 h-4 ml-2"/>
          </Button>
        </div>
      </div>


      <Dialog open={!!selectedCidade} onOpenChange={(open) => !open && setSelectedCidade(null)}>
        <DialogContent className="bg-zuvvi-indigo border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {novoStatus === 'piloto' ? <Rocket className="w-5 h-5 text-volt"/> : <CheckCircle className="w-5 h-5 text-green-500"/>}
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
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0"/>
              <p className="text-[11px] text-amber-200">
                {novoStatus === 'piloto'
            ? "A liberação em modo piloto permite que motoristas aprovados fiquem online, mas pode haver restrições de visibilidade pública."
            : "Promover para ativa torna a cidade totalmente operacional para todos os usuários."}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Justificativa Obrigatória</label>
              <Textarea placeholder="Descreva o motivo desta alteração..." value={justificativa} onChange={(e) => setJustificativa(e.target.value)} className="bg-white/5 border-white/10 text-white min-h-[80px]"/>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedCidade(null)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateStatus} disabled={!justificativa || isSubmitting} className={novoStatus === 'piloto' ? 'bg-volt text-black hover:bg-volt/80' : 'bg-green-600 hover:bg-green-700 text-white'}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : null}
              Confirmar Liberação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedCidadeTarifas} onOpenChange={(open) => !open && setSelectedCidadeTarifas(null)}>
        <DialogContent className="bg-zuvvi-indigo border-white/10 text-white max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-volt"/>
              Editar Tarifas da Cidade
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Ajuste os valores operacionais para <span className="text-white font-bold">{selectedCidadeTarifas?.nome} - {selectedCidadeTarifas?.estado_uf}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase">Bandeirada (R$)</label>
              <Input type="number" step="0.01" value={tarifasForm.bandeirada} onChange={(e) => setTarifasForm({ ...tarifasForm, bandeirada: Number(e.target.value) })} className="bg-white/5 border-white/10 text-white"/>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase">Valor por KM (R$)</label>
              <Input type="number" step="0.01" value={tarifasForm.valor_km} onChange={(e) => setTarifasForm({ ...tarifasForm, valor_km: Number(e.target.value) })} className="bg-white/5 border-white/10 text-white"/>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase">Valor por Minuto (R$)</label>
              <Input type="number" step="0.01" value={tarifasForm.valor_min} onChange={(e) => setTarifasForm({ ...tarifasForm, valor_min: Number(e.target.value) })} className="bg-white/5 border-white/10 text-white"/>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase">Tarifa Mínima (R$)</label>
              <Input type="number" step="0.01" value={tarifasForm.tarifa_minima} onChange={(e) => setTarifasForm({ ...tarifasForm, tarifa_minima: Number(e.target.value) })} className="bg-white/5 border-white/10 text-white"/>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase">Comissão (%)</label>
              <Input type="number" step="0.1" value={tarifasForm.comissao_pct} onChange={(e) => setTarifasForm({ ...tarifasForm, comissao_pct: Number(e.target.value) })} className="bg-white/5 border-white/10 text-white"/>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase">Raio de Atuação (KM)</label>
              <Input type="number" value={tarifasForm.raio_atuacao_km} onChange={(e) => setTarifasForm({ ...tarifasForm, raio_atuacao_km: Number(e.target.value) })} className="bg-white/5 border-white/10 text-white"/>
            </div>
            
            <div className="col-span-2 space-y-2 pt-2">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Justificativa Obrigatória</label>
              <Textarea placeholder="Descreva o motivo desta alteração de tarifas..." value={justificativaTarifa} onChange={(e) => setJustificativaTarifa(e.target.value)} className="bg-white/5 border-white/10 text-white min-h-[80px]"/>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedCidadeTarifas(null)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateTarifas} disabled={!justificativaTarifa || isSubmitting} className="bg-volt text-black hover:bg-volt/80">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : null}
              Salvar Tarifas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </div>
    </div>);
}
