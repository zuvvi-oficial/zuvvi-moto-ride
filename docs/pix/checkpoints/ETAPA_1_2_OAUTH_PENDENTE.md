# CHECKPOINT PIX ZUVVI — ETAPA 1.2

**Microetapa:** OAuth em estado pendente  
**Data:** 27/08/2026  
**Fonte da Verdade:** `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI_V2.md`  
**Checkpoint anterior:** `docs/pix/checkpoints/ETAPA_1_1_PROPRIEDADE_HISTORICA_MP.md`  
**Branch:** `feature/pix-100-seguro`  
**Supabase:** `qycblinfvijhfjcmdoof`  
**Classificação inicial:** EM EXECUÇÃO

## Objetivo único

Impedir que o retorno do OAuth Mercado Pago ative automaticamente a conta recebedora do motorista.

Fluxo alvo desta microetapa:

`OAuth autorizado -> validar state/PKCE -> trocar code -> cifrar tokens -> validar propriedade existente -> persistir autorização pendente com prazo curto -> NÃO ativar conta`.

A confirmação explícita e a ativação definitiva ficam para a Etapa 1.3.

## Baseline

- Etapa 1.1 aprovada;
- branch após 1.1: `a6e6070709a63b408ecae5da472567f0af9fd7ac`;
- `main` permanece congelada;
- produção possui 2 credenciais OAuth: 1 ativa e 1 revogada;
- produção possui 1 propriedade histórica, correspondente à credencial ativa;
- o callback atual chama `completeConnection`, que hoje termina em `pix_oauth_credentials_upsert` e ativa a conta imediatamente;
- a tela de callback atual anuncia "Conta Mercado Pago conectada" logo após essa chamada.

## Decisão de segurança

A 1.2 NÃO usará `pix_oauth_account_owner_claim` para uma conta nova, porque uma autorização ainda não confirmada não deve criar propriedade histórica permanente.

A persistência pendente fará apenas uma checagem não destrutiva:

- se a conta já pertence historicamente a outro motorista: rejeitar;
- se pertence ao mesmo motorista: permitir pendência;
- se ainda não possui proprietário histórico: permitir pendência sem reivindicar;
- a reivindicação definitiva ocorrerá somente na 1.3, no momento da confirmação explícita.

## Modelo pendente

Nova tabela privada temporária:

`private.motorista_mercadopago_autorizacoes_pendentes`

Regras:

- uma autorização pendente por motorista;
- uma mesma conta Mercado Pago não pode ficar pendente simultaneamente para dois motoristas;
- tokens permanecem cifrados;
- nenhuma projeção é feita em `public.motoristas`;
- nenhuma credencial ativa é criada/alterada;
- prazo de confirmação: 10 minutos;
- pendência expirada pode ser substituída/limpa pelo servidor;
- `anon` e `authenticated` não acessam tabela nem RPC;
- `service_role` usa apenas RPC server-only, sem CRUD direto na tabela.

## Allowlist 1.2

1. `docs/pix/checkpoints/ETAPA_1_2_OAUTH_PENDENTE.md`;
2. `supabase/migrations/20260827193000_pix_oauth_pending_authorization.sql` (nome provisório até versão canônica de produção);
3. `supabase/tests/pix_12_oauth_pending_authorization.sql`;
4. `src/lib/pix-mercadopago-oauth-flow.server.ts`;
5. `src/lib/pix-mercadopago-oauth-supabase.server.ts`;
6. `src/lib/pix-mercadopago-oauth-runtime.server.ts`;
7. `src/routes/motorista.mercadopago-callback.tsx`;
8. `scripts/pix/pix-mercadopago-oauth-flow.test.ts`;
9. `scripts/pix/pix-mercadopago-oauth-functions.test.ts`;
10. `.github/workflows/pix-db-oauth-atomic-connection.yml`.

## Proibido

- alterar `MercadoPagoConnect.tsx` nesta microetapa;
- implementar confirmação/ativação da 1.3 antecipadamente;
- alterar `pix_oauth_credentials_upsert` da 1.1;
- alterar lógica de pagamentos, split ou `application_fee`;
- alterar corrida, dinheiro, cartão ou core;
- alterar migrations antigas;
- alterar `main`;
- usar Lovable como agente;
- aplicar migration em produção antes do CI local passar.

## Testes obrigatórios

1. tabela pendente privada existe;
2. RLS habilitada e forçada;
3. sem CRUD direto para `anon`, `authenticated` e `service_role`;
4. RPC pendente executável apenas por `service_role`;
5. motorista inexistente rejeitado;
6. conta historicamente de outro motorista rejeitada;
7. conta historicamente do mesmo motorista permitida;
8. conta sem proprietário permitida sem criar propriedade histórica;
9. tokens persistidos apenas cifrados;
10. callback OAuth não cria/reativa credencial ativa;
11. callback OAuth não atualiza `motoristas.conta_mercado_pago_id`;
12. retorno do OAuth produz estado `pending`;
13. state continua single-use;
14. outra identidade autenticada não consome state alheio;
15. pendência expira em 10 minutos;
16. mesma MP não fica pendente para dois motoristas simultaneamente;
17. regressões OAuth, pgTAP, TypeScript, lint e build permanecem verdes;
18. diff restrito à allowlist.

## Portão para produção

Somente após CI verde. Depois da aplicação real, revalidar migration history, tabela/RLS/grants, ausência de mudança nas credenciais ativas, ausência de mudança em `motoristas.conta_mercado_pago_id`, contagens financeiras e core.
