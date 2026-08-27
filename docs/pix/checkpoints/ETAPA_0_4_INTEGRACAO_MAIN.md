# CHECKPOINT PIX ZUVVI — ETAPA 0.4

**Microetapa:** Integração controlada da `main` na branch Pix  
**Data:** 27/08/2026  
**Fonte da Verdade:** `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI_V2.md`  
**Checkpoint anterior:** `docs/pix/checkpoints/ETAPA_0_3R_RECONCILIACAO_HISTORICO_GIT.md`  
**Branch:** `feature/pix-100-seguro`  
**Supabase:** `qycblinfvijhfjcmdoof`  
**Classificação inicial:** EM EXECUÇÃO

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

## Rollback

Se qualquer arquivo fora da allowlist mudar, se o fluxo seguro for substituído, ou se os testes técnicos falharem por causa da integração, parar a etapa e retornar a branch ao checkpoint anterior à integração funcional. Nenhuma correção em cascata é permitida.
