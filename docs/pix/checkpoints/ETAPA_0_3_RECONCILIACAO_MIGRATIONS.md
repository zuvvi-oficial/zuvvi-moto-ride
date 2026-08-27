# CHECKPOINT PIX ZUVVI — ETAPA 0.3

**Microetapa:** Reconciliação GitHub × Supabase das migrations Pix  
**Data:** 27/08/2026  
**Fonte da Verdade:** `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI_V2.md`  
**Branch:** `feature/pix-100-seguro`  
**Supabase:** `qycblinfvijhfjcmdoof`  
**Classificação:** **APROVADA EM LEITURA — RECONCILIAÇÃO DE HISTÓRICO NECESSÁRIA ANTES DA 0.4**

---

## 1. Objetivo

Provar, sem executar DDL/DML e sem reaplicar migrations, se o conjunto lógico de migrations Pix versionado na branch corresponde ao estado realmente aplicado no Supabase de produção.

Esta microetapa não corrige timestamps. Ela identifica e prova a divergência antes de qualquer alteração de histórico Git.

---

## 2. Travas cumpridas

Durante a Etapa 0.3:

- nenhuma migration foi aplicada;
- nenhuma migration foi reparada no Supabase;
- nenhum DDL foi executado;
- nenhum DML foi executado;
- nenhum dado operacional foi alterado;
- nenhum arquivo de código foi alterado;
- nenhum arquivo de migration foi alterado;
- `main` não foi alterada;
- dinheiro, cartão e core permaneceram congelados;
- Lovable não foi usado como agente de implementação.

As consultas feitas no Supabase foram somente `SELECT`/catálogo.

---

## 3. Resultado executivo

Foram reconciliados **16 blocos lógicos de migration** relacionados à fundação Pix/financeira utilizada pelo fluxo atual.

Resultado:

- **16/16 efeitos lógicos presentes no Supabase**;
- **0 migration lógica Pix faltando no banco**;
- **0 necessidade de DDL em produção para esta reconciliação**;
- **11 migrations com o mesmo timestamp GitHub × Supabase**;
- **5 migrations com timestamp de histórico diferente**;
- dentro das 5 divergências de timestamp, **4 possuem SQL operacional idêntico** (desconsiderando newline final) e **1 possui diferença textual/formatacional, mas comportamento lógico equivalente**;
- além disso, entre as 11 de mesmo timestamp há **2 diferenças textuais sem diferença estrutural/operacional** e **9 correspondências de SQL**.

Conclusão: o schema de produção não está “faltando” essas cinco migrations. O problema é **histórico/versionamento**, e tentar reaplicá-las seria incorreto.

---

## 4. Matriz canônica das 16 migrations

| # | Migration na branch | Migration no Supabase | Classificação |
|---|---|---|---|
| 1 | `20260824222419_unicidade_conta_mercado_pago_motorista.sql` | `20260824222419_unicidade_conta_mercado_pago_motorista` | mesmo timestamp; texto diferente; objeto final equivalente |
| 2 | `20260824233357_pix_oauth_credentials_private.sql` | `20260824233357_pix_oauth_credentials_private` | mesmo timestamp; SQL correspondente |
| 3 | `20260824234933_pix_attempts_webhook.sql` | `20260824234933_pix_attempts_webhook` | mesmo timestamp; SQL correspondente |
| 4 | `20260825001055_pix_aggregate_integrity.sql` | `20260825001055_pix_aggregate_integrity` | mesmo timestamp; SQL correspondente |
| 5 | `20260825004851_pix_oauth_state_pkce.sql` | `20260825004851_pix_oauth_state_pkce` | mesmo timestamp; SQL correspondente |
| 6 | `20260825021917_pix_oauth_atomic_connection.sql` | `20260825021917_pix_oauth_atomic_connection` | mesmo timestamp; SQL correspondente |
| 7 | `20260825091547_criacao_financeira_atomica.sql` | `20260825091547_criacao_financeira_atomica` | mesmo timestamp; SQL correspondente |
| 8 | `20260825092700_pix_cobranca_apos_aceite.sql` | `20260825092700_pix_cobranca_apos_aceite` | mesmo timestamp; diferenças de comentários/formatação; comportamento equivalente |
| 9 | `20260825110504_pix_oauth_tentativas_motorista_index.sql` | `20260825110504_pix_oauth_tentativas_motorista_index` | mesmo timestamp; SQL correspondente |
| 10 | `20260825123937_pix_oauth_safe_disconnect.sql` | `20260825123937_pix_oauth_safe_disconnect` | mesmo timestamp; SQL correspondente |
| 11 | `20260825172410_pix_charge_failure_compensation.sql` | `20260825172410_pix_charge_failure_compensation` | mesmo timestamp; SQL correspondente |
| 12 | `20260826161000_pix_aguardando_pagamento_status.sql` | `20260826164605_pix_aguardando_pagamento_status` | **timestamp diferente; SQL idêntico** |
| 13 | `20260826161100_pix_confirmacao_pagamento_gate.sql` | `20260826164714_pix_confirmacao_pagamento_gate` | **timestamp diferente; texto/formatação diferente; comportamento equivalente** |
| 14 | `20260826161200_pix_operational_gate_keep_accept.sql` | `20260826164927_pix_operational_gate_keep_accept` | **timestamp diferente; SQL idêntico** |
| 15 | `20260826183600_pix_device_session_antifraud.sql` | `20260826184836_pix_device_session_antifraud` | **timestamp diferente; SQL idêntico** |
| 16 | `20260826201000_pix_ticket_url_diagnostics.sql` | `20260826200511_pix_ticket_url_diagnostics` | **timestamp diferente; SQL idêntico** |

