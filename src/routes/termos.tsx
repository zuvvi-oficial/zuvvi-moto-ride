import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { LegalPageShell, Secao, Lista } from "@/components/legal/LegalPage";
import { TERMOS_VERSAO } from "@/lib/legal-versions";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Zuvvi" },
      {
        name: "description",
        content: "As regras de uso da plataforma Zuvvi para passageiros e motoristas parceiros.",
      },
    ],
  }),
  component: TermosDeUso,
});

const ULTIMA_ATUALIZACAO = new Date(TERMOS_VERSAO).toLocaleDateString("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function TermosDeUso() {
  return (
    <LegalPageShell titulo="Termos de Uso">
      <div className="rounded-2xl bg-zuvvi-volt/10 border border-zuvvi-volt/20 p-5 flex items-start gap-4">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-zuvvi-volt/15 border border-zuvvi-volt/30 flex items-center justify-center">
          <FileText className="w-5 h-5 text-zuvvi-volt" />
        </div>
        <p className="text-sm text-white/80 leading-relaxed">
          Estes Termos regem o uso do aplicativo Zuvvi por passageiros e motoristas parceiros. Ao
          criar uma conta ou usar o app, você concorda com o que está descrito aqui. Última
          atualização em <span className="text-white font-semibold">{ULTIMA_ATUALIZACAO}</span>.
        </p>
      </div>

      <Secao titulo="1. Aceitação dos termos">
        <p>
          Ao se cadastrar ou usar o Zuvvi, você declara que leu, entendeu e concorda com estes
          Termos de Uso e com a nossa Política de Privacidade. Se não concordar, não utilize o
          aplicativo.
        </p>
      </Secao>

      <Secao titulo="2. Quem pode usar o Zuvvi">
        <Lista
          itens={[
            "Você precisa ter pelo menos 18 anos para se cadastrar como passageiro ou motorista",
            "As informações fornecidas no cadastro (nome, CPF, data de nascimento, documentos) precisam ser verdadeiras e atualizadas",
            "Cada pessoa pode manter apenas uma conta de passageiro e uma conta de motorista",
          ]}
        />
      </Secao>

      <Secao titulo="3. O que é o Zuvvi">
        <p>
          O Zuvvi é uma plataforma tecnológica que conecta passageiros a motoristas parceiros
          autônomos de moto-táxi. O Zuvvi não é uma empresa de transporte e não emprega os
          motoristas parceiros: cada motorista é responsável por sua própria habilitação, veículo e
          conduta durante a corrida.
        </p>
      </Secao>

      <Secao titulo="4. Motoristas parceiros">
        <Lista
          itens={[
            "O cadastro como motorista depende do envio de documentos (CNH, dados do veículo) e da aprovação da equipe do Zuvvi",
            "O cadastro pode ser recusado ou o acesso suspenso a qualquer momento, com justificativa, em caso de documentação inválida, vencida ou conduta inadequada",
            "A cada corrida concluída, o Zuvvi retém uma comissão sobre o valor cobrado antes de repassar o restante ao motorista via Pix",
          ]}
        />
      </Secao>

      <Secao titulo="5. Corridas e pagamentos">
        <Lista
          itens={[
            "O valor da corrida é calculado e mostrado antes da confirmação, com base em distância e tempo estimados",
            "O pagamento pode ser feito pelas formas disponíveis no app no momento da corrida",
            "Ao embarcar, o motorista pode solicitar o código de embarque exibido no seu app, para confirmar que a corrida é com a pessoa certa",
          ]}
        />
      </Secao>

      <Secao titulo="6. Cancelamentos">
        <p>
          Tanto o passageiro quanto o motorista podem cancelar uma corrida antes da sua conclusão.
          Cancelamentos frequentes ou feitos de má-fé podem levar a uma análise da conta e,
          dependendo do caso, à sua suspensão.
        </p>
      </Secao>

      <Secao titulo="7. Avaliações e conduta">
        <p>
          Ao final de cada corrida, passageiro e motorista podem se avaliar mutuamente. Manter uma
          conduta respeitosa é obrigatório. Comportamento abusivo, discriminatório ou que coloque em
          risco a segurança de outra pessoa pode levar à suspensão ou ao encerramento da conta.
        </p>
      </Secao>

      <Secao titulo="8. Segurança durante a corrida">
        <Lista
          itens={[
            "O app oferece recursos de segurança como compartilhamento de viagem com contatos de confiança e um canal de SOS com o suporte",
            "O SOS do app não substitui os serviços de emergência públicos: em caso de perigo imediato, ligue para as autoridades (190 Polícia Militar, 192 SAMU, 193 Corpo de Bombeiros)",
          ]}
        />
      </Secao>

      <Secao titulo="9. Cupons, indicações e corridas agendadas">
        <p>
          Cupons de desconto, o programa de indicação de amigos e o agendamento de corridas seguem
          regras próprias exibidas no app no momento do uso (validade, valores e condições), que
          podem ser alteradas ou encerradas a qualquer momento, sem afetar corridas já concluídas.
        </p>
      </Secao>

      <Secao titulo="10. Suspensão e encerramento de conta">
        <p>
          Você pode encerrar sua conta a qualquer momento pelo app. O Zuvvi também pode suspender ou
          encerrar contas que violem estes Termos, apresentem informações falsas ou coloquem em
          risco a segurança de outras pessoas usuárias da plataforma.
        </p>
      </Secao>

      <Secao titulo="11. Limites de responsabilidade">
        <p>
          O Zuvvi atua como intermediador tecnológico entre passageiros e motoristas parceiros
          autônomos. Fazemos o possível para manter a plataforma segura e confiável, mas a conduta
          durante o trajeto é de responsabilidade de cada motorista parceiro, que atua como
          profissional autônomo.
        </p>
      </Secao>

      <Secao titulo="12. Alterações nestes termos">
        <p>
          Podemos atualizar estes Termos conforme o Zuvvi evolui. Mudanças relevantes serão avisadas
          dentro do app antes de entrarem em vigor.
        </p>
      </Secao>

      <Secao titulo="13. Lei aplicável">
        <p>
          Estes Termos são regidos pelas leis brasileiras. Eventuais disputas serão resolvidas
          preferencialmente por acordo direto e, quando necessário, no foro da comarca do domicílio
          do usuário, conforme prevê o Código de Defesa do Consumidor.
        </p>
      </Secao>

      <Secao titulo="14. Fale conosco">
        <p>
          Dúvidas sobre estes Termos:{" "}
          <a href="mailto:suporte@zuvvi.app" className="text-zuvvi-volt underline">
            suporte@zuvvi.app
          </a>
        </p>
      </Secao>
    </LegalPageShell>
  );
}
