import { createFileRoute, redirect } from '@tanstack/react-router';
import { useServerFn, useSuspenseQuery } from '@tanstack/react-start';
import { getVeiculosAdmin, updateStatusVeiculo } from '@/lib/admin.functions';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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

  const queryClient = useQueryClient();
  const updateStatusFn = useServerFn(updateStatusVeiculo);

  const { data: veiculos } = useSuspenseQuery(veiculosOptions);

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
                    'bg-red-500/20 text-red-500'
                  }`}>
                    {veiculo.status_aprovacao}
                  </span>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedVeiculo} onOpenChange={() => setSelectedVeiculo(null)}>
        <DialogContent className="bg-zuvvi-indigo border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Confirmar Ação: {actionType === 'aprovado' ? 'Aprovar' : 'Recusar'}</DialogTitle>
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
                  placeholder="Informe o motivo da recusa..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedVeiculo(null)}>Cancelar</Button>
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
