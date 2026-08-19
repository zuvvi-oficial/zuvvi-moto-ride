import { createFileRoute, redirect } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';

import { getVeiculosAdmin, updateStatusVeiculo, getVeiculoDetalheAdmin, updateDadosVeiculo } from '@/lib/admin.functions';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, Clock, User, FileText, Bike, History, ExternalLink, MapPin, CheckCircle, XCircle, AlertTriangle, Settings2 } from 'lucide-react';


const veiculosOptions = queryOptions({
  queryKey: ['admin-veiculos'],
  queryFn: () => getVeiculosAdmin(),
});

export const Route = createFileRoute('/admin/veiculos')({
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(veiculosOptions);
    } catch (e) {
      throw redirect({ to: '/' });
    }
  },
  component: AdminVeiculos,
});

function AdminVeiculos() {
  const [selectedVeiculo, setSelectedVeiculo] = useState<any>(null);
  const [justificativa, setJustificativa] = useState('');
  const [actionType, setActionType] = useState<'aprovado' | 'recusado' | 'suspenso' | null>(null);
  const [viewingVeiculoId, setViewingVeiculoId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const updateStatusFn = useServerFn(updateStatusVeiculo);
  const getDetalheFn = useServerFn(getVeiculoDetalheAdmin);
  const updateDadosFn = useServerFn(updateDadosVeiculo);

  // Estados locais para edição no Sheet
  const [editData, setEditData] = useState<any>({
    placa: '',
    marca: '',
    modelo: '',
    ano: '',
    cor: '',
  });

  const { data: veiculos } = useSuspenseQuery(veiculosOptions);

  const { data: detalhe, isLoading: loadingDetalhe } = useQuery({
    queryKey: ['admin-veiculo-detalhe', viewingVeiculoId],
    queryFn: () => getDetalheFn({ data: { veiculoId: viewingVeiculoId! } }),
    enabled: !!viewingVeiculoId,
  });

  // Sincronizar dados de edição quando o detalhe carregar
  useEffect(() => {
    if (detalhe?.veiculo) {
      setEditData({
        placa: detalhe.veiculo.placa || '',
        marca: detalhe.veiculo.marca || '',
        modelo: detalhe.veiculo.modelo || '',
        ano: detalhe.veiculo.ano || '',
        cor: detalhe.veiculo.cor || '',
      });
    }
  }, [detalhe]);

  const handleUpdateCampo = async (campo: string) => {
    if (!viewingVeiculoId) return;
    
    try {
      const valor = campo === 'ano' ? Number(editData[campo]) : editData[campo];
      await updateDadosFn({
        data: {
          veiculoId: viewingVeiculoId,
          [campo]: valor,
        }
      });
      toast.success(`Campo ${campo} atualizado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['admin-veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['admin-veiculo-detalhe', viewingVeiculoId] });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAction = async () => {
    if (!selectedVeiculo || !actionType) return;
    
    try {
      await updateStatusFn({
        data: {
          veiculoId: selectedVeiculo.id,
          novoStatus: actionType,
          justificativa: justificativa || undefined,
        }
      });
      
      toast.success(`Veículo ${actionType} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['admin-veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setSelectedVeiculo(null);
      setJustificativa('');
      setActionType(null);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-zuvvi-indigo min-h-screen text-white">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Veículos</h1>
        <Button variant="outline" onClick={() => window.history.back()}>Voltar</Button>
      </div>

      <div className="rounded-md border border-white/10">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-white/5">
              <TableHead className="text-gray-400">Motorista</TableHead>
              <TableHead className="text-gray-400">Veículo</TableHead>
              <TableHead className="text-gray-400">Placa</TableHead>
              <TableHead className="text-gray-400">Cidade</TableHead>
              <TableHead className="text-gray-400">Status</TableHead>
              <TableHead className="text-gray-400 text-center">Detalhes</TableHead>
              <TableHead className="text-gray-400 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {veiculos?.map((veiculo: any) => (
              <TableRow key={veiculo.id} className="border-white/10 hover:bg-white/5">
                <TableCell className="font-medium">
                  {veiculo.usuarios?.nome}
                  <div className="text-xs text-gray-400">{veiculo.usuarios?.email}</div>
                </TableCell>
                <TableCell>
                  {veiculo.marca} {veiculo.modelo}
                  <div className="text-xs text-gray-400">{veiculo.ano} • {veiculo.cor}</div>
                </TableCell>
                <TableCell>{veiculo.placa}</TableCell>
                <TableCell>{veiculo.usuarios?.cidades?.nome}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    veiculo.status_aprovacao === 'aprovado' ? 'bg-green-500/20 text-green-500' :
                    veiculo.status_aprovacao === 'em_preenchimento' ? 'bg-amber-500/20 text-amber-500' :
                    veiculo.status_aprovacao === 'em_analise' ? 'bg-sky-400/20 text-sky-400' :
                    veiculo.status_aprovacao === 'suspenso' ? 'bg-orange-500/20 text-orange-500' :
                    'bg-red-500/20 text-red-500'
                  }`}>
                    {veiculo.status_aprovacao}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-white/10 text-volt"
                          onClick={() => setViewingVeiculoId(veiculo.id)}
                        >
                          <Eye className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Ver detalhes</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {veiculo.status_aprovacao !== 'aprovado' && (
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        setSelectedVeiculo(veiculo);
                        setActionType('aprovado');
                      }}
                    >
                      Aprovar
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => {
                      setSelectedVeiculo(veiculo);
                      setActionType('recusado');
                    }}
                  >
                    Recusar
                  </Button>
                  {veiculo.status_aprovacao === 'aprovado' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="border-orange-500 text-orange-500 hover:bg-orange-500/10"
                      onClick={() => {
                        setSelectedVeiculo(veiculo);
                        setActionType('suspenso');
                      }}
                    >
                      Suspender
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedVeiculo} onOpenChange={() => setSelectedVeiculo(null)}>
        <DialogContent className="bg-zuvvi-indigo border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Confirmar Ação: {actionType === 'aprovado' ? 'Aprovar' : actionType === 'suspenso' ? 'Suspender' : 'Recusar'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-400">
              Deseja realmente {actionType} o veículo <strong>{selectedVeiculo?.placa}</strong> de <strong>{selectedVeiculo?.usuarios?.nome}</strong>?
            </p>
            {actionType !== 'aprovado' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Justificativa (obrigatória):</label>
                <Textarea 
                  className="bg-white/5 border-white/10 text-white"
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder={actionType === 'suspenso' ? "Informe o motivo da suspensão..." : "Informe o motivo da recusa..."}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedVeiculo(null)}>Cancelar</Button>
            <Button 
              className={actionType === 'aprovado' ? "bg-green-600 hover:bg-green-700" : actionType === 'suspenso' ? "bg-orange-600 hover:bg-orange-700" : "bg-red-600 hover:bg-red-700"}
              disabled={actionType !== 'aprovado' && !justificativa}
              onClick={handleAction}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!viewingVeiculoId} onOpenChange={(open) => !open && setViewingVeiculoId(null)}>
        <SheetContent side="right" className="sm:max-w-2xl bg-zuvvi-indigo border-white/10 text-white p-0">
          <SheetHeader className="p-6 border-b border-white/10">
            <SheetTitle className="text-white flex items-center gap-2">
              <Bike className="h-5 w-5 text-volt" />
              Ficha do Veículo
            </SheetTitle>
            <SheetDescription className="text-gray-400">
              Informações técnicas e proprietário.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-8rem)] p-6">
            {loadingDetalhe ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Clock className="h-8 w-8 text-volt animate-spin" />
                <p>Carregando dados...</p>
              </div>
            ) : detalhe ? (
              <div className="space-y-8 pb-12">
                {/* Resumo do Veículo */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-volt font-semibold">
                    <Bike className="h-4 w-4" />
                    <span>Dados do Veículo</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-white/5 border-white/10 text-white">
                      <CardContent className="pt-6">
                        <div className="text-xs text-gray-400">Placa</div>
                        <div className="mt-1 font-mono text-xl text-volt">{detalhe.veiculo.placa}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/5 border-white/10 text-white">
                      <CardContent className="pt-6">
                        <div className="text-xs text-gray-400">Status</div>
                        <div className="mt-1">
                          <Badge className={
                            detalhe.veiculo.status_aprovacao === 'aprovado' ? 'bg-green-500/20 text-green-500 border-green-500/50' :
                            detalhe.veiculo.status_aprovacao === 'em_analise' ? 'bg-sky-400/20 text-sky-400 border-sky-400/50' :
                            detalhe.veiculo.status_aprovacao === 'suspenso' ? 'bg-orange-500/20 text-orange-500 border-orange-500/50' :
                            'bg-amber-500/20 text-amber-500 border-amber-500/50'
                          }>
                            {detalhe.veiculo.status_aprovacao.toUpperCase()}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                    <div className="col-span-2 grid grid-cols-3 gap-4">
                      <div className="bg-white/5 p-3 rounded border border-white/5">
                        <div className="text-[10px] text-gray-400 uppercase">Marca</div>
                        <div className="font-medium">{detalhe.veiculo.marca}</div>
                      </div>
                      <div className="bg-white/5 p-3 rounded border border-white/5">
                        <div className="text-[10px] text-gray-400 uppercase">Modelo</div>
                        <div className="font-medium">{detalhe.veiculo.modelo}</div>
                      </div>
                      <div className="bg-white/5 p-3 rounded border border-white/5">
                        <div className="text-[10px] text-gray-400 uppercase">Ano/Cor</div>
                        <div className="font-medium">{detalhe.veiculo.ano} • {detalhe.veiculo.cor}</div>
                      </div>
                    </div>
                  </div>
                </section>

                <Separator className="bg-white/10" />

                {/* Edição de Dados do Veículo */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-volt font-semibold">
                    <Settings2 className="h-4 w-4" />
                    <span>Editar Dados do Veículo</span>
                  </div>
                  
                  {['recusado', 'suspenso'].includes(detalhe.veiculo.status_aprovacao) && (
                    <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-md flex gap-2 items-center text-orange-500 text-xs">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Edição desabilitada pois o veículo está {detalhe.veiculo.status_aprovacao}.
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4">
                    {[
                      { id: 'placa', label: 'Placa', type: 'text' },
                      { id: 'marca', label: 'Marca', type: 'text' },
                      { id: 'modelo', label: 'Modelo', type: 'text' },
                      { id: 'ano', label: 'Ano', type: 'number' },
                      { id: 'cor', label: 'Cor', type: 'text' },
                    ].map((field) => (
                      <div key={field.id} className="space-y-1.5">
                        <Label htmlFor={field.id} className="text-xs text-gray-400 uppercase">{field.label}</Label>
                        <div className="flex gap-2">
                          <Input
                            id={field.id}
                            type={field.type}
                            className="bg-white/5 border-white/10 text-white flex-1"
                            value={editData[field.id]}
                            onChange={(e) => setEditData({ ...editData, [field.id]: e.target.value })}
                            disabled={['recusado', 'suspenso'].includes(detalhe.veiculo.status_aprovacao)}
                          />
                          <Button 
                            size="icon" 
                            variant="secondary"
                            className="bg-volt text-black hover:bg-volt/80 shrink-0"
                            onClick={() => handleUpdateCampo(field.id)}
                            disabled={['recusado', 'suspenso'].includes(detalhe.veiculo.status_aprovacao) || editData[field.id] === (detalhe.veiculo as any)[field.id]}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <Separator className="bg-white/10" />

                {/* Proprietário */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-volt font-semibold">
                    <User className="h-4 w-4" />
                    <span>Proprietário</span>
                  </div>
                  {detalhe.veiculo.motoristas ? (
                    <div className="bg-white/5 p-4 rounded border border-white/10 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-lg">{detalhe.veiculo.motoristas.usuarios.nome}</div>
                          <div className="text-sm text-gray-400">{detalhe.veiculo.motoristas.usuarios.email}</div>
                          <div className="text-sm text-gray-400">{detalhe.veiculo.motoristas.usuarios.celular}</div>
                        </div>
                        <Badge variant="outline" className={
                          detalhe.veiculo.motoristas.status_aprovacao === 'aprovado' ? 'text-green-500 border-green-500/30' : 'text-amber-500 border-amber-500/30'
                        }>
                          Motorista {detalhe.veiculo.motoristas.status_aprovacao}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-400">
                        <MapPin className="h-3 w-3" />
                        {detalhe.veiculo.motoristas.usuarios.cidades?.nome}/{detalhe.veiculo.motoristas.usuarios.cidades?.estado_uf}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 italic">Nenhum motorista vinculado.</div>
                  )}
                </section>

                <Separator className="bg-white/10" />

                {/* Documentos do Veículo */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-volt font-semibold">
                    <FileText className="h-4 w-4" />
                    <span>Documentos do Veículo</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {['crlv', 'foto_veiculo', 'foto_placa'].map((tipo) => {
                      const doc = detalhe.documentos.find((d: any) => d.tipo_documento === tipo);
                      return (
                        <Card key={tipo} className="bg-white/5 border-white/10 text-white">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                {tipo.replace('_', ' ')}
                              </div>
                              <div className="flex items-center gap-2">
                                {doc ? (
                                  <>
                                    <Badge variant="outline" className={
                                      doc.status_analise === 'aprovado' ? 'text-green-500 border-green-500/30' :
                                      doc.status_analise === 'recusado' ? 'text-red-500 border-red-500/30' :
                                      'text-amber-500 border-amber-500/30'
                                    }>
                                      {doc.status_analise.toUpperCase()}
                                    </Badge>
                                    <span className="text-[10px] text-gray-500 italic">
                                      Enviado em {new Date(doc.data_envio).toLocaleDateString('pt-BR')}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-500 italic">Não enviado</span>
                                )}
                              </div>
                            </div>
                            {doc?.publicUrl && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="border-white/20 hover:bg-white/10"
                                onClick={() => {
                                  if (doc.publicUrl) {
                                    window.open(doc.publicUrl, '_blank');
                                  }
                                }}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Ver
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>

                <Separator className="bg-white/10" />

                {/* Histórico */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-volt font-semibold">
                    <History className="h-4 w-4" />
                    <span>Histórico de Auditoria</span>
                  </div>
                  <div className="space-y-3">
                    {detalhe.logs && detalhe.logs.length > 0 ? detalhe.logs.map((log: any) => (
                      <div key={log.id} className="text-xs bg-white/5 p-3 rounded border border-white/5 space-y-1">
                        <div className="flex justify-between">
                          <span className="font-bold text-volt uppercase">{log.acao.replace('_', ' ')}</span>
                          <span className="text-gray-500">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                        {log.justificativa && (
                          <div className="text-gray-400 italic">"{log.justificativa}"</div>
                        )}
                      </div>
                    )) : (
                      <div className="text-sm text-gray-400 italic">Nenhum evento registrado.</div>
                    )}
                  </div>
                </section>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 space-y-4 text-red-400">
                <XCircle className="h-8 w-8" />
                <p>Erro ao carregar os dados ou veículo não encontrado.</p>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
