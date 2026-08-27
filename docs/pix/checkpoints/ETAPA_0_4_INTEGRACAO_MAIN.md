# CHECKPOINT PIX ZUVVI — ETAPA 0.4

**Microetapa:** Integração controlada da `main` na branch Pix  
**Data:** 27/08/2026  
**Fonte da Verdade:** `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI_V2.md`  
**Checkpoint anterior:** `docs/pix/checkpoints/ETAPA_0_3R_RECONCILIACAO_HISTORICO_GIT.md`  
**Branch:** `feature/pix-100-seguro`  
**Supabase:** `qycblinfvijhfjcmdoof`  
**Classificação inicial:** EM EXECUÇÃO  
**Classificação final:** APROVADA

## Objetivo

Integrar os 12 commits da `main` ainda ausentes da branch Pix sem merge para `main`, resolvendo somente os conflitos e preservando o core recente. Em conflito Pix, manter a implementação segura da branch e incorporar apenas melhorias recentes que não reintroduzam fluxo legado.

## Baseline antes da escrita funcional

- `main`: `de4d054643f7c67f22ee9c183a84af05f0809db7`;
- branch Pix: `5186ed1b427fbdf9f771c36e4818ce90bef490b9`;
- merge base: `ae6fb274b8e61e4f0619fc2fbe819f282b2f40cd`;
- divergência: 12 commits da `main` ausentes da branch; branch 192 commits à frente da `main`;
- PR #2: aberta, draft, não mergeada, não mergeável no baseline;
- os 12 commits da `main` alteram somente 4 caminhos:
  - `.lovable/plan.md`;
  - `src/components/motorista/MercadoPagoConnect.tsx`;
  - `src/integrations/supabase/types.ts`;
  - `src/lib/motorista-pagamento.functions.ts`.

## Baseline Supabase

Consulta somente leitura antes da integração:

- tentativas Pix: 33 total;
- `falhou`: 33;
- `criando`: 0;
- `pendente`: 0;
- `pago`: 0;
- `estornado`: 0;
- credenciais OAuth: 2 total;
- ativas: 1;
- revogadas: 1;
- migration mais recente: `20260826200511_pix_ticket_url_diagnostics`.

Nenhuma escrita no Supabase é autorizada nesta etapa.

## Allowlist da integração

A árvore do merge pode diferir da branch anterior somente nos seguintes caminhos:

1. `.lovable/plan.md` — trazer exatamente da `main`; arquivo não executável e não será utilizado como agente/instrução de implementação.
2. `src/lib/motorista-pagamento.functions.ts` — trazer exatamente a versão recente da `main`, preservando o RPC `pix_oauth_disconnect_safe` e a autenticação adicional. Este arquivo permanece legado e não deve substituir o fluxo Pix seguro atual.
3. `src/components/motorista/MercadoPagoConnect.tsx` — manter exatamente a versão da branch Pix, pois usa `pix-mercadopago-oauth.functions` e já contém a confirmação visual recente da `main`.
4. `src/integrations/supabase/types.ts` — manter exatamente a versão da branch Pix, pois ela corresponde ao schema real mais novo do Supabase e inclui os objetos Pix posteriores que a `main` ainda não contém.
5. este checkpoint documental pode ser atualizado para registrar evidências e classificação.

Nenhum outro arquivo pode mudar como resolução desta integração.

## Resolução canônica dos conflitos

### MercadoPagoConnect.tsx

**Escolha:** branch Pix.

Motivo: a versão da `main` ainda importa `iniciarConexaoMercadoPago`, `getStatusConexaoMercadoPago` e `desconectarMercadoPago` do fluxo legado. A branch usa `iniciarConexaoMercadoPagoPixSegura`, `getStatusConexaoMercadoPagoPixSegura` e `desconectarMercadoPagoPixSeguro`, sem state em `sessionStorage`, e já possui o aviso para troca de conta.

### types.ts

**Escolha:** branch Pix.

Motivo: a branch inclui `pagamentos_pix_device_sessions`, campos de diagnóstico (`ticket_url`, `provider_error_code`, `provider_error_message`), `pix_payment_status_project` e o enum `aguardando_pagamento`, todos coerentes com o catálogo real auditado na Etapa 0.3.

### motorista-pagamento.functions.ts

**Escolha:** `main`.

Motivo: o arquivo é legado, mas a versão recente da `main` é mais segura que a versão antiga da branch na desconexão: usa `pix_oauth_disconnect_safe`, verifica o resultado e adiciona `attachSupabaseAuth` na chamada. O fluxo Pix seguro atual não depende dele para conectar/callback.

### .lovable/plan.md

**Escolha:** `main`.

Motivo: arquivo já versionado na `main`, sem efeito de runtime. Sua presença não autoriza uso do Lovable como agente.

## Método de integração

Criar merge commit real com dois pais:

