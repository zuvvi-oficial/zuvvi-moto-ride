import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getResumoFinanceiroAdmin, getCidadesOperacionaisAdmin, getCorridasFinanceiroAdmin } from '@/lib/financeiro.functions';
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
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Wallet, Percent, Banknote, Receipt, MapPin, Users, Loader2, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminBottomNav } from '@/components/admin/AdminBottomNav';

function toLocalDateInputValue(date: Date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function periodoPadrao() {
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  return {
    dataInicio: toLocalDateInputValue(inicioMes),
    dataFim: toLocalDateInputValue(agora),
  };
}

// pago_at é timestamp; datas do filtro vêm do <input type="date"> como
// "AAAA-MM-DD". Achado do Codex no PR #55: sem um fuso explícito, o mesmo
// texto vira horários UTC diferentes dependendo de quem interpreta a
// string (servidor no loader vs. navegador do admin no componente), e
// admins em fusos diferentes veriam totais diferentes para o "mesmo" dia.
// Fixamos o fuso de negócio (Brasil, -03:00, sem horário de verão desde
// 2019) explicitamente na string ISO, tornando o horário absoluto
// resultante independente de onde o código roda.
const FUSO_NEGOCIO = "-03:00";

function paraIntervaloISO(dataInicio: string, dataFim: string) {
  return {
    dataInicio: new Date(`${dataInicio}T00:00:00${FUSO_NEGOCIO}`).toISOString(),
    dataFim: new Date(`${dataFim}T23:59:59.999${FUSO_NEGOCIO}`).toISOString(),
  };
}

// A chave da query usa as datas "AAAA-MM-DD" cruas, não o ISO já convertido
// — mantém a chave estável e legível; a conversão determinística (fuso
// fixo) fica isolada dentro do queryFn.
const financeiroQueryOptions = (params: { dataInicio: string; dataFim: string; cidadeId: string | undefined }) =>
  queryOptions({
    queryKey: ['admin-financeiro-resumo', params],
    queryFn: () => {
      const { dataInicio, dataFim } = paraIntervaloISO(params.dataInicio, params.dataFim);
      return getResumoFinanceiroAdmin({ data: { dataInicio, dataFim, cidadeId: params.cidadeId } });
    },
  });

const cidadesFiltroOptions = queryOptions({
  queryKey: ['admin-financeiro-cidades'],
  queryFn: () => getCidadesOperacionaisAdmin(),
});

const DRILL_LIMITE = 20;

const corridasFinanceiroQueryOptions = (params: {
  dataInicio: string;
  dataFim: string;
  cidadeId: string | undefined;
  motoristaId: string | undefined;
  pagina: number;
}) =>
  queryOptions({
    queryKey: ['admin-financeiro-corridas', params],
    queryFn: () => {
      const { dataInicio, dataFim } = paraIntervaloISO(params.dataInicio, params.dataFim);
      return getCorridasFinanceiroAdmin({
        data: {
          dataInicio,
          dataFim,
          cidadeId: params.cidadeId,
          motoristaId: params.motoristaId,
          pagina: params.pagina,
          limite: DRILL_LIMITE,
        },
      });
    },
  });

export const Route = createFileRoute('/admin/financeiro')({
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(financeiroQueryOptions({ ...periodoPadrao(), cidadeId: undefined }));
    } catch (e) {
      throw redirect({ to: '/' });
    }
  },
  component: FinanceiroAdmin,
});