---

## 5. Cinco pares de drift de histórico

Estes são os únicos cinco pares que precisam ser tratados na futura microetapa exclusiva de reconciliação do Git:

1. branch `20260826161000_pix_aguardando_pagamento_status.sql`  
   produção `20260826164605_pix_aguardando_pagamento_status`

2. branch `20260826161100_pix_confirmacao_pagamento_gate.sql`  
   produção `20260826164714_pix_confirmacao_pagamento_gate`

3. branch `20260826161200_pix_operational_gate_keep_accept.sql`  
   produção `20260826164927_pix_operational_gate_keep_accept`

4. branch `20260826183600_pix_device_session_antifraud.sql`  
   produção `20260826184836_pix_device_session_antifraud`

5. branch `20260826201000_pix_ticket_url_diagnostics.sql`  
   produção `20260826200511_pix_ticket_url_diagnostics`

**Regra:** estes objetos já estão aplicados em produção. Não reaplicar SQL para “fazer o timestamp bater”.

---

## 6. Provas das diferenças textuais sem diferença estrutural

### 6.1 Unicidade da conta Mercado Pago

A branch cria o índice único parcial explicitando `USING btree`.

O histórico de produção registra o mesmo índice com `IF NOT EXISTS` e usa o método btree padrão.

O catálogo atual do Supabase confirma o objeto final:

- índice: `idx_motoristas_conta_mercado_pago_unica`;
- tabela: `public.motoristas`;
- coluna: `conta_mercado_pago_id`;
- único;
- parcial somente quando `conta_mercado_pago_id IS NOT NULL`;
- método btree.

Portanto a diferença é textual/idempotente, não uma diferença do objeto final necessário ao Pix.

### 6.2 Cobrança após aceite

A migration `20260825092700_pix_cobranca_apos_aceite` possui o mesmo conjunto operacional no GitHub e no histórico de produção:

- valida pré-requisitos OAuth/tentativas;
- define `accept_corrida_atomic`;
- define `pix_charge_attempt_claim`;
- define `pix_charge_attempt_complete`;
- define `pix_charge_attempt_fail`;
- aplica grants/revokes previstos para a fronteira privilegiada.

A diferença de tamanho textual é explicada por comentários/documentação embutidos no arquivo Git e pequenas diferenças de formatação. O estado de catálogo necessário existe.

### 6.3 Confirmação de pagamento / gate

A migration de confirmação possui timestamps diferentes e formatação diferente entre Git e histórico de produção, mas os mesmos blocos lógicos:

- estado intermediário `aguardando_pagamento`;
- atualização de `set_motorista_online_atomic`;
- claim da tentativa Pix;
- projeção de criação/resultado do pagamento;
- `pix_payment_status_project`;
- compensação de falha;
- grants restritos a `service_role` para as RPCs financeiras.

