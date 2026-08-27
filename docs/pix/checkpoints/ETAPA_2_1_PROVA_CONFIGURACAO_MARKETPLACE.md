# ETAPA 2.1 — Prova de configuração Marketplace/Split

## Status

PARCIALMENTE APROVADA.

## Objetivo único

Confirmar, sem alterar o payload de cobrança, se a arquitetura Zuvvi está aderente ao modelo oficial Mercado Pago Marketplace / Split 1:1 e separar evidência interna comprovada de requisitos que dependem da configuração real da aplicação/conta Mercado Pago.

## Regra financeira oficial Zuvvi

- Passageiro paga o valor total da corrida.
- Motorista é o vendedor/recebedor e recebe o valor líquido.
- Zuvvi é o marketplace/plataforma e recebe a comissão configurada administrativamente.
- No Checkout Transparente / Payments API, a comissão da Zuvvi permanece representada por `application_fee`.
- Não remover `application_fee` para contornar erro de configuração.
- Não substituir o split por transferência manual posterior.

## Allowlist da microetapa

Somente este checkpoint foi criado.

Nenhum arquivo de runtime, payload, pagamento, corrida, tarifa, OAuth, migration, workflow, dependência, `main` ou Supabase de produção foi alterado nesta microetapa.

## Evidências internas comprovadas

### 1. Comissão nasce no painel administrativo

A tela administrativa de cidades lê e edita `comissao_pct` junto das demais tarifas.

A Server Function `updateTarifasCidade`:

- exige autenticação;
- exige usuário administrativo ativo com role `admin`;
- valida `comissao_pct` entre 0 e 100;
- atualiza `public.cidades.comissao_pct` server-side;
- relê os valores para confirmar persistência;
- grava auditoria com estado anterior, estado novo e justificativa.

### 2. Passageiro não fornece a comissão

Na criação da corrida, o navegador fornece apenas forma de pagamento, valor cotado e assinatura da cotação.

No servidor, `criarCorrida`:

1. valida a assinatura da cotação;
2. busca a cidade do passageiro;
3. lê `cidades.comissao_pct`;
4. calcula `valorComissao = valorCotado * comissao_pct / 100` com arredondamento de moeda;
5. calcula `valorMotorista = valorCotado - valorComissao`;
6. envia os valores calculados para a RPC financeira server-only.

### 3. Snapshot financeiro é congelado no pagamento

`criar_corrida_financeira_atomica` grava no agregado `public.pagamentos`:

- `valor_total`;
- `valor_motorista`;
- `valor_comissao`.

A função é executável por `service_role`, não pelo navegador.

A auditoria de produção confirmou que o snapshot permanece histórico mesmo quando o percentual administrativo muda depois. O único pagamento que não coincidia com a comissão atual de sua cidade foi criado com 15%; o log administrativo mostra que a cidade foi alterada de 15% para 10% somente depois da criação desse pagamento. Portanto, a divergência é histórica esperada, não adulteração do snapshot.

### 4. Tentativa Pix reutiliza o snapshot, não um valor arbitrário do cliente

A RPC real `pix_charge_attempt_claim` lê `valor_total` e `valor_comissao` diretamente de `public.pagamentos` e os copia para `public.pagamentos_pix_tentativas` no momento do claim.

### 5. Cobrança usa Access Token do motorista atribuído

O servidor:

- lê `motoristas.conta_mercado_pago_id` do motorista atribuído;
- busca a credencial privada desse mesmo motorista;
- exige credencial `active`, não revogada e coerente com o `mercadopago_user_id` público esperado;
- se renovar o token, exige que o `user_id` retornado continue sendo o mesmo vendedor;
- usa esse Access Token para instanciar o cliente Mercado Pago que cria o pagamento.

Nenhum Access Token geral da plataforma é usado para criar a cobrança do motorista.

### 6. Payload já contém o split esperado, sem alteração nesta etapa

O corpo atual enviado à Payments API contém:

- `transaction_amount = valor_total`;
- `application_fee = valor_comissao`;
- `payment_method_id = pix`.

A Microetapa 2.1 não alterou esse payload.

### 7. Credencial ativa está internamente coerente

Auditoria read-only de produção confirmou uma credencial ativa com:

- `connection_status = active`;
- sem revogação;
- token não expirado;
- `offline_access` e escopos de pagamentos read/write;
- `mercadopago_user_id` igual à projeção pública do motorista;
- propriedade histórica coerente para o mesmo motorista.

Nenhum token, refresh token, secret ou chave foi exposto no checkpoint.

### 8. Histórico de `application_fee`

Nas tentativas históricas:

- a conta atualmente ativa do motorista possui 32 tentativas e nenhuma falhou com `You cannot use application_fee with this payment.`;
- o único erro com essa mensagem pertence a outra conta histórica, hoje fora da credencial ativa;
- na conta ativa, os erros observados foram de outras classes, principalmente risco/antifraude e payload legado.

Isso é evidência operacional favorável de que `application_fee` não é rejeitada na configuração atual, mas não substitui a comprovação explícita dos requisitos externos do Mercado Pago.

## Aderência à documentação oficial Mercado Pago

A documentação oficial atual de Split de Pagamentos 1:1 determina que:

- o marketplace use um Access Token individual de cada vendedor obtido por OAuth;
- no Checkout Transparente / `/payments`, a comissão do marketplace seja enviada em `application_fee`;
- a aplicação seja criada no modelo de integração Marketplace;
- a conta vendedora atenda aos pré-requisitos aplicáveis, incluindo elegibilidade/KYC indicada pelo Mercado Pago;
- `user_id` retornado pelo OAuth identifica o vendedor/collector associado ao Access Token.

A arquitetura Zuvvi observada no Git e no Supabase é compatível com essas exigências.

## Pontos que NÃO estão comprovados por este ambiente

Não existe neste ambiente acesso autenticado ao painel `Suas integrações` da conta Mercado Pago nem um conector privado Mercado Pago que permita comprovar diretamente:

1. que a aplicação de produção foi criada/está configurada explicitamente com modelo `Marketplace` / Split 1:1;
2. que a conta vendedora atualmente ativa atende ao nível de identificação/KYC exigido pelo Mercado Pago para o produto;
3. que a conta atualmente ativa, conectada antes da trava da Etapa 1.4, é diferente do `user_id` da conta integradora por uma consulta online atual ao Mercado Pago;
4. que a configuração comercial de produção está habilitada para realizar uma cobrança Pix real com split até aprovação.

A Etapa 1.4 impede novas confirmações da conta integradora, mas isso não é usado como prova retroativa da credencial ativa anterior.

## Classificação

**PARCIALMENTE APROVADA.**

O lado Zuvvi está comprovado: origem administrativa da comissão, snapshot financeiro, Access Token do motorista, escopos internos, ownership e `application_fee` estão coerentes.

A aprovação integral da Microetapa 2.1 permanece bloqueada apenas pela prova externa da configuração real Mercado Pago (modelo Marketplace/Split da aplicação + elegibilidade da conta vendedora + distinção online vendedor/integrador).

## Próximo portão

Não iniciar a Microetapa 2.2 nem alterar o payload enquanto a 2.1 não estiver integralmente aprovada.

A prova externa deve ser obtida sem compartilhar Client Secret, Access Token ou Refresh Token. Evidência aceitável: configuração do produto/modelo no painel Mercado Pago e status/requisitos da conta vendedora, ou diagnóstico server-side autenticado que retorne somente metadados não sensíveis necessários para o portão.

## Rollback

Não aplicável: esta microetapa foi somente leitura e documentação. Nenhuma alteração de runtime ou banco foi realizada.