function formatarMoeda(valor: number) {
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function FinanceiroAdmin() {
  const padrao = periodoPadrao();
  const [dataInicio, setDataInicio] = useState(padrao.dataInicio);
  const [dataFim, setDataFim] = useState(padrao.dataFim);
  const [cidadeId, setCidadeId] = useState<string | undefined>(undefined);

  const getCidadesFn = useServerFn(getCidadesOperacionaisAdmin);

  const { data: cidades = [] } = useQuery({
    ...cidadesFiltroOptions,
    queryFn: () => getCidadesFn(),
  });

  const params = { dataInicio, dataFim, cidadeId: cidadeId === 'all' ? undefined : cidadeId };
  const { data: resumo, isLoading, error } = useQuery(financeiroQueryOptions(params));

  const [drill, setDrill] = useState<{ tipo: 'cidade' | 'motorista'; id: string; label: string } | null>(null);
  const [drillPagina, setDrillPagina] = useState(0);

  const drillCidadeId = drill?.tipo === 'cidade' ? drill.id : params.cidadeId;
  const drillMotoristaId = drill?.tipo === 'motorista' ? drill.id : undefined;

  const { data: drillResult, isLoading: drillLoading } = useQuery({
    ...corridasFinanceiroQueryOptions({
      dataInicio,
      dataFim,
      cidadeId: drillCidadeId,
      motoristaId: drillMotoristaId,
      pagina: drillPagina,
    }),
    enabled: !!drill,
  });

  function abrirDrill(novo: { tipo: 'cidade' | 'motorista'; id: string; label: string }) {
    setDrill(novo);
    setDrillPagina(0);
  }

  const drillTotalPaginas = Math.max(1, Math.ceil((drillResult?.total || 0) / DRILL_LIMITE));

  return (
    <div className="min-h-screen bg-zuvvi-indigo text-white flex flex-col">
      <AdminHeader />
      <AdminBottomNav />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="w-8 h-8 text-volt" />
            Controle Financeiro
          </h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Data Início</label>
            <Input
              type="date"
              value={dataInicio}
              max={dataFim}
              onChange={(e) => setDataInicio(e.target.value)}
              className="bg-zuvvi-indigo border-white/10 text-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Data Fim</label>
            <Input
              type="date"
              value={dataFim}
              min={dataInicio}
              onChange={(e) => setDataFim(e.target.value)}
              className="bg-zuvvi-indigo border-white/10 text-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Cidade</label>
            <Select value={cidadeId || 'all'} onValueChange={setCidadeId}>
              <SelectTrigger className="bg-zuvvi-indigo border-white/10 text-white">
                <SelectValue placeholder="Todas as cidades" />
              </SelectTrigger>
              <SelectContent className="bg-zuvvi-indigo border-white/10 text-white">
                <SelectItem value="all">Todas as cidades</SelectItem>
                {cidades.map((cidade: any) => (
                  <SelectItem key={cidade.id} value={cidade.id}>
                    {cidade.nome} - {cidade.estado_uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-zuvvi-volt animate-spin" />
            <p className="text-sm font-medium opacity-60">Carregando resumo financeiro...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 text-red-400">
            <p className="text-sm font-medium">Erro ao carregar resumo financeiro.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  <Wallet className="w-3.5 h-3.5" />
                  Total Faturado
                </div>
                <p className="text-2xl font-black text-zuvvi-volt">{formatarMoeda(resumo?.totalGeral.totalFaturado || 0)}</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  <Percent className="w-3.5 h-3.5" />
                  Comissão Zuvvi
                </div>
                <p className="text-2xl font-black">{formatarMoeda(resumo?.totalGeral.totalComissao || 0)}</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  <Banknote className="w-3.5 h-3.5" />
                  Repasse aos Motoristas
                </div>
                <p className="text-2xl font-black">{formatarMoeda(resumo?.totalGeral.totalMotorista || 0)}</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  <Receipt className="w-3.5 h-3.5" />
                  Corridas Pagas
                </div>
                <p className="text-2xl font-black">{resumo?.totalGeral.qtdCorridas || 0}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <MapPin className="w-5 h-5 text-volt" />
                Por Cidade
              </h2>
              <div className="rounded-md border border-white/10 bg-zuvvi-indigo/50 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="hover:bg-transparent border-white/10">
                      <TableHead className="text-gray-400">Cidade</TableHead>
                      <TableHead className="text-gray-400 text-right">Faturado</TableHead>
                      <TableHead className="text-gray-400 text-right">Comissão</TableHead>
                      <TableHead className="text-gray-400 text-right">Repasse</TableHead>
                      <TableHead className="text-gray-400 text-right">Corridas</TableHead>
                      <TableHead className="text-gray-400 text-right">Detalhe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(resumo?.porCidade || []).map((cidade) => (
                      <TableRow key={cidade.cidadeId} className="border-white/10 hover:bg-white/5 transition-colors">
                        <TableCell className="font-medium">
                          {cidade.cidadeNome} - {cidade.estadoUf}
                        </TableCell>
                        <TableCell className="text-right">{formatarMoeda(cidade.totalFaturado)}</TableCell>
                        <TableCell className="text-right">{formatarMoeda(cidade.totalComissao)}</TableCell>
                        <TableCell className="text-right">{formatarMoeda(cidade.totalMotorista)}</TableCell>
                        <TableCell className="text-right">{cidade.qtdCorridas}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/20 text-gray-300 hover:text-white hover:bg-white/10 h-8 px-2"
                            aria-label={`Ver corridas de ${cidade.cidadeNome}`}
                            onClick={() =>
                              abrirDrill({ tipo: 'cidade', id: cidade.cidadeId, label: `${cidade.cidadeNome} - ${cidade.estadoUf}` })
                            }
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(resumo?.porCidade || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                          Nenhum pagamento no período selecionado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-volt" />
                Por Motorista
              </h2>
              <div className="rounded-md border border-white/10 bg-zuvvi-indigo/50 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="hover:bg-transparent border-white/10">
                      <TableHead className="text-gray-400">Motorista</TableHead>
                      <TableHead className="text-gray-400 text-right">Faturado</TableHead>
                      <TableHead className="text-gray-400 text-right">Comissão</TableHead>
                      <TableHead className="text-gray-400 text-right">Recebeu</TableHead>
                      <TableHead className="text-gray-400 text-right">Corridas</TableHead>
                      <TableHead className="text-gray-400 text-right">Detalhe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(resumo?.porMotorista || []).map((motorista) => (
                      <TableRow key={motorista.motoristaId} className="border-white/10 hover:bg-white/5 transition-colors">
                        <TableCell className="font-medium">{motorista.nome}</TableCell>
                        <TableCell className="text-right">{formatarMoeda(motorista.totalFaturado)}</TableCell>
                        <TableCell className="text-right">{formatarMoeda(motorista.totalComissao)}</TableCell>
                        <TableCell className="text-right">{formatarMoeda(motorista.totalMotorista)}</TableCell>
                        <TableCell className="text-right">{motorista.qtdCorridas}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/20 text-gray-300 hover:text-white hover:bg-white/10 h-8 px-2"
                            aria-label={`Ver corridas de ${motorista.nome}`}
                            onClick={() => abrirDrill({ tipo: 'motorista', id: motorista.motoristaId, label: motorista.nome })}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(resumo?.porMotorista || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                          Nenhum motorista com pagamentos no período selecionado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={!!drill} onOpenChange={(open) => !open && setDrill(null)}>
        <DialogContent className="bg-zuvvi-indigo border-white/10 text-white max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-volt" />
              Corridas — {drill?.label}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Mesmo período selecionado na tela
              {drill?.tipo === 'motorista' && params.cidadeId ? ' · cidade filtrada' : ''}
            </DialogDescription>
          </DialogHeader>

          {drillLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-zuvvi-volt animate-spin" />
            </div>
          ) : (
            <>
              <div className="max-h-[50vh] overflow-y-auto rounded-md border border-white/10">
                <Table>
                  <TableHeader className="bg-white/5 sticky top-0">
                    <TableRow className="hover:bg-transparent border-white/10">
                      <TableHead className="text-gray-400">Pago em</TableHead>
                      <TableHead className="text-gray-400">Passageiro</TableHead>
                      <TableHead className="text-gray-400">Motorista</TableHead>
                      <TableHead className="text-gray-400">Trajeto</TableHead>
                      <TableHead className="text-gray-400">Meio</TableHead>
                      <TableHead className="text-gray-400 text-right">Total</TableHead>
                      <TableHead className="text-gray-400 text-right">Comissão</TableHead>
                      <TableHead className="text-gray-400 text-right">Motorista</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(drillResult?.corridas || []).map((corrida) => (
                      <TableRow key={corrida.pagamentoId} className="border-white/10 hover:bg-white/5 transition-colors">
                        <TableCell className="text-xs">{new Date(corrida.pagoEm).toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-xs">{corrida.passageiroNome}</TableCell>
                        <TableCell className="text-xs">{corrida.motoristaNome}</TableCell>
                        <TableCell className="text-xs max-w-[220px] truncate">
                          {corrida.origemNome || '—'} → {corrida.destinoNome || '—'}
                        </TableCell>
                        <TableCell className="text-xs uppercase">{corrida.meio}</TableCell>
                        <TableCell className="text-right text-xs">{formatarMoeda(corrida.valorTotal)}</TableCell>
                        <TableCell className="text-right text-xs">{formatarMoeda(corrida.valorComissao)}</TableCell>
                        <TableCell className="text-right text-xs">{formatarMoeda(corrida.valorMotorista)}</TableCell>
                      </TableRow>
                    ))}
                    {(drillResult?.corridas || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-gray-500">
                          Nenhuma corrida encontrada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-gray-400">{drillResult?.total ?? 0} corrida(s) no total</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDrillPagina((p) => Math.max(0, p - 1))}
                    disabled={drillPagina === 0}
                    className="border-white/10 bg-transparent text-white hover:bg-white/5"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Anterior
                  </Button>
                  <span className="text-xs text-gray-400">
                    Página {drillPagina + 1} de {drillTotalPaginas}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDrillPagina((p) => Math.min(drillTotalPaginas - 1, p + 1))}
                    disabled={drillPagina >= drillTotalPaginas - 1}
                    className="border-white/10 bg-transparent text-white hover:bg-white/5"
                  >
                    Próxima
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
