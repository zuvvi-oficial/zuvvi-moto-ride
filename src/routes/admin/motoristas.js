import { createFileRoute, redirect } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';
import { getMotoristasAdmin, updateStatusMotorista, getMotoristaDetalheAdmin, updateStatusDocumento, getDocumentoUrlSigned } from '@/lib/admin.functions';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminBottomNav } from '@/components/admin/AdminBottomNav';
import { Link } from '@tanstack/react-router';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, CheckCircle, XCircle, Clock, MapPin, User, FileText, Bike, CreditCard, History, AlertTriangle, ChevronRight, Maximize2, LogOut } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { cn } from '@/lib/utils';
const getHojeBR = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(now);
};
const motoristasOptions = (filters) => queryOptions({
    queryKey: ['admin-motoristas', filters],
    queryFn: () => getMotoristasAdmin({ data: filters }),
});
export const Route = createFileRoute('/admin/motoristas')({
    loader: async ({ context }) => {
        try {
            await context.queryClient.ensureQueryData(motoristasOptions({}));
        }
        catch (e) {
            throw redirect({ to: '/' });
        }
    },
    component: AdminMotoristas,
});
function AdminMotoristas() {
    const [busca, setBusca] = useState('');
    const [status, setStatus] = useState('');
    const [selectedMotorista, setSelectedMotorista] = useState(null);
    const [justificativa, setJustificativa] = useState('');
    const [actionType, setActionType] = useState(null);
    const [viewingMotoristaId, setViewingMotoristaId] = useState(null);
    const [reviewingDoc, setReviewingDoc] = useState(null);
    const [justificativaDoc, setJustificativaDoc] = useState('');
    const [isViewingFile, setIsViewingFile] = useState(null);
    const [loadingFile, setLoadingFile] = useState(null);
    const [actionError, setActionError] = useState(null);
    const [isActionSubmitting, setIsActionSubmitting] = useState(false);
    const queryClient = useQueryClient();
    const updateStatusFn = useServerFn(updateStatusMotorista);
    const updateStatusDocFn = useServerFn(updateStatusDocumento);
    const getDetalheFn = useServerFn(getMotoristaDetalheAdmin);
    const getDocUrlFn = useServerFn(getDocumentoUrlSigned);
    const { data: motoristas } = useSuspenseQuery(motoristasOptions({ status, busca }));
    const { data: detalhe, isLoading: loadingDetalhe } = useQuery({
        queryKey: ['admin-motorista-detalhe', viewingMotoristaId],
        queryFn: () => getDetalheFn({ data: { motoristaId: viewingMotoristaId } }),
        enabled: !!viewingMotoristaId,
    });
    const handleAction = async () => {
        if (!selectedMotorista || !actionType)
            return;
        setActionError(null);
        setIsActionSubmitting(true);
        try {
            await updateStatusFn({
                data: {
                    motoristaId: selectedMotorista.motoristas.id,
                    novoStatus: actionType,
                    justificativa: justificativa || undefined,
                }
            });
            toast.success(`Motorista ${actionType === 'aprovado' ? 'aprovado' : 'atualizado'} com sucesso!`);
            queryClient.invalidateQueries({ queryKey: ['admin-motoristas'] });
            queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
            if (viewingMotoristaId && viewingMotoristaId === selectedMotorista.motoristas.id) {
                queryClient.invalidateQueries({ queryKey: ['admin-motorista-detalhe', viewingMotoristaId] });
            }
            setSelectedMotorista(null);
            setJustificativa('');
            setActionType(null);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Não foi possível concluir esta ação.";
            setActionError(message);
            toast.error(message);
        }
        finally {
            setIsActionSubmitting(false);
        }
    };
    const handleDocAction = async (status) => {
        if (!reviewingDoc)
            return;
        try {
            const result = await updateStatusDocFn({
                data: {
                    documentoId: reviewingDoc.id,
                    novoStatus: status,
                    justificativa: (status === 'recusado' || status === 'correcao_solicitada') ? justificativaDoc : undefined,
                }
            });
            if (!result.success) {
                throw new Error("O servidor retornou sucesso mas a operação falhou internamente.");
            }
            toast.success(status === 'aprovado' ? 'Documento aprovado com sucesso!' :
                status === 'recusado' ? 'Documento recusado com sucesso!' :
                    'Correção da CNH solicitada com sucesso!');
            // Invalidação rigorosa e refetch para garantir dados reais do banco
            await queryClient.invalidateQueries({ queryKey: ['admin-motorista-detalhe', viewingMotoristaId] });
            await queryClient.refetchQueries({ queryKey: ['admin-motorista-detalhe', viewingMotoristaId] });
            setReviewingDoc(null);
            setJustificativaDoc('');
        }
        catch (error) {
            toast.error(error.message);
        }
    };
    const handleViewDoc = async (docId) => {
        try {
            setLoadingFile(docId);
            const result = await getDocUrlFn({ data: { documentoId: docId } });
            if (result.isPdf) {
                window.open(result.url, '_blank');
            }
            else {
                setIsViewingFile({
                    url: result.url,
                    type: result.tipo,
                    isPdf: result.isPdf
                });
            }
        }
        catch (error) {
            toast.error(error.message);
        }
        finally {
            setLoadingFile(null);
        }
    };
    return (<div className="min-h-screen bg-zuvvi-indigo text-white flex flex-col">
      <AdminHeader action={<div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="border-white/10 text-white hover:bg-white/5 h-9 px-4 rounded-xl">
              <Link to="/admin">Voltar</Link>
            </Button>
            
            <Button variant="ghost" size="sm" onClick={() => {
                supabase.auth.signOut().then(() => {
                    window.location.href = '/auth/login';
                });
            }} className="h-9 px-3 sm:px-4 rounded-xl text-white/40 hover:text-white hover:bg-white/5 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all active:scale-95">
              <LogOut className="w-3 h-3"/>
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>}/>
      <AdminBottomNav />
      
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Motoristas</h1>
        </div>

      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
        <Input placeholder="Buscar motorista..." className="w-full sm:max-w-sm bg-white/5 border-white/10 text-white h-12 sm:h-10" value={busca} onChange={(e) => setBusca(e.target.value)}/>
        <select className="bg-zuvvi-indigo border border-white/10 rounded-xl px-3 h-12 sm:h-10 text-sm text-white" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="em_preenchimento">Pendente</option>
          <option value="em_analise">Em Análise</option>
          <option value="aprovado">Aprovado</option>
          <option value="recusado">Recusado</option>
          <option value="suspenso">Suspenso</option>
        </select>
      </div>

      <div className="hidden md:block rounded-md border border-white/10">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-white/5">
              <TableHead className="text-gray-400">Nome</TableHead>
              <TableHead className="text-gray-400">Contato</TableHead>
              <TableHead className="text-gray-400">Cidade</TableHead>
              <TableHead className="text-gray-400">Status</TableHead>
              <TableHead className="text-gray-400">Online</TableHead>
              <TableHead className="text-gray-400 text-center">Detalhes</TableHead>
              <TableHead className="text-gray-400 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {motoristas?.map((user) => (<TableRow key={user.id} className="border-white/10 hover:bg-white/5">
                <TableCell className="font-medium">{user.nome}</TableCell>
                <TableCell>
                  <div className="text-sm">{user.email}</div>
                  <div className="text-xs text-gray-400">{user.celular}</div>
                </TableCell>
                <TableCell>{user.cidades?.nome}/{user.cidades?.estado_uf}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.motoristas.status_aprovacao === 'aprovado' ? 'bg-green-500/20 text-green-500' :
                user.motoristas.status_aprovacao === 'em_analise' ? 'bg-blue-500/20 text-blue-500' :
                    'bg-amber-500/20 text-amber-500'}`}>
                    {user.motoristas.status_aprovacao}
                  </span>
                </TableCell>
                <TableCell>
                  <div className={`h-2 w-2 rounded-full ${user.motoristas.is_disponivel ? 'bg-volt' : 'bg-gray-500'}`}/>
                </TableCell>
                <TableCell className="text-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover:bg-white/10 text-volt" onClick={() => setViewingMotoristaId(user.motoristas.id)}>
                          <Eye className="h-5 w-5"/>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Ver detalhes</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {user.motoristas.status_aprovacao !== 'aprovado' && (<Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => {
                    setActionError(null);
                    setSelectedMotorista(user);
                    setActionType('aprovado');
                }}>
                      Aprovar
                    </Button>)}
                  {user.motoristas.status_aprovacao === 'aprovado' && (<Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => {
                    setActionError(null);
                    setSelectedMotorista(user);
                    setActionType('suspenso');
                }}>
                      Suspender
                    </Button>)}
                  {user.motoristas.status_aprovacao !== 'recusado' && user.motoristas.status_aprovacao !== 'suspenso' && (<Button size="sm" variant="destructive" onClick={() => {
                    setActionError(null);
                    setSelectedMotorista(user);
                    setActionType('recusado');
                }}>
                      Recusar
                    </Button>)}
                </TableCell>
              </TableRow>))}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-4">
        {motoristas?.map((user) => (<div key={user.id} className="bg-white/5 border border-white/10 rounded-[1.5rem] p-5 space-y-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="font-bold text-lg">{user.nome}</h3>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${user.motoristas.is_disponivel ? 'bg-volt shadow-[0_0_8px_rgba(198,255,61,0.5)]' : 'bg-gray-500'}`}/>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">
                    {user.motoristas.is_disponivel ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
              <Badge className={cn("rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-widest", user.motoristas.status_aprovacao === 'aprovado' ? 'bg-green-500/20 text-green-500 border-green-500/20' :
                user.motoristas.status_aprovacao === 'em_analise' ? 'bg-blue-500/20 text-blue-500 border-blue-500/20' :
                    'bg-amber-500/20 text-amber-500 border-amber-500/20')}>
                {user.motoristas.status_aprovacao}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-1">
                <p className="text-[9px] uppercase font-bold tracking-widest text-white/30">Cidade</p>
                <p className="text-sm font-medium">{user.cidades?.nome}/{user.cidades?.estado_uf}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] uppercase font-bold tracking-widest text-white/30">Contato</p>
                <p className="text-sm font-medium">{user.celular}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" className="w-full h-12 rounded-xl border-white/10 hover:bg-white/5 font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2" onClick={() => setViewingMotoristaId(user.motoristas.id)}>
                <Eye className="w-4 h-4"/>
                Ver Detalhes
              </Button>
              
              <div className="flex gap-2">
                {user.motoristas.status_aprovacao !== 'aprovado' && (<Button className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 font-bold uppercase text-[10px] tracking-widest" onClick={() => {
                    setActionError(null);
                    setSelectedMotorista(user);
                    setActionType('aprovado');
                }}>
                    Aprovar
                  </Button>)}
                {user.motoristas.status_aprovacao === 'aprovado' && (<Button className="flex-1 h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase text-[10px] tracking-widest" onClick={() => {
                    setActionError(null);
                    setSelectedMotorista(user);
                    setActionType('suspenso');
                }}>
                    Suspender
                  </Button>)}
                {user.motoristas.status_aprovacao !== 'recusado' && user.motoristas.status_aprovacao !== 'suspenso' && (<Button variant="destructive" className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 font-bold uppercase text-[10px] tracking-widest" onClick={() => {
                    setActionError(null);
                    setSelectedMotorista(user);
                    setActionType('recusado');
                }}>
                    Recusar
                  </Button>)}
              </div>
            </div>
          </div>))}
      </div>

      <Dialog open={!!selectedMotorista} onOpenChange={(open) => {
            if (!open) {
                setSelectedMotorista(null);
                setActionError(null);
            }
        }}>
        <DialogContent className="bg-zuvvi-indigo border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>
              Confirmar Ação: {actionType === 'aprovado' ? 'Aprovar' :
            actionType === 'recusado' ? 'Recusar' :
                'Suspender'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-400">
              Deseja realmente {actionType === 'aprovado' ? 'aprovar' :
            actionType === 'recusado' ? 'recusar' :
                'suspender'} o motorista <strong>{selectedMotorista?.nome}</strong>?
            </p>
            {actionType !== 'aprovado' && (<div className="space-y-2">
                <label className="text-sm font-medium">Justificativa (obrigatória):</label>
                <Textarea className="bg-white/5 border-white/10 text-white" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Informe o motivo da recusa ou suspensão..."/>
              </div>)}

            {actionError && (<div className="p-3 rounded border border-red-500/50 bg-red-500/10 text-red-200 text-sm" role="alert" aria-live="assertive">
                {actionError}
              </div>)}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => {
            setSelectedMotorista(null);
            setActionError(null);
        }} disabled={isActionSubmitting}>Cancelar</Button>
            <Button className={actionType === 'aprovado' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} disabled={(actionType !== 'aprovado' && !justificativa) || isActionSubmitting} onClick={handleAction}>
              {isActionSubmitting ? "Processando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!viewingMotoristaId} onOpenChange={(open) => !open && setViewingMotoristaId(null)}>
        <SheetContent side="right" className="sm:max-w-2xl bg-zuvvi-indigo border-white/10 text-white p-0">
          <SheetHeader className="p-6 border-b border-white/10">
            <SheetTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5 text-volt"/>
              Ficha do Motorista
            </SheetTitle>
            <SheetDescription className="text-gray-400">
              Dossiê completo para análise administrativa.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-8rem)] p-6">
            {loadingDetalhe ? (<div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Clock className="h-8 w-8 text-volt animate-spin"/>
                <p>Carregando dados...</p>
              </div>) : detalhe ? (<div className="space-y-8 pb-12">
                {/* APROVAÇÃO FINAL */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-volt font-semibold">
                    <CheckCircle className="h-4 w-4"/>
                    <span>Aprovação Final</span>
                  </div>
                  
                  {detalhe.motorista.status_aprovacao === 'aprovado' ? (<Card className="bg-green-500/10 border-green-500/20 text-white">
                      <CardContent className="pt-6 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-green-500 uppercase">Cadastro Aprovado</div>
                          <p className="text-xs text-green-200/70 mt-1">Este motorista já possui aprovação ativa no sistema.</p>
                        </div>
                        <CheckCircle className="h-8 w-8 text-green-500/50"/>
                      </CardContent>
                    </Card>) : (<Card className="bg-white/5 border-white/10 text-white">
                      <CardContent className="pt-6 space-y-4">
                        {(() => {
                    const tiposObrigatorios = ['identidade', 'cnh', 'comprovante_residencia', 'crlv', 'foto_veiculo', 'foto_placa'];
                    const docsAprovados = detalhe.documentos.filter((d) => tiposObrigatorios.includes(d.tipo_documento) && d.status_analise === 'aprovado');
                    const hoje = getHojeBR();
                    const cnhValida = detalhe.motorista.cnh_numero &&
                        (detalhe.motorista.cnh_categoria === 'A' || detalhe.motorista.cnh_categoria === 'AB') &&
                        detalhe.motorista.cnh_validade &&
                        detalhe.motorista.cnh_validade >= hoje;
                    const veiculoAprovado = detalhe.veiculo && detalhe.veiculo.status_aprovacao === 'aprovado';
                    const docsCompletos = docsAprovados.length === tiposObrigatorios.length;
                    const prontoParaAprovar = detalhe.motorista.status_aprovacao === 'em_analise' &&
                        veiculoAprovado &&
                        cnhValida &&
                        docsCompletos;
                    if (prontoParaAprovar) {
                        return (<div className="space-y-4">
                                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400">
                                  <strong>PRONTO PARA APROVAÇÃO FINAL:</strong> CNH, veículo e documentos obrigatórios estão regulares.
                                </div>
                                <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-6" onClick={() => {
                                // Localizar o usuário correspondente na lista para reutilizar o fluxo de aprovação da tabela
                                const motoristaLista = motoristas?.find((m) => m.motoristas.id === viewingMotoristaId);
                                if (motoristaLista) {
                                    setActionError(null);
                                    setSelectedMotorista(motoristaLista);
                                    setActionType('aprovado');
                                }
                                else {
                                    toast.error("Erro ao localizar motorista na lista.");
                                }
                            }}>
                                  APROVAR MOTORISTA
                                </Button>
                              </div>);
                    }
                    return (<div className="space-y-4">
                              <Button className="w-full bg-gray-600 cursor-not-allowed opacity-50 py-6" disabled>
                                APROVAÇÃO FINAL BLOQUEADA
                              </Button>
                              <p className="text-[10px] text-gray-400 text-center italic">
                                Verifique as pendências e alertas abaixo para habilitar a aprovação.
                              </p>
                            </div>);
                })()}
                      </CardContent>
                    </Card>)}
                </section>

                <Separator className="bg-white/10"/>

                {/* Resumo do Cadastro */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-volt font-semibold">
                    <Clock className="h-4 w-4"/>
                    <span>Resumo do Cadastro</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-white/5 border-white/10 text-white">
                      <CardContent className="pt-6">
                        <div className="text-xs text-gray-400">Status de Aprovação</div>
                        <div className="mt-1">
                          <Badge className={detalhe.motorista.status_aprovacao === 'aprovado' ? 'bg-green-500/20 text-green-500 border-green-500/50' :
                detalhe.motorista.status_aprovacao === 'em_analise' ? 'bg-blue-500/20 text-blue-500 border-blue-500/50' :
                    'bg-amber-500/20 text-amber-500 border-amber-500/50'}>
                            {detalhe.motorista.status_aprovacao.toUpperCase()}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/5 border-white/10 text-white">
                      <CardContent className="pt-6">
                        <div className="text-xs text-gray-400">Cidade de Operação</div>
                        <div className="mt-1 font-medium flex items-center gap-1">
                          <MapPin className="h-3 w-3"/>
                          {detalhe.motorista.usuarios.cidades?.nome}/{detalhe.motorista.usuarios.cidades?.estado_uf}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/5 border-white/10 text-white">
                      <CardContent className="pt-6">
                        <div className="text-xs text-gray-400">Criado em</div>
                        <div className="mt-1 font-medium">{new Date(detalhe.motorista.created_at).toLocaleDateString('pt-BR')}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/5 border-white/10 text-white">
                      <CardContent className="pt-6">
                        <div className="text-xs text-gray-400">ID Interno</div>
                        <div className="mt-1 font-mono text-[10px] break-all">{detalhe.motorista.id}</div>
                      </CardContent>
                    </Card>
                  </div>
                </section>

                <Separator className="bg-white/10"/>

                {/* Dados Pessoais */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-volt font-semibold">
                    <User className="h-4 w-4"/>
                    <span>Dados Pessoais</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <div>
                      <div className="text-gray-400">Nome Completo</div>
                      <div className="font-medium">{detalhe.motorista.usuarios.nome}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">E-mail</div>
                      <div className="font-medium">{detalhe.motorista.usuarios.email}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Celular</div>
                      <div className="font-medium">{detalhe.motorista.usuarios.celular}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">CPF</div>
                      <div className="font-medium">
                        {detalhe.motorista.usuarios.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4") || "Não informado"}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Data de Nascimento</div>
                      <div className="font-medium">
                        {detalhe.motorista.usuarios.data_nascimento ? new Date(detalhe.motorista.usuarios.data_nascimento).toLocaleDateString('pt-BR') : "Não informado"}
                      </div>
                    </div>
                  </div>
                </section>

                <Separator className="bg-white/10"/>

                {/* Dados da CNH */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-volt font-semibold">
                    <FileText className="h-4 w-4"/>
                    <span>Dados da CNH</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <div>
                      <div className="text-gray-400">Número da CNH</div>
                      <div className="font-medium">{detalhe.motorista.cnh_numero || "Não informado"}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Categoria</div>
                      <div className="font-medium">{detalhe.motorista.cnh_categoria || "Não informado"}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Validade</div>
                      <div className="font-medium flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          {detalhe.motorista.cnh_validade ? new Date(detalhe.motorista.cnh_validade + 'T12:00:00').toLocaleDateString('pt-BR') : "Não informado"}
                          {detalhe.motorista.cnh_validade && detalhe.motorista.cnh_validade < getHojeBR() && (<Badge variant="destructive" className="h-5 text-[10px] bg-red-600">VENCIDA</Badge>)}
                        </div>
                        {detalhe.motorista.cnh_validade && detalhe.motorista.cnh_validade < getHojeBR() && (<div className="text-[10px] text-red-500 font-bold uppercase flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3"/>
                            BLOQUEIO AUTOMÁTICO
                            <span className="normal-case font-normal text-gray-400 ml-1">— Motorista impedido de operar até regularizar a CNH.</span>
                          </div>)}
                      </div>
                    </div>
                  </div>
                </section>

                <Separator className="bg-white/10"/>

                {/* Dados de Recebimento */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-volt font-semibold">
                    <CreditCard className="h-4 w-4"/>
                    <span>Dados de Recebimento</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <div>
                      <div className="text-gray-400">Tipo de Chave Pix</div>
                      <div className="font-medium capitalize">{detalhe.motorista.tipo_chave_pix || "Não informado"}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Chave Pix</div>
                      <div className="font-medium">
                        {detalhe.motorista.chave_pix ?
                (detalhe.motorista.tipo_chave_pix === 'cpf' ?
                    detalhe.motorista.chave_pix.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4") :
                    detalhe.motorista.chave_pix.substring(0, 4) + "****" + detalhe.motorista.chave_pix.substring(detalhe.motorista.chave_pix.length - 2)) : "Não informado"}
                      </div>
                    </div>
                  </div>
                </section>

                <Separator className="bg-white/10"/>

                {/* Veículo Vinculado */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-volt font-semibold">
                    <Bike className="h-4 w-4"/>
                    <span>Veículo Vinculado</span>
                  </div>
                  {detalhe.veiculo ? (<Card className="bg-white/5 border-white/10 text-white">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-lg">{detalhe.veiculo.marca} {detalhe.veiculo.modelo}</div>
                            <div className="text-sm text-gray-400">{detalhe.veiculo.ano} • {detalhe.veiculo.cor}</div>
                            <div className="mt-2 font-mono text-volt">{detalhe.veiculo.placa}</div>
                          </div>
                          <Badge className={detalhe.veiculo.status_aprovacao === 'aprovado' ? 'bg-green-500/20 text-green-500 border-green-500/50' :
                    detalhe.veiculo.status_aprovacao === 'em_analise' ? 'bg-blue-500/20 text-blue-500 border-blue-500/50' :
                        'bg-amber-500/20 text-amber-500 border-amber-500/50'}>
                            {detalhe.veiculo.status_aprovacao.toUpperCase()}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>) : (<div className="text-sm text-gray-400 italic">Nenhum veículo vinculado.</div>)}
                </section>

                <Separator className="bg-white/10"/>

                {/* Alertas de Prontidão */}
                {detalhe && (<section className="space-y-3">
                    {(() => {
                    const tiposObrigatorios = ['identidade', 'cnh', 'comprovante_residencia', 'crlv', 'foto_veiculo', 'foto_placa'];
                    const docsEnviados = detalhe.documentos.filter((d) => tiposObrigatorios.includes(d.tipo_documento));
                    const docsPendentes = docsEnviados.filter((d) => d.status_analise === 'pendente');
                    const docsRecusados = docsEnviados.filter((d) => d.status_analise === 'recusado');
                    const docsCorrecao = docsEnviados.filter((d) => d.status_analise === 'correcao_solicitada');
                    const hoje = getHojeBR();
                    const cnhVencida = detalhe.motorista.cnh_validade && detalhe.motorista.cnh_validade < hoje;
                    const alertas = [];
                    const alertasCriticos = [];
                    if (cnhVencida)
                        alertasCriticos.push("CNH vencida — bloqueio operacional automático.");
                    if (docsEnviados.length < tiposObrigatorios.length)
                        alertas.push(`Faltam ${tiposObrigatorios.length - docsEnviados.length} documentos obrigatórios.`);
                    if (docsPendentes.length > 0)
                        alertas.push(`${docsPendentes.length} documento(s) aguardando análise.`);
                    if (docsRecusados.length > 0)
                        alertas.push(`${docsRecusados.length} documento(s) recusado(s).`);
                    if (docsCorrecao.length > 0)
                        alertas.push(`${docsCorrecao.length} documento(s) aguardando correção.`);
                    if (!detalhe.veiculo)
                        alertas.push("Nenhum veículo vinculado ao motorista.");
                    else if (detalhe.veiculo.status_aprovacao !== 'aprovado')
                        alertas.push("O veículo vinculado ainda não está aprovado.");
                    if (alertas.length === 0 && alertasCriticos.length === 0)
                        return null;
                    return (<div className="space-y-3">
                          {alertasCriticos.length > 0 && (<div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-2">
                              <div className="flex items-center gap-2 text-red-500 font-bold text-sm uppercase tracking-wider">
                                <AlertTriangle className="h-4 w-4"/>
                                Bloqueio Operacional
                              </div>
                              <ul className="text-xs text-red-200/70 space-y-1 list-disc list-inside">
                                {alertasCriticos.map((a, i) => <li key={i}>{a}</li>)}
                              </ul>
                            </div>)}
                          
                          {alertas.length > 0 && (<div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 space-y-2">
                              <div className="flex items-center gap-2 text-amber-500 font-bold text-sm uppercase tracking-wider">
                                <AlertTriangle className="h-4 w-4"/>
                                Atenção para Aprovação Final
                              </div>
                              <ul className="text-xs text-amber-200/70 space-y-1 list-disc list-inside">
                                {alertas.map((a, i) => <li key={i}>{a}</li>)}
                              </ul>
                            </div>)}
                        </div>);
                })()}
                  </section>)}

                <Separator className="bg-white/10"/>

                {/* Documentos Enviados */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-volt font-semibold">
                      <FileText className="h-4 w-4"/>
                      <span>Documentos Enviados</span>
                    </div>
                    {detalhe && (<span className="text-[10px] text-gray-500 uppercase tracking-widest">
                        {detalhe.documentos.length} de 6 Enviados
                      </span>)}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {['identidade', 'cnh', 'comprovante_residencia', 'crlv', 'foto_veiculo', 'foto_placa'].map((tipo) => {
                const doc = detalhe.documentos.find((d) => d.tipo_documento === tipo);
                return (<Card key={tipo} className="bg-white/5 border-white/10 text-white overflow-hidden">
                          <CardContent className="p-0">
                            <div className="p-4 flex items-center justify-between">
                              <div className="space-y-1">
                                <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                  {tipo.replace('_', ' ')}
                                </div>
                                <div className="flex items-center gap-2">
                                  {doc ? (<div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        {tipo === 'cnh' && detalhe.motorista.cnh_validade && detalhe.motorista.cnh_validade < getHojeBR() ? (<Badge variant="destructive" className="bg-red-600 text-white border-red-500/50">
                                            VENCIDA — BLOQUEIO AUTOMÁTICO
                                          </Badge>) : (<Badge variant="outline" className={doc.status_analise === 'aprovado' ? 'text-green-400 border-green-400/30' :
                                doc.status_analise === 'recusado' ? 'text-red-400 border-red-400/30' :
                                    doc.status_analise === 'correcao_solicitada' ? 'text-amber-500 border-amber-500/30' :
                                        'text-amber-400 border-amber-400/30'}>
                                            {doc.status_analise === 'correcao_solicitada' ? 'CORREÇÃO SOLICITADA' : doc.status_analise.toUpperCase()}
                                          </Badge>)}
                                        <span className="text-[10px] text-gray-500 italic">
                                          {new Date(doc.data_envio).toLocaleDateString('pt-BR')}
                                        </span>
                                      </div>
                                      {tipo === 'cnh' && detalhe.motorista.cnh_validade && detalhe.motorista.cnh_validade < getHojeBR() && doc.status_analise === 'aprovado' && (<div className="text-[9px] text-gray-500 italic">
                                          Foto analisada anteriormente: APROVADA
                                        </div>)}
                                    </div>) : (<span className="text-xs text-gray-500 italic flex items-center gap-1">
                                      <XCircle className="h-3 w-3"/> Não enviado
                                    </span>)}
                                </div>
                              </div>
                              {doc && (<div className="flex items-center gap-2">
                                  <Button variant="outline" size="sm" className="border-white/10 hover:bg-volt hover:text-black transition-colors" disabled={loadingFile === doc.id} onClick={() => handleViewDoc(doc.id)}>
                                    {loadingFile === doc.id ? (<Clock className="h-4 w-4 animate-spin"/>) : (<>
                                        <Eye className="h-4 w-4 mr-1"/>
                                        Ver
                                      </>)}
                                  </Button>
                                  <Button variant="outline" size="sm" className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-xs" onClick={() => setReviewingDoc(doc)}>
                                    Revisar
                                    <ChevronRight className="h-4 w-4 ml-1"/>
                                  </Button>
                                </div>)}
                            </div>
                            
                             {doc?.motivo_recusa && (<div className="px-4 pb-4">
                                 <div className={`text-[10px] ${doc.status_analise === 'correcao_solicitada' ? 'text-amber-400 bg-amber-400/5 border-amber-400/10' : 'text-red-400 bg-red-400/5 border-red-400/10'} p-2 rounded border`}>
                                   <strong>{doc.status_analise === 'correcao_solicitada' ? 'CORREÇÃO' : 'RECUSA'}:</strong> {doc.motivo_recusa}
                                 </div>
                               </div>)}

                            {reviewingDoc?.id === doc?.id && (<div className="bg-black/20 p-4 border-t border-white/5 space-y-4">
                                <div className="text-xs font-semibold uppercase text-volt">Revisar Documento</div>
                                <div className="space-y-2">
                                  <label className="text-[10px] text-gray-400 uppercase">Justificativa da decisão:</label>
                                  <Textarea className="bg-white/5 border-white/10 text-white text-xs min-h-[60px]" value={justificativaDoc} onChange={(e) => setJustificativaDoc(e.target.value)} placeholder="Ex: Imagem ilegível, documento vencido..."/>
                                </div>
                                <div className="flex gap-2">
                                  <div className="flex-1 flex flex-col gap-1">
                                    <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 h-8 text-xs" disabled={!!(reviewingDoc.tipo_documento === 'cnh' && detalhe.motorista.cnh_validade && detalhe.motorista.cnh_validade < getHojeBR())} onClick={() => handleDocAction('aprovado')}>
                                      Aprovar
                                    </Button>
                                    {reviewingDoc.tipo_documento === 'cnh' && detalhe.motorista.cnh_validade && detalhe.motorista.cnh_validade < getHojeBR() && (<span className="text-[9px] text-red-400 text-center">
                                        Atualização da CNH necessária antes da aprovação.
                                      </span>)}
                                  </div>
                                   <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs" disabled={!justificativaDoc} onClick={() => handleDocAction('recusado')}>
                                     Recusar
                                   </Button>
                                   {reviewingDoc.tipo_documento === 'cnh' && (<Button size="sm" className="flex-1 bg-amber-600 hover:bg-amber-700 h-8 text-xs" disabled={!justificativaDoc} onClick={() => handleDocAction('correcao_solicitada')}>
                                       Solicitar correção
                                     </Button>)}
                                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setReviewingDoc(null)}>
                                    Cancelar
                                  </Button>
                                </div>
                              </div>)}
                          </CardContent>
                        </Card>);
            })}
                  </div>
                </section>

                <Separator className="bg-white/10"/>

                {/* Histórico */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-volt font-semibold">
                    <History className="h-4 w-4"/>
                    <span>Histórico de Auditoria</span>
                  </div>
                  <div className="space-y-3">
                    {detalhe.logs && detalhe.logs.length > 0 ? detalhe.logs.map((log) => (<div key={log.id} className="text-xs bg-white/5 p-3 rounded border border-white/5 space-y-1">
                        <div className="flex justify-between">
                          <span className="font-bold text-volt uppercase">{log.acao.replace('_', ' ')}</span>
                          <span className="text-gray-500">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                        {log.justificativa && (<div className="text-gray-400 italic">"{log.justificativa}"</div>)}
                        {log.estado_anterior && log.estado_novo && (<div className="flex items-center gap-1 text-[10px]">
                            <span className="text-gray-500">{JSON.stringify(log.estado_anterior)}</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-volt">{JSON.stringify(log.estado_novo)}</span>
                          </div>)}
                      </div>)) : (<div className="text-sm text-gray-400 italic">Nenhum evento registrado.</div>)}
                  </div>
                </section>
              </div>) : (<div className="flex flex-col items-center justify-center py-12 space-y-4 text-red-400">
                <XCircle className="h-8 w-8"/>
                <p>Erro ao carregar os dados ou motorista não encontrado.</p>
              </div>)}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Visualizador de Arquivos (Imagens) */}
      <Dialog open={!!isViewingFile} onOpenChange={() => setIsViewingFile(null)}>
        <DialogContent className="bg-black/95 border-white/10 text-white max-w-4xl p-0 overflow-hidden">
          <div className="relative w-full h-[80vh] flex items-center justify-center">
            <Button variant="ghost" size="icon" className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/80 rounded-full" onClick={() => setIsViewingFile(null)}>
              <XCircle className="h-6 w-6"/>
            </Button>
            
            <div className="absolute top-4 left-4 z-50 bg-black/50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest text-volt">
              {isViewingFile?.type.replace('_', ' ')}
            </div>

            {isViewingFile?.url && (<img src={isViewingFile.url} alt="Documento" className="max-w-full max-h-full object-contain"/>)}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2">
              <Button variant="outline" size="sm" className="bg-black/50 border-white/10" onClick={() => window.open(isViewingFile?.url, '_blank')}>
                <Maximize2 className="h-4 w-4 mr-2"/>
                Abrir em nova aba
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>);
}
