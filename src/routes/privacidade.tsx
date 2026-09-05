import { createFileRoute, Link } from "@tanstack/react-router";
import { ZuvviLogo } from "@/components/brand/ZuvviLogo";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Zuvvi" },
      {
        name: "description",
        content: "Como o Zuvvi coleta, usa e protege os dados de passageiros e motoristas.",
      },
    ],
  }),
  component: PoliticaPrivacidade,
});

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-white">{titulo}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 px-5 py-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to="/">
            <ZuvviLogo surface="dark" className="h-auto w-[100px]" />
          </Link>
          <Link
            to="/"
            className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-zuvvi-volt"
          >
            Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-bold text-white">Política de Privacidade</h1>
        <p className="mt-2 text-xs text-muted-foreground">Última atualização: setembro de 2026</p>

        <Secao titulo="1. Quem somos">
          <p>
            O Zuvvi é uma plataforma brasileira de intermediação de corridas de moto-táxi. Esta
            política explica quais dados pessoais coletamos de passageiros e motoristas, para quê os
            usamos e quais são os seus direitos, em conformidade com a Lei Geral de Proteção de
            Dados (Lei nº 13.709/2018 — LGPD).
          </p>
        </Secao>

        <Secao titulo="2. Dados que coletamos">
          <p>
            <strong className="text-white/90">De todos os usuários:</strong> nome, e-mail, telefone
            e CPF, usados para criar e autenticar sua conta e para prevenção a fraude.
          </p>
          <p>
            <strong className="text-white/90">De passageiros:</strong> localização de embarque e
            destino durante o uso do app (para calcular rota e tarifa) e histórico de corridas.
          </p>
          <p>
            <strong className="text-white/90">De motoristas:</strong> CNH, documentos e dados do
            veículo (placa, marca, modelo, ano, cor) para validar a habilitação a rodar na
            plataforma, além de localização em tempo real durante uma corrida ativa, para o
            passageiro acompanhar o trajeto.
          </p>
          <p>
            <strong className="text-white/90">Dados de pagamento:</strong> cobranças Pix são
            processadas pelo Mercado Pago; o Zuvvi não armazena dados de cartão ou senha bancária —
            apenas o status e o valor da transação.
          </p>
        </Secao>

        <Secao titulo="3. Para que usamos seus dados">
          <ul className="list-disc space-y-1 pl-5">
            <li>Conectar passageiros a motoristas e viabilizar a corrida solicitada;</li>
            <li>Processar pagamentos e repasses;</li>
            <li>
              Enviar notificações sobre o andamento da corrida (inclusive push, quando autorizado);
            </li>
            <li>Prevenir fraude e abuso da plataforma;</li>
            <li>Cumprir obrigações legais e regulatórias.</li>
          </ul>
        </Secao>

        <Secao titulo="4. Compartilhamento com terceiros">
          <p>
            Compartilhamos dados estritamente necessários com o Mercado Pago (processamento de
            pagamento Pix) e com o Mapbox (exibição de mapas e cálculo de rotas). Durante uma
            corrida, o passageiro e o motorista envolvidos veem os dados um do outro necessários à
            execução da corrida (nome, localização, avaliação). Se você usar a função "Compartilhar
            viagem", um link com dados limitados da corrida (posição do motorista, status) fica
            acessível a quem você enviar o link — sem exigir login. Não vendemos dados pessoais a
            terceiros.
          </p>
        </Secao>

        <Secao titulo="5. Retenção e exclusão">
          <p>
            Mantemos seus dados enquanto sua conta estiver ativa e pelo prazo necessário para
            cumprir obrigações legais (fiscais e regulatórias sobre transações financeiras). Você
            pode solicitar a exclusão da sua conta e dos seus dados pessoais a qualquer momento pelo
            canal descrito na seção 7.
          </p>
        </Secao>

        <Secao titulo="6. Seus direitos (LGPD)">
          <p>
            Você pode solicitar, a qualquer momento: confirmação de que tratamos seus dados, acesso
            aos dados, correção de dados incompletos ou desatualizados, anonimização ou exclusão de
            dados desnecessários, portabilidade e informação sobre com quem compartilhamos seus
            dados.
          </p>
        </Secao>

        <Secao titulo="7. Contato">
          <p>
            Dúvidas sobre esta política ou solicitações relacionadas aos seus dados podem ser
            enviadas para{" "}
            <a href="mailto:suporte@zuvvi.app" className="text-zuvvi-volt hover:underline">
              suporte@zuvvi.app
            </a>
            .
          </p>
        </Secao>
      </main>
    </div>
  );
}
