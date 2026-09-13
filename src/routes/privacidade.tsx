import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { LegalPageShell, Secao, Lista } from "@/components/legal/LegalPage";
import { TERMOS_VERSAO } from "@/lib/legal-versions";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Zuvvi" },
      {
        name: "description",
        content: "Como a Zuvvi coleta, usa e protege seus dados pessoais.",
      },
    ],
  }),
  component: PoliticaDePrivacidade,
});

const ULTIMA_ATUALIZACAO = new Date(TERMOS_VERSAO).toLocaleDateString("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function PoliticaDePrivacidade() {
  return (
    <LegalPageShell titulo="Política de Privacidade">
      <div className="rounded-2xl bg-zuvvi-volt/10 border border-zuvvi-volt/20 p-5 flex items-start gap-4">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-zuvvi-volt/15 border border-zuvvi-volt/30 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-zuvvi-volt" />
        </div>
        <p className="text-sm text-white/80 leading-relaxed">
          Esta política explica, em linguagem clara, quais dados o Zuvvi coleta, para que servem e
          quais direitos você tem sobre eles. Última atualização em{" "}
          <span className="text-white font-semibold">{ULTIMA_ATUALIZACAO}</span>.
        </p>
      </div>

      <Secao titulo="1. Quem é responsável pelos seus dados">
        <p>
          A Zuvvi Mobilidade Urbana ("Zuvvi", "nós") é a controladora dos dados pessoais tratados na
          plataforma, nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
        </p>
      </Secao>

      <Secao titulo="2. Quais dados coletamos">
        <p className="font-semibold text-white">De todas as pessoas usuárias</p>
        <Lista
          itens={[
            "Nome, e-mail, celular, CPF e data de nascimento, informados no cadastro",
            "Foto de perfil (opcional)",
            "Mensagens trocadas no chat da corrida e chamados abertos com o suporte",
            "Avaliações dadas e recebidas ao final das corridas",
            "Endereços salvos como favoritos",
          ]}
        />
        <p className="font-semibold text-white pt-2">De passageiros</p>
        <Lista
          itens={[
            "Localização de origem e destino de cada corrida solicitada",
            "Contatos de confiança cadastrados por você (nome e telefone de terceiros), usados para acompanhamento de corridas",
            "Um identificador de dispositivo gerado pelo Mercado Pago no momento do pagamento Pix, usado exclusivamente para prevenção de fraude",
          ]}
        />
        <p className="font-semibold text-white pt-2">De motoristas parceiros</p>
        <Lista
          itens={[
            "CNH (número, categoria e validade) e documentos enviados para aprovação de cadastro",
            "Dados do veículo: placa, marca, modelo, ano e cor",
            "Localização em tempo real durante corridas aceitas, para o passageiro acompanhar a chegada",
            "Chave Pix, usada para receber os repasses das corridas",
          ]}
        />
        <p className="font-semibold text-white pt-2">Pagamentos e notificações</p>
        <Lista
          itens={[
            "Valor, forma de pagamento e status de cada corrida e cobrança Pix",
            "Um identificador técnico do navegador, quando você ativa notificações push",
          ]}
        />
      </Secao>

      <Secao titulo="3. Para que usamos esses dados">
        <Lista
          itens={[
            "Viabilizar a corrida: conectar passageiro e motorista, calcular rota e valor, e permitir o acompanhamento em tempo real",
            "Processar pagamentos via Pix, em conjunto com o Mercado Pago",
            "Confirmar identidade e habilitação do motorista antes de liberar corridas",
            "Prevenir fraudes em pagamentos",
            "Dar suporte quando você abre um chamado",
            "Enviar notificações sobre suas corridas",
            "Cumprir obrigações legais e fiscais",
          ]}
        />
        <p>Não vendemos seus dados a terceiros, nem os usamos para publicidade de terceiros.</p>
      </Secao>

      <Secao titulo="4. Com quem compartilhamos">
        <Lista
          itens={[
            "Entre passageiro e motorista: durante uma corrida ativa, cada um vê o necessário para o encontro acontecer (nome, localização, veículo) — nunca CPF, e-mail ou dados financeiros um do outro",
            "Mercado Pago: processa os pagamentos Pix e os repasses aos motoristas",
            "Supabase: hospeda nosso banco de dados, com controles técnicos de acesso que restringem quem pode ler cada informação",
            "Autoridades públicas, quando exigido por lei",
          ]}
        />
      </Secao>

      <Secao titulo="5. Por quanto tempo guardamos">
        <Lista
          itens={[
            "Dados de conta: enquanto sua conta estiver ativa",
            "Registros de corridas e pagamentos: pelo prazo exigido pela legislação fiscal e contábil brasileira, mesmo após a exclusão da conta — porém desvinculados do seu nome quando você solicita a exclusão",
            "Mensagens de chat: durante a corrida e por um período posterior, para eventual resolução de disputas",
            "Documentos do motorista: enquanto o cadastro estiver ativo",
          ]}
        />
      </Secao>

      <Secao titulo="6. Como protegemos seus dados">
        <Lista
          itens={[
            "Toda comunicação com o Zuvvi é feita por conexão criptografada (HTTPS)",
            "O banco de dados aplica controle de acesso linha a linha: uma pessoa só consegue ler seus próprios dados diretamente, nunca os de outra",
            "Chaves Pix e dados sensíveis de pagamento são armazenados de forma protegida, nunca expostos publicamente",
          ]}
        />
      </Secao>

      <Secao titulo="7. Seus direitos como titular dos dados">
        <p>Pela LGPD, você pode a qualquer momento:</p>
        <Lista
          itens={[
            "Confirmar quais dados temos sobre você e pedir uma cópia",
            "Corrigir dados incompletos ou desatualizados",
            "Pedir a exclusão dos seus dados, respeitando obrigações legais de guarda",
            "Revogar consentimentos dados anteriormente",
            "Pedir informações sobre com quem compartilhamos seus dados",
          ]}
        />
        <p>
          Essas ações estarão disponíveis diretamente no seu perfil dentro do app. Até lá, envie um
          e-mail para{" "}
          <a href="mailto:suporte@zuvvi.app" className="text-zuvvi-volt underline">
            suporte@zuvvi.app
          </a>
          .
        </p>
      </Secao>

      <Secao titulo="8. Alterações nesta política">
        <p>
          Podemos atualizar esta política conforme o Zuvvi evolui. Mudanças relevantes serão
          avisadas dentro do app.
        </p>
      </Secao>

      <Secao titulo="9. Fale conosco">
        <p>
          Dúvidas sobre privacidade ou seus dados:{" "}
          <a href="mailto:suporte@zuvvi.app" className="text-zuvvi-volt underline">
            suporte@zuvvi.app
          </a>
        </p>
      </Secao>
    </LegalPageShell>
  );
}
