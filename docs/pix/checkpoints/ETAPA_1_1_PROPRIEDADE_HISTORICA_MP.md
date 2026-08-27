# CHECKPOINT PIX ZUVVI — ETAPA 1.1

**Microetapa:** Propriedade histórica da conta Mercado Pago  
**Data:** 27/08/2026  
**Fonte da Verdade:** `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI_V2.md`  
**Checkpoint anterior:** `docs/pix/checkpoints/ETAPA_0_4_INTEGRACAO_MAIN.md`  
**Branch:** `feature/pix-100-seguro`  
**Supabase:** `qycblinfvijhfjcmdoof`  
**Classificação final:** APROVADA

## Objetivo

Criar propriedade histórica privada `mercadopago_user_id -> motorista_id`, impedindo que uma conta Mercado Pago já pertencente a um motorista Zuvvi seja apropriada por outro motorista depois de desconexão/revogação.

Esta microetapa não altera ainda a experiência de confirmação OAuth. O fluxo pendente e a confirmação explícita pertencem às Etapas 1.2 e 1.3.

## Baseline antes da escrita

- `main`: `de4d054643f7c67f22ee9c183a84af05f0809db7`;
- branch após Etapa 0.4: `49e5df7713cadd10c685f9448423581699634ad6`;
- branch 0 commits atrás da `main`;
- PR #2 aberta, draft e não mergeada;
- Supabase: 2 credenciais OAuth, sendo 1 ativa e 1 revogada;
- 2 motoristas e 2 `mercadopago_user_id` distintos nos registros existentes;
- 0 conflitos históricos detectados;
- unicidade pública anterior válida apenas enquanto `conta_mercado_pago_id` não era nulo;
- unicidade privada anterior válida apenas enquanto `connection_status = 'active'`;
- `pix_oauth_credentials_upsert` anterior não preservava propriedade histórica.

## Decisão de backfill

A credencial revogada preexistente veio do caso conhecido de conexão errada em teste, no qual uma sessão Mercado Pago já aberta foi reaproveitada.

Para não eternizar um vínculo incorreto:

- backfill automático somente das credenciais `active` no momento da migration;
- credenciais `revoked` anteriores à Etapa 1.1 não são apropriadas automaticamente;
- toda nova ativação posterior à migration reivindica propriedade antes de persistir credenciais;
- bloqueio da conta da própria plataforma/integrador fica para a Etapa 1.3.

## Implementação aprovada

### Tabela privada

Criada:

`private.mercadopago_conta_propriedade`

Campos:

- `mercadopago_user_id text` — chave primária permanente;
- `motorista_id uuid` — proprietário histórico Zuvvi;
- `claimed_at timestamptz`;
- `last_seen_at timestamptz`.

Não contém Access Token, Refresh Token, Client Secret, Service Role ou qualquer outro segredo.

### Decisão deliberada: sem FK para motorista

`motorista_id` não possui FK para `public.motoristas`.

Motivo:

- `ON DELETE RESTRICT` mudaria o comportamento do core na exclusão de motorista;
- `ON DELETE CASCADE` destruiria a própria reserva histórica;
- existência do motorista é validada no RPC server-only no momento da reivindicação.

Assim a propriedade histórica sobrevive sem alterar o ciclo de vida do cadastro do core.

### RPC de propriedade

Criado:

`public.pix_oauth_account_owner_claim(uuid, text)`

Estados possíveis:

- `claimed` — primeira propriedade;
- `owned_by_same_motorista` — mesma conta e mesmo proprietário;
- `owned_by_other_motorista` — conta já pertencente a outro motorista.

A função:

- é `SECURITY DEFINER`;
- possui `search_path` fixo;
- só pode ser executada por `service_role`;
- valida existência do motorista;
- não oferece operação de transferência ou liberação;
- não expõe dados ao navegador.

### Proteção no upsert OAuth

`public.pix_oauth_credentials_upsert(...)` foi substituída preservando o comportamento anterior, mas agora reivindica/valida propriedade antes da ativação.

Se a conta pertencer historicamente a outro motorista, aborta com:

`PIX_MP_ACCOUNT_OWNED_BY_OTHER_MOTORISTA`

Desconectar/revogar credenciais não remove a propriedade histórica.

## Migration canônica

A migration foi primeiro testada na branch com um nome provisório. Após aprovação do CI, foi aplicada ao Supabase pelo fluxo oficial `apply_migration`.

O Supabase registrou a versão canônica:

`20260827190752_pix_mp_account_historical_ownership`

O GitHub foi imediatamente reconciliado para o mesmo timestamp, sem reaplicar SQL.

Arquivo canônico final:

`supabase/migrations/20260827190752_pix_mp_account_historical_ownership.sql`

O arquivo provisório foi removido. Portanto esta etapa não deixa novo drift de histórico Git/Supabase.

## Allowlist final comprovada

Comparação desde o checkpoint aprovado da Etapa 0.4 mostrou exatamente 4 caminhos alterados:

1. `docs/pix/checkpoints/ETAPA_1_1_PROPRIEDADE_HISTORICA_MP.md`;
2. `supabase/migrations/20260827190752_pix_mp_account_historical_ownership.sql`;
3. `supabase/tests/pix_11_mp_account_historical_ownership.sql`;
4. `.github/workflows/pix-db-mercadopago-account-uniqueness.yml`.

