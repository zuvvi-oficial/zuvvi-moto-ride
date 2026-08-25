# ETAPA 4-R — COMPENSAÇÃO DE FALHA NA CRIAÇÃO PIX

**Data:** 25/08/2026  
**Fonte normativa:** `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI.md` v1.30  
**Checkpoint-base:** `5d6e2d1ac238a55a9997c02df136e7e34c99d80c`

## Objetivo único

Criar e provar em Supabase local descartável uma compensação atômica para o caso em que a corrida Pix já foi aceita, a tentativa de cobrança foi reservada, mas a criação da cobrança não produziu nenhum identificador Mercado Pago conhecido localmente.

A compensação deve impedir o estado inconsistente `corrida aceita + pagamento sem cobrança utilizável`.

## Allowlist

Nesta microetapa podem ser criados somente:

- `docs/pix/ETAPA_4R_COMPENSACAO_FALHA_CRIACAO.md`;
- `docs/pix/sql/PIX4R_COMPENSACAO_FALHA_CRIACAO.sql.template`;
- `supabase/tests/pix_04r_compensacao_falha_criacao.sql`;
- `.github/workflows/pix-cobranca-failure-compensation.yml`.

Nenhum arquivo existente pode ser alterado nesta prova inicial.

## Comportamento permitido

A função proposta `public.pix_charge_failure_compensate(uuid, uuid, uuid, text)` poderá agir somente quando, simultaneamente:

- a corrida é Pix;
- a corrida pertence ao motorista informado e está em `aceita`;
- o pagamento agregado é Pix e está `pendente`;
- `pagamentos.id_transacao_mercadopago` é nulo;
- a tentativa pertence ao mesmo pagamento/motorista;
- a tentativa está em `criando`;
- `pagamentos_pix_tentativas.mercadopago_payment_id` é nulo.

Quando elegível, a mesma transação deve:

1. marcar a tentativa como `falhou`;
2. marcar o agregado como `falhou`;
3. cancelar tecnicamente a corrida por `operacao` com motivo fixo `falha_tecnica_pagamento_pix`;
4. liberar o motorista novamente, preservando suspensão/reprovação caso existam;
5. retornar `true`.

Uma segunda chamada sobre o mesmo estado já compensado deve ser idempotente e retornar `false`.

Se qualquer identificador Mercado Pago já existir no agregado ou na tentativa, a função deve falhar fechada com `ETAPA4_COMPENSACAO_BLOQUEADA_COBRANCA_EXTERNA` e não cancelar a corrida.

## Travas

- não modificar `src/lib/pagamento.server.ts` nesta prova;
- não modificar `src/lib/motorista.functions.ts`;
- não aplicar migration no Supabase principal antes de teste/versionamento;
- não alterar dinheiro ou cartão;
- não tocar em Webhook, tela Pix, início da corrida ou reembolso;
- não criar `SECURITY DEFINER`;
- não conceder execução a `public`, `anon` ou `authenticated`;
- não usar dados reais;
- não fazer merge.

## Testes obrigatórios

- compensação completa em uma única chamada;
- tentativa fica `falhou` com detalhe técnico sanitizado;
- agregado fica `falhou` sem ID Mercado Pago;
- corrida fica `cancelada`, `cancelado_por=operacao` e motivo técnico fixo;
- motorista aprovado volta a disponível;
- chamada repetida é idempotente;
- existência de ID Mercado Pago bloqueia a compensação integralmente;
- corrida dinheiro não é alterada;
- motorista incorreto não altera estado;
- `SECURITY INVOKER`, `search_path` fechado e grants mínimos;
- lint/advisors locais sem novo problema da função.

## Rollback

Antes da produção, remover somente os quatro arquivos desta prova. Depois de uma futura aplicação, rollback deverá ser lógico por migration posterior; nenhuma migration aplicada será apagada ou reescrita.

## Observação de reconciliação futura

Uma falha de rede durante a criação pode ser ambígua: o provedor pode ter criado uma cobrança sem a resposta ter chegado ao Zuvvi. Por isso, a ligação no aplicativo só poderá ocorrer junto com uma referência externa determinística na cobrança e com o tratamento posterior de aprovação tardia previsto nas Etapas 6 e 8.
