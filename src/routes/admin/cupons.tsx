import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery, useQueryClient, queryOptions } from '@tanstack/react-query';
import { listarCuponsAdmin, criarCupomAdmin, atualizarStatusCupomAdmin } from '@/lib/cupons.functions';
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
import { Tag, Plus, Loader2, Power } from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminBottomNav } from '@/components/admin/AdminBottomNav';

const cuponsQueryOptions = queryOptions({
  queryKey: ['admin-cupons'],
  queryFn: () => listarCuponsAdmin(),
});

export const Route = createFileRoute('/admin/cupons')({
  component: CuponsAdmin,
});

const formInicial = {
  codigo: '',
  tipoDesconto: 'percentual' as 'percentual' | 'fixo',
  valor: '',
  valorMaximoDesconto: '',
  valorMinimoCorrida: '',
  limiteUsoTotal: '',
  limiteUsoPorUsuario: '1',
  descricao: '',
  validoAte: '',
};

function CuponsAdmin() {
  const [criarAberto, setCriarAberto] = useState(false);
  const [form, setForm] = useState(formInicial);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryClient = useQueryClient();
  const criarCupomFn = useServerFn(criarCupomAdmin);
  const atualizarStatusFn = useServerFn(atualizarStatusCupomAdmin);

  const { data: cupons } = useSuspenseQuery(cuponsQueryOptions);

  const handleCriarCupom = async () => {
    if (!form.codigo.trim() || !form.valor) return;
    setIsSubmitting(true);
    try {
      await criarCupomFn({
        data: {
          codigo: form.codigo.trim(),
          tipoDesconto: form.tipoDesconto,
          valor: Number(form.valor),
          ...(form.valorMaximoDesconto ? { valorMaximoDesconto: Number(form.valorMaximoDesconto) } : {}),
          ...(form.valorMinimoCorrida ? { valorMinimoCorrida: Number(form.valorMinimoCorrida) } : {}),
          ...(form.limiteUsoTotal ? { limiteUsoTotal: Number(form.limiteUsoTotal) } : {}),
          limiteUsoPorUsuario: Number(form.limiteUsoPorUsuario || 1),
          ...(form.descricao.trim() ? { descricao: form.descricao.trim() } : {}),
          ...(form.validoAte ? { validoAte: new Date(form.validoAte).toISOString() } : {}),
        },
      });
      toast.success(`Cupom ${form.codigo.trim().toUpperCase()} criado!`);
      queryClient.invalidateQueries({ queryKey: ['admin-cupons'] });
      setCriarAberto(false);
      setForm(formInicial);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar cupom.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleAtivo = async (cupomId: string, ativo: boolean) => {
    try {
      await atualizarStatusFn({ data: { cupomId, ativo } });
      toast.success(ativo ? 'Cupom ativado.' : 'Cupom desativado.');
      queryClient.invalidateQueries({ queryKey: ['admin-cupons'] });
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar cupom.');
    }
  };

  const formatDesconto = (c: (typeof cupons)[number]) =>
    c.tipoDesconto === 'percentual' ? `${c.valor}%` : `R$ ${c.valor.toFixed(2)}`;

  return (
    <div className="min-h-screen bg-zuvvi-indigo text-white flex flex-col">
      <AdminHeader />
      <AdminBottomNav />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Tag className="w-8 h-8 text-volt" />
            Cupons de Desconto
          </h1>
          <Button
            className="bg-volt text-black hover:bg-volt/90 font-bold"
            onClick={() => setCriarAberto(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo cupom
          </Button>
        </div>

        <div className="rounded-md border border-white/10 bg-zuvvi-indigo/50 overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="hover:bg-transparent border-white/10">
                <TableHead className="text-gray-400">Código</TableHead>
                <TableHead className="text-gray-400">Desconto</TableHead>
                <TableHead className="text-gray-400">Mín. corrida</TableHead>
                <TableHead className="text-gray-400">Usos</TableHead>
                <TableHead className="text-gray-400">Validade</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400 text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cupons.map((c) => (
                <TableRow key={c.id} className="border-white/10 hover:bg-white/5 transition-colors">
                  <TableCell className="font-bold">{c.codigo}</TableCell>
                  <TableCell>
                    {formatDesconto(c)}
                    {c.valorMaximoDesconto != null && (
                      <span className="text-white/40 text-xs"> (até R$ {c.valorMaximoDesconto.toFixed(2)})</span>
                    )}
                  </TableCell>
                  <TableCell>{c.valorMinimoCorrida != null ? `R$ ${c.valorMinimoCorrida.toFixed(2)}` : '—'}</TableCell>
                  <TableCell>
                    {c.totalUsos}
                    {c.limiteUsoTotal != null ? ` / ${c.limiteUsoTotal}` : ''}
                    <span className="text-white/40 text-xs"> · {c.limiteUsoPorUsuario}/usuário</span>
                  </TableCell>
                  <TableCell className="text-xs text-white/60">
                    {c.validoAte ? new Date(c.validoAte).toLocaleDateString('pt-BR') : 'Sem prazo'}
                  </TableCell>
                  <TableCell>
                    {c.ativo ? (
                      <Badge className="bg-green-500 hover:bg-green-600">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/20 text-gray-300 hover:text-white hover:bg-white/10 h-8 px-3"
                      onClick={() => handleToggleAtivo(c.id, !c.ativo)}
                    >
                      <Power className="w-3.5 h-3.5 mr-1.5" />
                      {c.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {cupons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-gray-500">
                    Nenhum cupom cadastrado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={criarAberto} onOpenChange={(open) => !isSubmitting && setCriarAberto(open)}>
        <DialogContent className="bg-zuvvi-indigo border-white/10 text-white max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-volt" />
              Novo cupom de desconto
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              O desconto sempre sai da comissão da Zuvvi, nunca do repasse do motorista.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2 space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase">Código</label>
              <Input
                placeholder="Ex: BEMVINDO10"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                className="bg-white/5 border-white/10 text-white uppercase"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase">Tipo</label>
              <Select
                value={form.tipoDesconto}
                onValueChange={(val) => setForm({ ...form, tipoDesconto: val as 'percentual' | 'fixo' })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zuvvi-indigo border-white/10 text-white">
                  <SelectItem value="percentual">Percentual</SelectItem>
                  <SelectItem value="fixo">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase">
                Valor {form.tipoDesconto === 'percentual' ? '(%)' : '(R$)'}
              </label>
              <Input
                type="number"
                step="0.01"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase">Teto de desconto (R$, opcional)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="Sem teto"
                value={form.valorMaximoDesconto}
                onChange={(e) => setForm({ ...form, valorMaximoDesconto: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase">Corrida mínima (R$, opcional)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="Sem mínimo"
                value={form.valorMinimoCorrida}
                onChange={(e) => setForm({ ...form, valorMinimoCorrida: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase">Limite total de usos (opcional)</label>
              <Input
                type="number"
                placeholder="Ilimitado"
                value={form.limiteUsoTotal}
                onChange={(e) => setForm({ ...form, limiteUsoTotal: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase">Limite por usuário</label>
              <Input
                type="number"
                min={1}
                value={form.limiteUsoPorUsuario}
                onChange={(e) => setForm({ ...form, limiteUsoPorUsuario: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase">Válido até (opcional)</label>
              <Input
                type="datetime-local"
                value={form.validoAte}
                onChange={(e) => setForm({ ...form, validoAte: e.target.value })}
                className="bg-white/5 border-white/10 text-white [color-scheme:dark]"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <label className="text-xs font-medium text-gray-400 uppercase">Descrição interna (opcional)</label>
              <Textarea
                placeholder="Só pra referência da equipe — não aparece pro passageiro."
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className="bg-white/5 border-white/10 text-white min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCriarAberto(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleCriarCupom}
              disabled={!form.codigo.trim() || !form.valor || isSubmitting}
              className="bg-volt text-black hover:bg-volt/80"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Criar cupom
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
