import { createFileRoute, redirect } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';

import { getMotoristasAdmin, updateStatusMotorista, getMotoristaDetalheAdmin } from '@/lib/admin.functions';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  SheetDescription
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, CheckCircle, XCircle, Clock, MapPin, User, FileText, Bike, CreditCard, History, ExternalLink } from 'lucide-react';


const motoristasOptions = (filters: { status?: string; busca?: string }) => queryOptions({
  queryKey: ['admin-motoristas', filters],
  queryFn: () => getMotoristasAdmin({ data: filters }),
});

export const Route = createFileRoute('/admin/motoristas')({
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(motoristasOptions({}));
    } catch (e) {
      throw redirect({ to: '/' });
    }
  },
  component: AdminMotoristas,
});

function AdminMotoristas() {
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [selectedMotorista, setSelectedMotorista] = useState<any>(null);
  const [justificativa, setJustificativa] = useState('');
  const [actionType, setActionType] = useState<'aprovado' | 'recusado' | 'suspenso' | null>(null);
  const [viewingMotoristaId, setViewingMotoristaId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const updateStatusFn = useServerFn(updateStatusMotorista);
  const getDetalheFn = useServerFn(getMotoristaDetalheAdmin);

  const { data: motoristas } = useSuspenseQuery(motoristasOptions({ status, busca }));

  const { data: detalhe, isLoading: loadingDetalhe } = useQuery({
    queryKey: ['admin-motorista-detalhe', viewingMotoristaId],
    queryFn: () => getDetalheFn({ data: { motoristaId: viewingMotoristaId! } }),
    enabled: !!viewingMotoristaId,
  });

  const handleAction = async () => {
    if (!selectedMotorista || !actionType) return;
    
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
      setSelectedMotorista(null);
      setJustificativa('');
      setActionType(null);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-zuvvi-indigo min-h-screen text-white">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Motoristas</h1>
        <Button variant="outline" onClick={() => window.history.back()}>Voltar</Button>
      </div>

      <div className="flex gap-4 items-center">
        <Input 
          placeholder="Buscar por nome, email ou telefone..." 
          className="max-w-sm bg-white/5 border-white/10 text-white"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select 
          className="bg-zuvvi-indigo border border-white/10 rounded px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="em_preenchimento">Pendente</option>
          <option value="em_analise">Em Análise</option>
          <option value="aprovado">Aprovado</option>
          <option value="recusado">Recusado</option>
          <option value="suspenso">Suspenso</option>
        </select>
      </div>

      <div className="rounded-md border border-white/10">
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
            {motoristas?.map((user: any) => (
              <TableRow key={user.id} className="border-white/10 hover:bg-white/5">
                <TableCell className="font-medium">{user.nome}</TableCell>
                <TableCell>
                  <div className="text-sm">{user.email}</div>
                  <div className="text-xs text-gray-400">{user.celular}</div>
                </TableCell>
                <TableCell>{user.cidades?.nome}/{user.cidades?.estado_uf}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    user.motoristas.status_aprovacao === 'aprovado' ? 'bg-green-500/20 text-green-500' :
                    user.motoristas.status_aprovacao === 'em_analise' ? 'bg-blue-500/20 text-blue-500' :
                    'bg-amber-500/20 text-amber-500'
                  }`}>
                    {user.motoristas.status_aprovacao}
                  </span>
                </TableCell>
                <TableCell>
                  <div className={`h-2 w-2 rounded-full ${user.motoristas.is_disponivel ? 'bg-volt' : 'bg-gray-500'}`} />
                </TableCell>
                <TableCell className="text-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-white/10 text-volt"
                          onClick={() => setViewingMotoristaId(user.motoristas.id)}
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
                  {user.motoristas.status_aprovacao !== 'aprovado' && (
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        setSelectedMotorista(user);
                        setActionType('aprovado');
                      }}
                    >
                      Aprovar
                    </Button>
                  )}
                  {user.motoristas.status_aprovacao !== 'recusado' && (
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => {
                        setSelectedMotorista(user);
                        setActionType('recusado');
                      }}
                    >
                      Recusar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedMotorista} onOpenChange={() => setSelectedMotorista(null)}>
        <DialogContent className="bg-zuvvi-indigo border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Confirmar Ação: {actionType === 'aprovado' ? 'Aprovar' : 'Recusar/Suspender'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-400">
              Deseja realmente {actionType} o motorista <strong>{selectedMotorista?.nome}</strong>?
            </p>
            {actionType !== 'aprovado' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Justificativa (obrigatória):</label>
                <Textarea 
                  className="bg-white/5 border-white/10 text-white"
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Informe o motivo da recusa ou suspensão..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedMotorista(null)}>Cancelar</Button>
            <Button 
              className={actionType === 'aprovado' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
              disabled={actionType !== 'aprovado' && !justificativa}
              onClick={handleAction}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
