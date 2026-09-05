import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getAdminPagamentosStats, getAdminPagamentosPixProblemas } from "@/lib/admin.functions";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminBottomNav } from "@/components/admin/AdminBottomNav";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Clock, CheckCircle2, RotateCcw } from "lucide-react";

const statsOptions = queryOptions({
  queryKey: ["admin-pagamentos-stats"],
  queryFn: () => getAdminPagamentosStats(),
});

const problemasOptions = queryOptions({
  queryKey: ["admin-pagamentos-pix-problemas"],
  queryFn: () => getAdminPagamentosPixProblemas(),
});

export const Route = createFileRoute("/admin/pagamentos")({
  loader: async ({ context }) => {
    try {
      await Promise.all([
        context.queryClient.ensureQueryData(statsOptions),
        context.queryClient.ensureQueryData(problemasOptions),
      ]);
    } catch {
      throw redirect({ to: "/" });
    }
  },
  component: PagamentosAdmin,
});

function formatMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

const ESTADO_LABEL: Record<string, string> = {
  falhou: "Falhou",
  criando: "Travada (criando)",
  pendente: "Travada (pendente)",
};

type PagamentoPixProblema = {
  tentativaId: string;
  corridaId: string | null;
  estadoInterno: string;
  providerStatus: string | null;
  providerStatusDetail: string | null;
  valorTotal: number;
  createdAt: string;
  origemNome: string | null;
  destinoNome: string | null;
  motoristaNome: string | null;
  passageiroNome: string | null;
};

function PagamentosAdmin() {
  const { data: stats } = useSuspenseQuery(statsOptions);
  const { data: problemas } = useSuspenseQuery(problemasOptions);

  const statCards = [
    {
      title: "Pendentes",
      value: stats.pendente,
      icon: Clock,
      color: "text-amber-500",
    },
    {
      title: "Pagos",
      value: stats.pago,
      icon: CheckCircle2,
      color: "text-green-500",
    },
    {
      title: "Falhados",
      value: stats.falhou,
      icon: AlertTriangle,
      color: "text-red-500",
    },
    {
      title: "Estornados",
      value: stats.estornado,
      icon: RotateCcw,
      color: "text-blue-500",
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-zuvvi-indigo text-white flex flex-col pb-24">
      <AdminHeader />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Pagamentos</h1>
          <p className="text-white/60">
            Visão somente leitura — nenhuma ação aqui move dinheiro ou chama o Mercado Pago.
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="bg-white/[0.02] border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-xs text-white/50 mt-1">{stat.title}</div>
            </Card>
          ))}
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">Cobranças Pix com problema</h2>
          <p className="text-sm text-white/50">
            Falhadas, ou travadas há mais de 15 minutos sem confirmação do Mercado Pago.
          </p>

          {problemas.length === 0 ? (
            <Card className="bg-white/[0.02] border-white/10 p-6 text-center text-white/50">
              Nenhuma cobrança Pix com problema no momento.
            </Card>
          ) : (
            <div className="space-y-3">
              {(problemas as PagamentoPixProblema[]).map((p) => (
                <Card key={p.tentativaId} className="bg-white/[0.02] border-white/10 p-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-red-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {ESTADO_LABEL[p.estadoInterno] ?? p.estadoInterno}
                    </span>
                    <span className="text-xs text-white/40">{formatData(p.createdAt)}</span>
                  </div>
                  <div className="text-sm text-white/80">
                    {p.origemNome || "Origem não informada"} →{" "}
                    {p.destinoNome || "Destino não informado"}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
                    <div>Passageiro: {p.passageiroNome || "—"}</div>
                    <div>Motorista: {p.motoristaNome || "—"}</div>
                    <div>Valor: {formatMoeda(p.valorTotal)}</div>
                    {p.providerStatus && (
                      <div>
                        Status Mercado Pago: {p.providerStatus}
                        {p.providerStatusDetail ? ` (${p.providerStatusDetail})` : ""}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
      <AdminBottomNav />
    </div>
  );
}
