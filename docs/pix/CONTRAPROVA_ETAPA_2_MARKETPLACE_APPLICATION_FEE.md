# CONTRAPROVA — MARKETPLACE / SPLIT E `application_fee`

**Data:** 28/08/2026  
**Passo de trabalho:** 3b  
**Correspondência na Fonte da Verdade V2:** Etapa 2 — Marketplace/Split e `application_fee`  
**Branch:** `reconcile/pix-100-seguro-main`  
**Base desta análise:** `47048f8820d577785bde9e47a0a6741d14b3793c`  
**Classificação:** **PARCIALMENTE APROVADA**

---

## 1. Objetivo

Comprovar até onde a arquitetura financeira atual da Zuvvi já atende ao modelo Marketplace/Split documentado pelo Mercado Pago, sem alterar o payload de pagamento e sem criar uma verificação artificial para responder se uma conta “aceita `application_fee`”.

Esta contraprova separa três perguntas diferentes:

1. o token usado pela Zuvvi vem do OAuth do vendedor correto?;
2. a conta recebedora é diferente da conta da plataforma/integrador?;
3. o Mercado Pago aceitará, na prática, uma cobrança Pix desse vendedor com `application_fee`?

As duas primeiras podem ser verificadas pela arquitetura e pelos dados internos. A terceira exige homologação controlada com o Mercado Pago.

---

## 2. Allowlist desta microetapa

Permitido:

- leitura do código Pix/OAuth já versionado;
- leitura de documentação oficial atual do Mercado Pago;
- consultas somente leitura ao Supabase para consistência e diagnóstico;
- criação deste documento de contraprova.

Não permitido nesta microetapa:

- alterar `application_fee`;
- remover comissão;
- alterar payload de `/v1/payments`;
- adicionar flag local como `supports_application_fee` ou equivalente;
- inferir capacidade de split por `scope`, `token_type`, prefixo/formato de token ou status local da credencial;
- criar cobrança real sem autorização explícita;
- alterar Supabase de produção;
- alterar Lovable;
- alterar dinheiro/cartão ou qualquer fluxo fora do Pix.

---

## 3. Evidência oficial atual do Mercado Pago

Documentação consultada em 28/08/2026:

- Split de Pagamentos 1:1 — Pré-requisitos:  
  `https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/prerequisites`
- Split de Pagamentos 1:1 — Integrar checkout ao marketplace:  
  `https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace`
- Referência da API Mercado Pago:  
  `https://www.mercadopago.com.br/developers/pt/reference`

A documentação oficial estabelece que:

1. no modelo Split 1:1, o marketplace deve usar um Access Token para cada vendedor, obtido via OAuth;
2. no Checkout Transparente, a comissão do marketplace é enviada em `application_fee` na criação do pagamento;
3. o vendedor precisa atender aos pré-requisitos do produto, incluindo conta de vendedor e requisitos de identificação descritos pelo Mercado Pago;
4. a referência de erros documenta o código `2059` — “You cannot use application_fee with this payment” — e orienta a usar um Access Token obtido via OAuth quando esse erro decorrer da origem incorreta do token.

### Limite documental encontrado

Nesta revisão das fontes oficiais não foi encontrado um endpoint, campo ou atributo documentado que funcione como uma pré-validação confiável do tipo:

`esta_conta_aceita_application_fee = true`

Também não foi encontrada base oficial para tratar os seguintes sinais como prova de capacidade de `application_fee`:

- `scope` contendo permissões de pagamentos;
- `token_type = Bearer`;
- credencial local com `connection_status = active`;
- consulta de identidade do usuário/token;
- formato ou prefixo do Access Token.

Esses sinais podem provar identidade, validade local ou permissões relacionadas, mas **não substituem a prova de que a configuração Marketplace/Split está habilitada e aceita a cobrança com comissão**.

Portanto, a Zuvvi não deve inventar uma pré-checagem local de capacidade.

---

## 4. O que o código atual da Zuvvi já comprova

### 4.1 O retorno OAuth identifica o vendedor

O cliente OAuth interpreta o `user_id` devolvido pelo Mercado Pago junto ao token e o fluxo de conclusão usa esse `user_id` como `mercadoPagoUserId` da autorização.

A autorização não é ativada imediatamente. Os tokens são cifrados e persistidos primeiro como autorização pendente.

### 4.2 A ativação exige confirmação explícita

O fluxo atual promove a autorização pendente para credencial ativa somente depois da confirmação autenticada do motorista.

A credencial definitiva mantém o vínculo:

`motorista_id -> mercadopago_user_id -> tokens OAuth cifrados`

### 4.3 A conta da plataforma/integrador é bloqueada

Na confirmação, o backend cria um cliente da própria aplicação Mercado Pago e obtém o `user_id` do proprietário da aplicação via `client_credentials`.

Esse ID é enviado ao RPC de confirmação. O banco compara o `mercadopago_user_id` da autorização pendente com o ID da plataforma; se forem iguais, a autorização é removida e o resultado é `platform_account`.

Logo, o fluxo atual contém uma barreira explícita contra utilizar a própria conta da plataforma como conta recebedora do motorista.

### 4.4 A cobrança usa a credencial vinculada ao motorista

Antes de criar a cobrança Pix, o motor atual:

- carrega a credencial privada do motorista;
- exige `connection_status = active`;
- exige ausência de revogação;
- compara o `mercadopago_user_id` privado com `motoristas.conta_mercado_pago_id`;
- renova o token quando necessário;
- rejeita refresh cujo `user_id` seja diferente da conta esperada;
- instancia o SDK de pagamentos com o Access Token dessa credencial;
- mantém `application_fee: valorComissao`.

Não há fallback para token geral da plataforma.

---

