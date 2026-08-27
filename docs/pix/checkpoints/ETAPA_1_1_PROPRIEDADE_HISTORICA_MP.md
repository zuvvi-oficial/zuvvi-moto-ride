# CHECKPOINT PIX ZUVVI — ETAPA 1.1

**Microetapa:** Propriedade histórica da conta Mercado Pago  
**Data:** 27/08/2026  
**Fonte da Verdade:** `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI_V2.md`  
**Checkpoint anterior:** `docs/pix/checkpoints/ETAPA_0_4_INTEGRACAO_MAIN.md`  
**Branch:** `feature/pix-100-seguro`  
**Supabase:** `qycblinfvijhfjcmdoof`  
**Classificação inicial:** EM EXECUÇÃO

## Objetivo único

Criar a propriedade histórica privada `mercadopago_user_id -> motorista_id` para impedir que uma mesma conta Mercado Pago, depois de pertencente a um motorista Zuvvi, seja apropriada por outro motorista após desconexão/revogação.

Esta microetapa NÃO altera ainda a experiência de confirmação do OAuth. O fluxo pendente/confirmado pertence às Etapas 1.2 e 1.3.

## Baseline comprovado antes da escrita

- `main`: `de4d054643f7c67f22ee9c183a84af05f0809db7`;
- branch Pix após Etapa 0.4 aprovada: `49e5df7713cadd10c685f9448423581699634ad6`;
- branch está 0 commits atrás da `main`;
- PR #2 permanece aberta, draft e não mergeada;
- Supabase possui 2 registros de credenciais OAuth: 1 ativo e 1 revogado;
- existem 2 motoristas e 2 `mercadopago_user_id` distintos nos registros atuais;
- 0 conflitos históricos detectados entre os registros existentes;
- a unicidade pública atual é parcial: só protege `motoristas.conta_mercado_pago_id` quando não nulo;
- a unicidade privada atual é parcial: só protege `mercadopago_user_id` quando `connection_status = 'active'`;
- o RPC atual `pix_oauth_credentials_upsert` permite trocar o `mercadopago_user_id` do mesmo motorista e não registra propriedade histórica.

## Decisão sobre o backfill

Existe uma credencial revogada originada do teste conhecido em que a Cardápio Mix autorizou/reconectou uma conta Mercado Pago errada pela sessão já aberta no navegador.

Para não transformar um vínculo de teste incorreto em propriedade histórica permanente:

- o backfill automático da Etapa 1.1 será feito SOMENTE a partir de credenciais `active` no momento da migration;
- credenciais preexistentes `revoked` não serão apropriadas automaticamente;
- a partir da nova migration, toda nova ativação via `pix_oauth_credentials_upsert` deverá reivindicar a propriedade antes de persistir a credencial;
- a conta da plataforma/integrador será tratada explicitamente na Etapa 1.3 e não será hardcoded nesta migration.

## Modelo aprovado para teste

Nova tabela privada mínima:

`private.mercadopago_conta_propriedade`

Campos:

- `mercadopago_user_id text` — chave primária permanente;
- `motorista_id uuid` — proprietário Zuvvi;
- `claimed_at timestamptz`;
- `last_seen_at timestamptz`.

Não conterá Access Token, Refresh Token, Client Secret, Service Role ou qualquer outro segredo.

### Decisão de integridade deliberada

`motorista_id` NÃO terá FK com `public.motoristas` nesta etapa.

Motivo: uma FK com `ON DELETE RESTRICT` alteraria o comportamento do core ao excluir motorista; uma FK com `CASCADE` apagaria justamente o histórico que precisamos preservar. A existência do motorista será validada pelo RPC server-only no momento da reivindicação. Assim a reserva histórica sobrevive ao ciclo de vida do cadastro sem alterar deleção do core.

## Regra da propriedade

A reivindicação retorna apenas um dos estados:

- `claimed` — primeira propriedade registrada;
- `owned_by_same_motorista` — reconexão/uso pelo mesmo proprietário;
- `owned_by_other_motorista` — conta já pertence historicamente a outro motorista.

O RPC de credenciais deve rejeitar a ativação quando a reivindicação retornar `owned_by_other_motorista`.

Desconectar NÃO apaga a propriedade histórica.

Não será criada nesta etapa função de liberação/transferência. Eventual liberação futura será processo administrativo separado e auditado.

## Allowlist 1.1

Somente estes caminhos podem mudar:

1. `docs/pix/checkpoints/ETAPA_1_1_PROPRIEDADE_HISTORICA_MP.md`;
2. `supabase/migrations/20260827185500_pix_mp_account_historical_ownership.sql`;
3. `supabase/tests/pix_11_mp_account_historical_ownership.sql`;
4. `.github/workflows/pix-db-mercadopago-account-uniqueness.yml`.

## Proibido

- alterar qualquer arquivo `.tsx`/UI;
- alterar callback OAuth nesta microetapa;
- alterar arquivos TypeScript de pagamento/corrida;
- alterar migrations antigas;
- alterar dinheiro/cartão;
- alterar GPS, mapa, tarifa, matching ou autenticação geral;
- alterar `main`;
- usar Lovable como agente;
- aplicar DDL/DML no Supabase de produção antes do CI local passar;
- adicionar segredo ou identificador sensível ao Git.

## Testes obrigatórios antes da produção

1. tabela privada existe;
2. RLS habilitada e forçada;
3. `anon` e `authenticated` sem acesso ao schema/tabela/RPC;
4. `service_role` possui somente operações necessárias;
5. `service_role` não recebe DELETE na tabela histórica;
6. backfill inclui conexão ativa preexistente;
7. backfill não inclui conexão revogada preexistente;
8. Motorista A + MP A: primeira reivindicação aceita;
9. Motorista A + MP A novamente: aceita como mesmo proprietário;
10. Motorista B + MP A: rejeitado;
11. Motorista B + MP B: permitido;
12. revogar credencial de A não apaga propriedade MP A;
13. B continua bloqueado de MP A após a revogação;
14. `pix_oauth_credentials_upsert` não consegue ativar para B uma MP historicamente de A;
15. TypeScript/build e regressões Pix do workflow continuam verdes;
16. diff integralmente restrito à allowlist.

## Portão para produção

A migration só poderá ser aplicada no Supabase real depois de todos os testes locais/CI acima passarem.

Depois da aplicação real, revalidar:

- migration history;
- tabela/índices/RLS/grants;
- backfill ativo esperado;
- credencial revogada preexistente não apropriada;
- função de reivindicação;
- função de upsert protegida;
- contagens de tentativas Pix e credenciais inalteradas;
- ausência de mudança no core.

## Rollback

Se o CI demonstrar regressão, não aplicar a migration em produção e corrigir apenas dentro da allowlist.

Se houver conflito inesperado no backfill de produção, parar a aplicação; não apagar nem transferir propriedade automaticamente.
