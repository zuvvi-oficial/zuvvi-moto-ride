import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSessionUser } from "@/lib/user.functions";
import { User, MapPin, Clock, Star, Shield, Bike, FileText, CreditCard } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/onboarding-motorista")({
  component: HomeMotoristaPage,
});

function HomeMotoristaPage() {
  const getSessionUserFn = useServerFn(getSessionUser);
  const { data: user } = useSuspenseQuery({
    queryKey: ["session-user"],
    queryFn: () => getSessionUserFn(),
  });

  const motorista = user.motoristas?.[0];
  const statusAprovacao = motorista?.status_aprovacao || "em_preenchimento";

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "aprovado":
        return { label: "Aprovado", color: "text-zuvvi-volt bg-zuvvi-volt/10 border-zuvvi-volt/20" };
      case "em_analise":
        return { label: "Em Análise", color: "text-zuvvi-amber bg-zuvvi-amber/10 border-zuvvi-amber/20" };
      case "suspenso":
        return { label: "Suspenso", color: "text-destructive bg-destructive/10 border-destructive/20" };
      case "recusado":
        return { label: "Recusado", color: "text-destructive bg-destructive/10 border-destructive/20" };
      default:
        return { label: "Pendente", color: "text-muted-foreground bg-secondary/50 border-border" };
    }
  };

  const status = getStatusDisplay(statusAprovacao);

  return (
    <div className="min-h-screen zuvvi-gradient text-foreground pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md px-5 py-4">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zuvvi-volt/20 flex items-center justify-center border border-zuvvi-volt/30">
              <User className="text-zuvvi-volt w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Olá, Piloto</p>
              <h1 className="text-sm font-bold truncate max-w-[150px]">{user.nome}</h1>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${status.color}`}>
            {status.label}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-8 space-y-6">
        {/* Banner Status */}
        <section className="zuvvi-glow rounded-3xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-zuvvi-volt/10 flex items-center justify-center">
              <Bike className="text-zuvvi-volt w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Estado do Perfil</h2>
              <p className="text-sm text-muted-foreground">Próximos passos para começar</p>
            </div>
          </div>

          <div className="bg-zuvvi-indigo-dark/50 p-4 rounded-2xl border border-white/5 space-y-3">
            <p className="text-xs font-semibold text-white uppercase tracking-wider">Documentação Necessária</p>
            <div className="space-y-3">
              {[
                { label: "CNH (Categoria A ou AB)", icon: FileText, done: !!motorista?.cnh_numero },
                { label: "Documento do Veículo (CRLV)", icon: Shield, done: false },
                { label: "Dados para Pagamento (Pix)", icon: CreditCard, done: !!motorista?.chave_pix },
                { label: "Foto de Perfil", icon: User, done: false }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 text-muted-foreground" />
                    <span>{item.label}</span>
                  </div>
                  {item.done ? (
                    <span className="text-zuvvi-volt text-xs font-bold uppercase">OK</span>
                  ) : (
                    <span className="text-zuvvi-amber text-xs font-bold uppercase">Pendente</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button className="w-full py-4 bg-zuvvi-volt text-zuvvi-indigo font-bold rounded-2xl hover:scale-[1.01] transition-transform shadow-lg shadow-zuvvi-volt/20">
            ENVIAR DOCUMENTOS
          </button>
        </section>

        {/* Resumo */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-secondary/30 border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Nota Média</p>
            <div className="flex items-center gap-1 font-bold">
              <Star className="w-4 h-4 text-zuvvi-amber fill-zuvvi-amber" />
              <span>{motorista?.nota_media || "0.0"}</span>
            </div>
          </div>
          <div className="bg-secondary/30 border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Ganhos Hoje</p>
            <div className="font-bold">
              R$ 0,00
            </div>
          </div>
        </div>

        {/* Informação Estática */}
        <div className="p-4 rounded-2xl bg-zuvvi-volt/5 border border-zuvvi-volt/10 text-center">
          <p className="text-xs text-zuvvi-volt font-medium">
            Em breve você poderá aceitar corridas e ganhar dinheiro com a sua moto.
          </p>
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/90 backdrop-blur-md px-5 py-3">
        <div className="mx-auto max-w-md flex items-center justify-around">
          <button className="flex flex-col items-center gap-1 volt-text">
            <Bike className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Início</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground">
            <Clock className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Histórico</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground">
            <CreditCard className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Carteira</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground">
            <User className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