Nenhum `.tsx`, callback OAuth, pagamento, corrida, dinheiro, cartão, GPS, mapa, tarifa, matching, autenticação geral ou outro core foi alterado.

## Teste local/CI

### Primeiro ciclo

A migration foi aplicada com sucesso na stack local e o teste antigo de unicidade passou 10/10.

O teste novo obteve 35/37 inicialmente. As duas falhas foram causadas somente pelo fixture local não reproduzir um grant já existente em produção: `service_role` precisava `SELECT, UPDATE` em `public.motoristas` para o upsert atômico atualizar sua projeção pública.

Nenhum SQL funcional da migration precisou ser alterado por essa falha.

Foi corrigido somente o fixture inline do workflow para reproduzir a permissão real de produção.

### Segundo ciclo

No SHA `5b53db52ea3d1944d861c8f7495e27098f907a7c`:

- 37/37 testes de propriedade histórica passaram;
- teste anterior de unicidade passou;
- regressões pgTAP PIX-01 a PIX-04 passaram;
- DB lint passou;
- advisors security/performance passaram;
- regressões OAuth PIX-05/PIX-06 passaram;
- TypeScript integral passou;
- build de produção passou;
- guardas de dependência/lockfile passaram;
- 13/13 workflows Pix ficaram verdes.

### Terceiro ciclo — timestamp canônico

Depois de alinhar o nome da migration à versão real `20260827190752`, o CI foi executado novamente no SHA `0264dc22edce23d7412328a5ae9a54d625bedec2`.

Resultado final:

- 13/13 workflows Pix concluídos com `success`;
- workflow de propriedade histórica concluiu migration local, 37 testes, regressões, advisors, TypeScript e build com sucesso;
- Cobrança após aceite, OAuth Atomic Connection, OAuth Client, OAuth Crypto, Passageiro e todos os demais workflows Pix também permaneceram verdes.

## Aplicação em produção

A migration foi aplicada com sucesso no Supabase de produção via fluxo de migration controlado.

Migration registrada:

- versão: `20260827190752`;
- nome: `pix_mp_account_historical_ownership`.

Não houve execução de migration antiga, repair de histórico ou DDL adicional fora desta migration.

## Auditoria pós-produção

### Dados

Após a aplicação:

- credenciais OAuth: 2 total;
- ativas: 1;
- revogadas: 1;
- propriedades históricas: 1;
- contas MP históricas distintas: 1;
- motoristas históricos distintos: 1;
- propriedade correspondente à credencial ativa: 1;
- propriedade correspondente à credencial revogada antiga: 0.

Isto comprova que o backfill ativo ocorreu e o vínculo revogado de teste não foi eternizado.

### Dados financeiros preservados

Continuaram exatamente:

- tentativas Pix: 33;
- `falhou`: 33;
- `pendente`: 0;
- `pago`: 0;
- `estornado`: 0.

A migration não modificou tentativas financeiras existentes.

### Segurança da tabela

Confirmado em produção:

- RLS habilitada;
- RLS forçada;
- `anon`: sem SELECT;
- `authenticated`: sem SELECT;
- `service_role`: sem SELECT direto;
- `service_role`: sem INSERT direto;
- `service_role`: sem UPDATE direto;
- `service_role`: sem DELETE direto.

A escrita ocorre exclusivamente pela função server-only autorizada.

### Segurança das funções

Confirmado em produção:

- `service_role` pode executar `pix_oauth_account_owner_claim`;
- `authenticated` não pode executar;
- `anon` não pode executar;
- função de claim é `SECURITY DEFINER`;
- `search_path` está fixo;
- `pix_oauth_credentials_upsert` contém a trava histórica e rejeita conta pertencente a outro motorista.

### Contraprova real sem transferência

Foi consultada a propriedade histórica existente e chamada a função de claim com outro motorista existente.

Resultado:

`owned_by_other_motorista`

Nenhuma transferência ocorreu e nenhuma credencial foi ativada nesse teste.

## Estado Git/PR/core no fechamento

- `main` continua em `de4d054643f7c67f22ee9c183a84af05f0809db7`;
- branch Pix permanece 0 commits atrás da `main`;
- PR #2 continua aberta, draft e não mergeada;
- nenhum arquivo fora da allowlist final da 1.1 entrou no diff da etapa;
- core permanece congelado.

## Critérios da 1.1

- propriedade privada permanente: PASS;
- isolamento entre motoristas: PASS;
- reconexão pelo mesmo proprietário permitida: PASS;
- apropriação por outro motorista bloqueada: PASS;
- revogação não libera propriedade: PASS;
- backfill apenas de vínculo ativo confiável: PASS;
- RLS/grants mínimos: PASS;
- sem segredo na tabela histórica: PASS;
- migration Git/Supabase reconciliada: PASS;
- CI final 13/13: PASS;
- core intocado: PASS.

# CLASSIFICAÇÃO FINAL: APROVADA

A Microetapa 1.1 está encerrada e libera a Microetapa 1.2 — OAuth em estado pendente.

## Próximo portão: Etapa 1.2

A 1.2 deverá impedir ativação imediata no callback OAuth.

Fluxo alvo:

`OAuth autorizado -> validar state/PKCE -> trocar code -> cifrar tokens -> identificar MP -> validar propriedade -> persistir autorização pendente com prazo curto -> NÃO ativar conta ainda`.

A confirmação explícita e ativação definitiva ficam para a Etapa 1.3.