## 5. Fotografia somente leitura do Supabase de produção

A consulta de consistência executada nesta microetapa não fez DDL nem DML e não leu tokens em claro.

No momento da fotografia:

- credenciais Mercado Pago ativas e não revogadas: **1**;
- projeções públicas consistentes com o `mercadopago_user_id` privado: **1**;
- projeções divergentes: **0**.

Isso comprova consistência do vínculo interno atual, mas **não comprova habilitação externa para `application_fee`**.

---

## 6. Evidência histórica de falhas reais

Consulta agregada somente leitura em `pagamentos_pix_tentativas` encontrou, entre os diagnósticos preservados:

- 14 ocorrências de `rejected_high_risk`;
- 3 rejeições antigas envolvendo `additional_info.payer.identification`;
- 1 rejeição `Invalid user identification number`;
- 1 rejeição `You cannot use application_fee with this payment.`

A tentativa que registrou a rejeição de `application_fee` ocorreu em **27/08/2026 15:48:01 UTC**.

A credencial posteriormente registrada para aquele motorista foi conectada em **27/08/2026 16:07:03 UTC**, isto é, depois daquela tentativa.

Consequência: a rejeição histórica de `application_fee` **não é prova válida de incompatibilidade da conexão OAuth criada posteriormente**.

Da mesma forma, o `scope` amplo da conexão posterior não pode ser usado como prova positiva de que `application_fee` funcionará.

---

## 7. Decisão técnica do 3b

### O que fica comprovado

- arquitetura Zuvvi no modelo “vendedor com token próprio”;
- origem OAuth para novas autorizações do fluxo atual;
- vínculo entre motorista e `mercadopago_user_id`;
- confirmação explícita antes de ativar;
- isolamento da conta da plataforma/integrador;
- cobrança configurada para usar o token do motorista;
- `application_fee` preservado, sem gambiarra para fazer QR nascer.

### O que NÃO fica comprovado

Ainda não existe prova suficiente de que uma conta vendedora específica, conectada pelo fluxo atual, está efetivamente habilitada pelo Mercado Pago para aceitar uma cobrança Pix com `application_fee`.

Também não foi comprovado nesta microetapa o requisito externo de elegibilidade/KYC do vendedor para o produto Split 1:1.

Por isso, **não criar** qualquer campo, heurística ou endpoint interno que declare essa capacidade previamente.

---

## 8. Teste controlado proposto — prova de criação sem movimentação financeira

Este teste só deve ser executado após autorização explícita para chamar o Mercado Pago no ambiente escolhido.

### Pré-condições

1. usar uma conta de vendedor dedicada à homologação;
2. conectá-la pelo fluxo OAuth atual da Zuvvi;
3. concluir a confirmação explícita;
4. comprovar que o vendedor é diferente da conta da plataforma/integrador;
5. conferir no ambiente/conta Mercado Pago os pré-requisitos do Split 1:1, inclusive elegibilidade do vendedor;
6. usar passageiro de teste/controlado com dados coerentes e CPF válido;
7. usar Device ID válido;
8. não alterar a fórmula de comissão da Zuvvi.

### Execução

Criar **uma única** cobrança Pix controlada com:

- menor valor adequado ao ambiente de homologação e permitido pela integração;
- `application_fee` não zero calculado pela regra existente;
- `payment_method_id = pix`;
- Access Token OAuth do vendedor;
- `X-Idempotency-Key` único;
- referência externa única;
- recebedor esperado.

### Evidência de sucesso desta fase

A fase de criação será considerada aprovada se o Mercado Pago:

- aceitar a requisição sem `2059`/rejeição equivalente de `application_fee`;
- devolver `payment_id`;
- devolver QR Code/Copia e Cola utilizável;
- permitir reconciliação canônica do pagamento;
- apresentar o vendedor/collector esperado.

**Não é necessário pagar o QR nesta primeira fase.** Assim, a aceitação técnica de `application_fee` pode ser comprovada sem transferência efetiva de dinheiro.

Se a criação falhar especificamente por `application_fee` mesmo com vendedor correto, OAuth correto e pré-requisitos confirmados, a ação correta é **parar e diagnosticar a configuração Marketplace/Split no Mercado Pago**. Não remover `application_fee` do código.

---

## 9. Teste financeiro posterior — prova do split efetivo

A aceitação da criação prova compatibilidade da cobrança, mas não prova liquidação financeira.

Para declarar o split financeiro ponta a ponta como aprovado será necessária uma segunda autorização explícita para teste com movimentação real ou ambiente oficialmente adequado, usando:

- pagador não relacionado indevidamente ao vendedor/integrador;
- valor mínimo controlado;
- confirmação canônica de `approved`;
- conferência do recebedor correto;
- conferência da comissão Zuvvi;
- conferência do valor líquido do vendedor;
- evidência de que nenhuma conta de outro motorista foi envolvida.

Esse teste não faz parte deste commit documental.

---

## 10. Classificação

**3b / Etapa 2 — PARCIALMENTE APROVADA.**

Motivo:

- a arquitetura OAuth/Marketplace necessária está demonstrada no código atual;
- o vínculo interno ativo está consistente;
- a conta da plataforma possui bloqueio explícito;
- a documentação oficial sustenta o uso de Access Token OAuth por vendedor e `application_fee` no Checkout Transparente;
- não existe, nas fontes revisadas, uma pré-checagem oficial confiável para afirmar antecipadamente que determinada conta aceitará `application_fee`;
- falta a contraprova controlada de criação Pix com `application_fee` usando um vendedor elegível e conectado pelo fluxo atual.

**Próximo critério de liberação:** executar o teste controlado da seção 8 mediante autorização explícita, sem alterar o payload para contornar eventual erro de configuração.