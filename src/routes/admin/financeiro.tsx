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
import { Wallet, Percent, Banknote, Receipt, MapPin, Users, Loader2, Eye, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminBottomNav } from '@/components/admin/AdminBottomNav';
import { toast } from 'sonner';

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

// Achado do Codex no PR #57: toLocaleString sem timeZone usa o fuso do
// navegador de quem está vendo a tela, não o fuso de negócio — um admin
// fora do -03:00 veria (e exportaria) datas/horas diferentes para o
// mesmo pagamento. Fixamos o fuso de negócio explicitamente na exibição,
// igual já fizemos no cálculo do intervalo (paraIntervaloISO).
function formatarDataHoraNegocio(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

// Etapa 4: exportação CSV, gerada no navegador a partir dos dados já
// carregados na tela — sem endpoint novo, sem lógica de agregação nova.
function exportarCSV(nomeArquivo: string, cabecalho: string[], linhas: (string | number)[][]) {
  const escapar = (valor: string | number) => {
    let texto = String(valor);
    // Achado do Codex no PR #57: nome de passageiro/motorista é texto livre
    // no cadastro, e um valor começando com =, +, - ou @ é interpretado
    // como fórmula por planilhas (Excel/Sheets) ao abrir o CSV. Prefixar
    // com aspas simples neutraliza sem alterar o valor exibido na célula.
    if (/^[=+\-@]/.test(texto)) {
      texto = `'${texto}`;
    }
    return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  // BOM (﻿) para o Excel reconhecer UTF-8 e não corromper acentos.
  const conteudo = [cabecalho, ...linhas].map((linha) => linha.map(escapar).join(',')).join('\n');
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function FinanceiroAdmin() {
  const padrao = periodoPadrao();
  const [dataInicio, setDataInicio] = useState(padrao.dataInicio);
  const [dataFim, setDataFim] = useState(padrao.dataFim);
  const [cidadeId, setCidadeId] = useState<string | undefined>(undefined);

  const getCidadesFn = useServerFn(getCidadesOperacionaisAdmin);
  const getCorridasFn = useServerFn(getCorridasFinanceiroAdmin);
  const [exportandoCorridas, setExportandoCorridas] = useState(false);

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

  function exportarPorCidadeCSV() {
    exportarCSV(
      `zuvvi-financeiro-por-cidade_${dataInicio}_${dataFim}.csv`,
      ['Cidade', 'UF', 'Faturado', 'Comissao Zuvvi', 'Repasse Motoristas', 'Corridas'],
      (resumo?.porCidade || []).map((c) => [
        c.cidadeNome,
        c.estadoUf,
        c.totalFaturado.toFixed(2),
        c.totalComissao.toFixed(2),
        c.totalMotorista.toFixed(2),
        c.qtdCorridas,
      ]),
    );
  }

  function exportarPorMotoristaCSV() {
    exportarCSV(
      `zuvvi-financeiro-por-motorista_${dataInicio}_${dataFim}.csv`,
      ['Motorista', 'Faturado', 'Comissao Zuvvi', 'Recebeu', 'Corridas'],
      (resumo?.porMotorista || []).map((m) => [
        m.nome,
        m.totalFaturado.toFixed(2),
        m.totalComissao.toFixed(2),
        m.totalMotorista.toFixed(2),
        m.qtdCorridas,
      ]),
    );
  }

  // Exporta TODAS as corridas do período/filtro atuais, não só a página
  // aberta no modal de drill-down. Achado do Codex no PR #57: paginação
  // por offset (pagina 0, 1, 2...) não é estável se um pagamento novo
  // entrar como 'pago' no meio da exportação (possível quando o período
  // inclui o dia de hoje) — como a consulta ordena por pago_at desc, a
  // linha nova empurra tudo e uma corrida pode sair duplicada e outra
  // pulada. Em vez de offset, cada página busca corridas mais antigas
  // que a última já vista (dataFim vira um cursor decrescente), então
  // uma corrida nova entra sempre acima do cursor e não afeta o que já
  // foi capturado.
  async function exportarCorridasCSV() {
    setExportandoCorridas(true);
    try {
      const { dataInicio: inicioISO, dataFim: fimISO } = paraIntervaloISO(dataInicio, dataFim);
      const TAMANHO_PAGINA = 200;
      const todas: NonNullable<typeof drillResult>['corridas'] = [];
      let cursorFim = fimISO;
      for (;;) {
        const resultado = await getCorridasFn({
          data: {
            dataInicio: inicioISO,
            dataFim: cursorFim,
            cidadeId: params.cidadeId,
            motoristaId: undefined,
            pagina: 0,
            limite: TAMANHO_PAGINA,
          },
        });
        todas.push(...resultado.corridas);
        if (resultado.corridas.length < TAMANHO_PAGINA) break;

        const ultimaLinha = resultado.corridas[resultado.corridas.length - 1];
        if (!ultimaLinha) break;
        const novoCursor = new Date(new Date(ultimaLinha.pagoEm).getTime() - 1).toISOString();
        if (novoCursor >= cursorFim) break;
        cursorFim = novoCursor;
      }

      if (todas.length === 0) {
        toast.info('Nenhuma corrida encontrada no período selecionado.');
        return;
      }

      exportarCSV(
        `zuvvi-financeiro-corridas_${dataInicio}_${dataFim}.csv`,
        ['Pago em', 'Passageiro', 'Motorista', 'Origem', 'Destino', 'Meio', 'Valor Total', 'Comissao', 'Valor Motorista'],
        todas.map((c) => [
          formatarDataHoraNegocio(c.pagoEm),
          c.passageiroNome,
          c.motoristaNome,
          c.origemNome ?? '',
          c.destinoNome ?? '',
          c.meio,
          c.valorTotal.toFixed(2),
          c.valorComissao.toFixed(2),
          c.valorMotorista.toFixed(2),
        ]),
      );
    } catch (e) {
      console.error('Erro ao exportar corridas:', e);
      toast.error('Erro ao exportar corridas.');
    } finally {
      setExportandoCorridas(false);
    }
  }

  return (
    <div className="min-h-screen bg-zuvvi-indigo text-white flex flex-col">
      <AdminHeader />
      <AdminBottomNav />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-6">
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="w-8 h-8 text-volt" />
            Controle Financeiro
          </h1>
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 text-gray-300 hover:text-white hover:bg-white/10"
            onClick={exportarCorridasCSV}
            disabled={exportandoCorridas}
          >
            {exportandoCorridas ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Exportar corridas (CSV)
          </Button>
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
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-volt" />
                  Por Cidade
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20 text-gray-300 hover:text-white hover:bg-white/10 h-8"
                  onClick={exportarPorCidadeCSV}
                  disabled={(resumo?.porCidade || []).length === 0}
                >
                  <Download className="w-3.5 h-3.5 mr-2" />
                  Exportar CSV
                </Button>
              </div>
              <div className="hidden md:block rounded-md border border-white/10 bg-zuvvi-indigo/50 overflow-x-auto">
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

              <div className="md:hidden space-y-3">
                {(resumo?.porCidade || []).map((cidade) => (
                  <div key={cidade.cidadeId} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm">
                        {cidade.cidadeNome} - {cidade.estadoUf}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/20 text-gray-300 hover:text-white hover:bg-white/10 h-8 px-2 shrink-0"
                        aria-label={`Ver corridas de ${cidade.cidadeNome}`}
                        onClick={() =>
                          abrirDrill({ tipo: 'cidade', id: cidade.cidadeId, label: `${cidade.cidadeNome} - ${cidade.estadoUf}` })
                        }
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div>
                        <p className="text-[9px] uppercase font-bold tracking-widest text-white/30">Faturado</p>
                        <p className="text-sm font-bold">{formatarMoeda(cidade.totalFaturado)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold tracking-widest text-white/30">Comissão</p>
                        <p className="text-sm font-bold">{formatarMoeda(cidade.totalComissao)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold tracking-widest text-white/30">Repasse</p>
                        <p className="text-sm font-bold">{formatarMoeda(cidade.totalMotorista)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold tracking-widest text-white/30">Corridas</p>
                        <p className="text-sm font-bold">{cidade.qtdCorridas}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {(resumo?.porCidade || []).length === 0 && (
                  <p className="text-center py-10 text-gray-500 text-sm">Nenhum pagamento no período selecionado.</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-volt" />
                  Por Motorista
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20 text-gray-300 hover:text-white hover:bg-white/10 h-8"
                  onClick={exportarPorMotoristaCSV}
                  disabled={(resumo?.porMotorista || []).length === 0}
                >
                  <Download className="w-3.5 h-3.5 mr-2" />
                  Exportar CSV
                </Button>
              </div>
              <div className="hidden md:block rounded-md border border-white/10 bg-zuvvi-indigo/50 overflow-x-auto">
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

              <div className="md:hidden space-y-3">
                {(resumo?.porMotorista || []).map((motorista) => (
                  <div key={motorista.motoristaId} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm">{motorista.nome}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/20 text-gray-300 hover:text-white hover:bg-white/10 h-8 px-2 shrink-0"
                        aria-label={`Ver corridas de ${motorista.nome}`}
                        onClick={() => abrirDrill({ tipo: 'motorista', id: motorista.motoristaId, label: motorista.nome })}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div>
                        <p className="text-[9px] uppercase font-bold tracking-widest text-white/30">Faturado</p>
                        <p className="text-sm font-bold">{formatarMoeda(motorista.totalFaturado)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold tracking-widest text-white/30">Comissão</p>
                        <p className="text-sm font-bold">{formatarMoeda(motorista.totalComissao)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold tracking-widest text-white/30">Recebeu</p>
                        <p className="text-sm font-bold">{formatarMoeda(motorista.totalMotorista)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold tracking-widest text-white/30">Corridas</p>
                        <p className="text-sm font-bold">{motorista.qtdCorridas}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {(resumo?.porMotorista || []).length === 0 && (
                  <p className="text-center py-10 text-gray-500 text-sm">
                    Nenhum motorista com pagamentos no período selecionado.
                  </p>
                )}
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
                        <TableCell className="text-xs">{formatarDataHoraNegocio(corrida.pagoEm)}</TableCell>
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