A migration posterior `pix_operational_gate_keep_accept` substitui corretamente o trigger intermediário pelo gate final de operação.

---

## 7. Prova do estado final do catálogo

No fechamento desta etapa, o Supabase contém:

### OAuth e isolamento

- `private.motorista_mercadopago_credenciais` — RLS habilitada e forçada;
- `private.mercadopago_oauth_tentativas` — RLS habilitada e forçada;
- `private.mercadopago_webhook_eventos` — RLS habilitada e forçada;
- `public.pix_oauth_credentials_get` — execução restrita a `postgres/service_role`;
- `public.pix_oauth_credentials_upsert` — execução restrita a `postgres/service_role`;
- `public.pix_oauth_state_create` — execução restrita a `postgres/service_role`;
- `public.pix_oauth_state_consume` — execução restrita a `postgres/service_role`;
- `public.pix_oauth_disconnect_safe` — execução restrita a `postgres/service_role`.

### Pagamento Pix

- `public.pagamentos_pix_tentativas` — RLS habilitada e forçada;
- unicidade de `idempotency_key`;
- unicidade de `mercadopago_payment_id`;
- uma tentativa ativa por pagamento;
- índice de expiração de tentativas pendentes;
- `pagamentos.pago_at` presente;
- `pagamentos.estornado_at` presente;
- índice de `pagamentos(corrida_id)` presente;
- unicidade financeira por corrida presente;
- unicidade de `id_transacao_mercadopago` não nulo presente.

### Estado/gate

- enum `public.corrida_status` contém `aguardando_pagamento`;
- `pix_guard_operational_before_payment_trigger` está ativo;
- `pix_hold_corrida_until_payment_trigger` intermediário não está ativo;
- o gate final impede avanço operacional de corrida Pix antes de pagamento agregado `pago`.

### Antifraude/diagnóstico

- `public.pagamentos_pix_device_sessions` existe com RLS habilitada;
- índice de expiração de Device ID existe;
- `pagamentos_pix_tentativas.ticket_url` existe;
- `provider_error_code` existe;
- `provider_error_message` existe.

---

## 8. Conclusão técnica da 0.3

**Não existe migration lógica Pix faltante no Supabase.**

O banco já possui os efeitos finais esperados pelas 16 migrations auditadas.

Por isso:

- **não criar migration de schema para corrigir esta situação**;
- **não reaplicar nenhuma das cinco migrations com timestamp divergente**;
- **não executar `migration repair` no projeto de produção nesta microetapa**;
- **não alterar a tabela `supabase_migrations.schema_migrations` manualmente**.

O único problema restante desta área é o repositório possuir cinco filenames/version numbers que não correspondem às versões realmente registradas em produção.

---

## 9. Próxima microetapa obrigatória — 0.3R

Antes da integração `main → feature/pix-100-seguro` (0.4), criar uma microetapa exclusiva:

**ETAPA 0.3R — Reconciliação segura do histórico Git de migrations Pix.**

Objetivo único:

- fazer o diretório de migrations da branch representar os timestamps realmente aplicados em produção;
- preservar o SQL lógico já aprovado;
- impedir que ferramenta futura interprete os cinco arquivos antigos como migrations novas/não aplicadas.

### Travas da 0.3R

- zero DDL no Supabase;
- zero DML no Supabase;
- zero `migration repair` remoto;
- zero alteração de código do app;
- zero core;
- zero dinheiro/cartão;
- somente arquivos de migration dos cinco pares acima + documentação/checkpoint explicitamente permitidos;
- antes de renomear qualquer arquivo, comparar conteúdo e definir para cada par qual conteúdo canônico deve acompanhar o timestamp real de produção;
- testar em ambiente local/estático que não restou versão órfã ou duplicada;
- conferir novamente o histórico remoto somente por leitura.

A 0.4 permanece **BLOQUEADA** até a 0.3R ser aprovada.

---

## 10. Classificação

**ETAPA 0.3: APROVADA EM LEITURA.**

Motivo:

- todos os 16 blocos foram mapeados;
- todos os efeitos estruturais relevantes foram encontrados no Supabase;
- nenhum efeito de produção foi alterado;
- as cinco divergências de timestamp foram isoladas;
- a estratégia correta é reconciliação exclusiva de histórico Git, não nova migration de banco.

**Próximo portão:** ETAPA 0.3R.