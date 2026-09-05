import { createFileRoute, Link } from "@tanstack/react-router";
import { ZuvviLogo } from "@/components/brand/ZuvviLogo";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Zuvvi" },
      {
        name: "description",
        content: "Regras de uso da plataforma Zuvvi para passageiros e motoristas.",
      },
    ],
  }),
  component: TermosDeUso,
});

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-white">{titulo}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function TermosDeUso() {
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
        <h1 className="text-3xl font-bold text-white">Termos de Uso</h1>
        <p className="mt-2 text-xs text-muted-foreground">Última atualização: setembro de 2026</p>

        <Secao titulo="1. Aceitação">
          <p>
            Ao criar uma conta ou usar o aplicativo Zuvvi, você concorda com estes Termos de Uso e
            com a nossa{" "}
            <Link to="/privacidade" className="text-zuvvi-volt hover:underline">
              Política de Privacidade
            </Link>
            . Se você não concorda, não utilize a plataforma.
          </p>
        </Secao>

        <Secao titulo="2. O que é o Zuvvi">
          <p>
            O Zuvvi é uma plataforma de intermediação tecnológica que conecta passageiros a
            motoristas de moto-táxi independentes. O Zuvvi não é uma empresa de transporte: o
            serviço de transporte em si é prestado diretamente pelo motorista, que é um profissional
            autônomo, não empregado do Zuvvi.
          </p>
        </Secao>

        <Secao titulo="3. Cadastro">
          <p>
            Para usar o Zuvvi você precisa fornecer informações verdadeiras, completas e
            atualizadas. Motoristas precisam, adicionalmente, enviar CNH e documentos do veículo
            válidos e aguardar aprovação antes de aceitar corridas — o Zuvvi pode recusar ou
            suspender o cadastro de qualquer motorista que não atenda aos critérios de segurança da
            plataforma.
          </p>
        </Secao>

        <Secao titulo="4. Corridas e pagamento">
          <p>
            O valor da corrida é calculado no momento da solicitação, com base em distância, tempo
            estimado e a tarifa vigente, e é exibido ao passageiro antes da confirmação. Pagamentos
            via Pix são processados por meio do Mercado Pago; uma corrida com pagamento Pix já
            confirmado não pode ser cancelada unilateralmente pelo app — em caso de problema,
            contate o suporte.
          </p>
        </Secao>

        <Secao titulo="5. Conduta esperada">
          <ul className="list-disc space-y-1 pl-5">
            <li>Tratar a outra parte (motorista ou passageiro) com respeito;</li>
            <li>Não solicitar ou aceitar corridas com informações falsas;</li>
            <li>
              Motoristas devem respeitar as leis de trânsito e usar equipamento de segurança
              adequado;
            </li>
            <li>Não usar a plataforma para qualquer finalidade ilícita.</li>
          </ul>
          <p>O descumprimento destas regras pode levar à suspensão ou ao encerramento da conta.</p>
        </Secao>

        <Secao titulo="6. Limitação de responsabilidade">
          <p>
            O Zuvvi atua como intermediador tecnológico e não se responsabiliza por atos exclusivos
            do motorista ou do passageiro durante a execução da corrida, sem prejuízo dos deveres
            legais de segurança da plataforma. Direcione qualquer emergência aos canais de segurança
            pública (190/192) antes de contatar o suporte do Zuvvi.
          </p>
        </Secao>

        <Secao titulo="7. Alterações">
          <p>
            Podemos atualizar estes termos periodicamente. Mudanças relevantes serão comunicadas no
            próprio aplicativo antes de entrarem em vigor.
          </p>
        </Secao>

        <Secao titulo="8. Contato">
          <p>
            Dúvidas sobre estes termos podem ser enviadas para{" "}
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