- pai 1: head da branch Pix após este checkpoint;
- pai 2: `de4d054643f7c67f22ee9c183a84af05f0809db7` (`main`).

A árvore será construída de forma explícita, sem merge automático de arquivos conflitantes.

## Proibições

- não alterar Supabase;
- não aplicar migration;
- não alterar `main`;
- não publicar/deploy;
- não usar Lovable como agente;
- não tocar em dinheiro, cartão, GPS, mapas, tarifas, matching, autenticação geral ou outro core;
- não reintroduzir OAuth legado no componente/callback seguro;
- não modificar lockfile/dependências nesta etapa.

## Testes obrigatórios após o merge

1. comparar parent da branch versus merge e confirmar somente os caminhos permitidos;
2. confirmar `main` como segundo pai do merge;
3. confirmar que `MercadoPagoConnect.tsx` permaneceu byte a byte igual à versão segura da branch;
4. confirmar que `types.ts` permaneceu byte a byte igual à versão da branch;
5. confirmar que `motorista-pagamento.functions.ts` ficou byte a byte igual à `main`;
6. confirmar `.lovable/plan.md` igual à `main`;
7. verificar que a branch ficou `behind_by = 0` em relação à `main`;
8. TypeScript/build e bateria Pix disponível via CI/execução local controlada;
9. reconsultar Supabase e provar baseline inalterado;
10. manter PR draft e sem merge para `main`.

## Resultado do primeiro CI após o merge

Merge controlado criado em:

`5ef467c7ea9ace6004dd34c3ab02f8a5dfadfa15`

O merge preservou `MercadoPagoConnect.tsx` e `types.ts` da branch Pix, trouxe `motorista-pagamento.functions.ts` e `.lovable/plan.md` da `main`, e deixou a branch com `behind_by = 0` em relação à `main`.

Foram disparados 13 workflows Pix: 9 passaram e 4 falharam. As quatro falhas foram investigadas antes de qualquer correção:

1. **PIX Pagamento passageiro** — falha somente de Prettier em `src/lib/pagamento-pix-status.functions.ts`; arquivo não foi tocado pelo merge.
2. **PIX OAuth Crypto** — testes criptográficos, TypeScript e build passaram; falha somente na guarda de isolamento porque `src/lib/pix-payment-sync.server.ts` importa legitimamente e de forma server-only `pix-oauth-crypto.server` para renovar credenciais durante reconciliação de pagamento.
3. **PIX Mercado Pago OAuth Client** — 10/10 testes OAuth, regressão crypto, ESLint, TypeScript e build passaram; falha somente na mesma guarda de isolamento porque `src/lib/pix-payment-sync.server.ts` importa legitimamente e de forma server-only `pix-mercadopago-oauth.server` para refresh token.
4. **PIX DB OAuth Atomic Connection** — toda a bateria pgTAP, lint/advisors, testes OAuth, TypeScript e build passou; falha no último guard por hash SHA-256 rígido e antigo de `src/lib/motorista-pagamento.functions.ts`, que foi intencionalmente substituído pela versão exata da `main` durante esta integração.

Nenhuma das quatro falhas demonstrou regressão funcional do Pix ou do core. Elas demonstraram dívida de higiene/guardas da própria bateria Pix.

## Submicroetapa 0.4F — saneamento mínimo da bateria CI Pix

### Objetivo único

Fazer a bateria refletir a arquitetura Pix já existente e a baseline integrada, sem alterar comportamento funcional.

### Allowlist 0.4F

Somente estes arquivos podem ser alterados:

1. `src/lib/pagamento-pix-status.functions.ts` — **somente formatação Prettier**, sem alteração lógica.
2. `.github/workflows/pix-oauth-crypto.yml` — incluir `src/lib/pix-payment-sync.server.ts` como consumidor server-only autorizado e como path que dispara o workflow.
3. `.github/workflows/pix-mercadopago-oauth.yml` — incluir `src/lib/pix-payment-sync.server.ts` como consumidor server-only autorizado e como path que dispara o workflow.
4. `.github/workflows/pix-db-oauth-atomic-connection.yml` — substituir somente o hash rígido e obsoleto de `src/lib/motorista-pagamento.functions.ts` por uma comparação com a versão canônica de `origin/main`, já buscada no próprio step; nenhuma flexibilização de package/lock permitida.
5. `docs/pix/checkpoints/ETAPA_0_4_INTEGRACAO_MAIN.md` — registrar evidências e classificação.

### Explicitamente proibido na 0.4F

- modificar `src/lib/pix-payment-sync.server.ts`;
- modificar qualquer lógica OAuth, pagamento, cobrança ou corrida;
- modificar `package.json` ou `bun.lock`;
- modificar migrations, RPCs, tabelas ou dados;
- escrever no Supabase;
- alterar `main`;
- tocar em arquivo não listado acima.

### Critério de aprovação 0.4F

- diff restrito integralmente à allowlist;
- a alteração no `.functions.ts` ser somente de whitespace/formatação;
- as duas guardas de isolamento continuarem proibindo qualquer consumidor não autorizado;
- o guard do arquivo legado exigir igualdade exata com `origin/main` em vez de aceitar qualquer conteúdo;
- CI Pix do novo SHA ficar verde ou qualquer falha residual ser comprovadamente externa/transitória e repetida com sucesso;
- TypeScript e build continuarem passando;
- Supabase permanecer byte/logicamente no mesmo baseline operacional;
- `main` permanecer inalterada e PR continuar draft/não mergeada.

## Evidências finais da 0.4F

Head funcional validado antes deste fechamento documental:

`36f43aa0710998cefd21d3b2c18d96c989f0c866`

Comparação contra o checkpoint de autorização `2aab388090ef198b1a968e550f74f1a4f0c65eb3`:

- 6 commits de saneamento;
- exatamente 4 arquivos funcionais/configuração alterados;
- nenhum arquivo fora da allowlist;
- `.github/workflows/pix-db-oauth-atomic-connection.yml`: 4 adições e 1 remoção;
- `.github/workflows/pix-mercadopago-oauth.yml`: 2 adições;
- `.github/workflows/pix-oauth-crypto.yml`: 2 adições;
- `src/lib/pagamento-pix-status.functions.ts`: 1 adição e 3 remoções, somente colapso/formatação Prettier do `import()` dinâmico, sem mudança lógica.

As duas guardas OAuth agora:

- reconhecem `src/lib/pix-payment-sync.server.ts` exclusivamente como consumidor server-only autorizado;
- continuam falhando para qualquer outro consumidor não listado;
- disparam novamente quando `src/lib/pix-payment-sync.server.ts` for alterado.

O guard OAuth atômico não usa mais hash congelado do arquivo legado. Em vez disso, exige igualdade byte a byte de `src/lib/motorista-pagamento.functions.ts` com `origin/main` via `cmp -s`, falhando se houver qualquer divergência.

## CI final

No SHA `36f43aa0710998cefd21d3b2c18d96c989f0c866`, os 13 workflows Pix foram executados novamente e todos concluíram com `success`:

1. PIX OAuth Crypto;
2. PIX Mercado Pago OAuth Client;
3. PIX Pagamento passageiro;
4. PIX DB Attempts and Webhook Events;
5. PIX DB Aggregate Integrity;
6. PIX DB OAuth State and PKCE;
7. PIX Cobrança após aceite;
8. PIX DB Mercado Pago Account Uniqueness;
9. PIX Criação Financeira Atômica;
10. PIX DB OAuth FK Index;
11. PIX Compensação falha de cobrança;
12. PIX DB Foundation;
13. PIX DB OAuth Atomic Connection.

O workflow de Pagamento passageiro confirmou Prettier, testes exclusivos, ESLint, TypeScript, build e guardas. Os workflows OAuth confirmaram novamente testes, TypeScript e build. O workflow OAuth Atomic Connection confirmou migrations/fixtures somente na stack local descartável, pgTAP, lint/advisors, regressões OAuth, TypeScript/build e os guards finais.

## Contraprova Git final

- `main` continua exatamente em `de4d054643f7c67f22ee9c183a84af05f0809db7`;
- branch Pix está `behind_by = 0` e 201 commits à frente da `main` antes deste commit documental;
- PR #2 continua aberta;
- PR #2 continua `draft`;
- PR #2 continua não mergeada;
- após a resolução controlada dos conflitos, GitHub reporta a PR como `mergeable = true`, sem executar merge.

## Contraprova Supabase final

Consulta somente leitura após todo o saneamento e CI:

- tentativas Pix: 33 total;
- `falhou`: 33;
- `criando`: 0;
- `pendente`: 0;
- `pago`: 0;
- `estornado`: 0;
- credenciais OAuth: 2 total;
- ativas: 1;
- revogadas: 1;
- migration mais recente permanece `20260826200511_pix_ticket_url_diagnostics`.

O baseline é idêntico ao início da Etapa 0.4. Nenhuma migration, RPC, tabela, credencial ou dado foi alterado no Supabase principal por esta etapa.

## Decisão

**ETAPA 0.4 — APROVADA.**

A `main` foi integrada de forma controlada na branch Pix; a branch não está atrasada em relação à `main`; o fluxo Pix seguro foi preservado; a bateria CI foi reconciliada sem mudança de regra de negócio; os 13 workflows estão verdes; o Supabase principal permaneceu inalterado; e a PR permanece draft e não mergeada.

A próxima etapa só pode começar a partir deste checkpoint aprovado e deve abrir nova allowlist antes de qualquer escrita funcional.

## Rollback

Se qualquer arquivo fora da allowlist mudar, se o fluxo seguro for substituído, ou se os testes técnicos falharem por causa da integração, parar a etapa e retornar a branch ao checkpoint anterior à integração funcional. Nenhuma correção em cascata é permitida.
