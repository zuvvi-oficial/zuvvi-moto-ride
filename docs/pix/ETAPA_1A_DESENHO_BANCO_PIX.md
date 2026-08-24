# ETAPA 1A — DESENHO DO BANCO PIX ZUVVI

**Status:** desenho técnico; não executável; nenhuma migration criada ou aplicada  
**Data:** 24/08/2026  
**Branch:** `feature/pix-100-seguro`  
**Commit-base:** `ae6fb274b8e61e4f0619fc2fbe819f282b2f40cd`  
**Fonte da Verdade:** versão 1.4  

## 1. Escopo desta microetapa

Esta microetapa cria somente este documento. O banco principal foi consultado apenas em leitura.

Nenhuma alteração foi realizada em:

- tabelas, colunas ou dados;
- RLS, grants ou policies;
- triggers ou funções SQL;
- migrations;
- Edge Functions;
- código do aplicativo;
- arquivos do core.

O ambiente atual não possui Supabase CLI nem Docker. Portanto, seguindo a regra de segurança, nenhum arquivo de migration foi inventado manualmente e nenhum SQL deste documento está autorizado para execução.

## 2. Evidências do estado atual

### 2.1 Estruturas e extensões

- Schemas relevantes existentes: `public` e `vault`.
- Schema `private`: inexistente.
- Extensões disponíveis: `pgcrypto` e `supabase_vault`.
- Edge Functions existentes: nenhuma.
- Última migration aplicada: `20260824222419`.

### 2.2 `public.pagamentos`

Colunas atuais:

- `id uuid` PK;
- `corrida_id uuid` FK para `corridas`, com cascade;
- `meio forma_pagamento`;
- `valor_total numeric`;
- `valor_motorista numeric`;
- `valor_comissao numeric`;
- `status pagamento_status`;
- `id_transacao_mercadopago text`;
- `created_at` e `updated_at`.

Integridade verificada:

- zero valores negativos;
- zero divergências entre total e soma de motorista + comissão;
- zero corridas Pix com pagamento duplicado;
- zero IDs Mercado Pago duplicados;
- FK `pagamentos.corrida_id` sem índice de cobertura;
- não existe unicidade por corrida;
- não existe unicidade em `id_transacao_mercadopago`.

RLS atual:

- existe somente policy `SELECT` para passageiro ou motorista pertencente à corrida;
- não existem policies de escrita para usuários;
- a aplicação faz escritas financeiras pelo servidor.

Privilégios atuais de `pagamentos` são mais amplos do que o necessário para `anon` e `authenticated`, embora a ausência de policies de escrita mantenha o bloqueio por RLS. Essa configuração é preexistente e não será corrigida nesta etapa para evitar alteração lateral. As tabelas Pix novas nascerão com privilégios mínimos.

### 2.3 Motorista e Mercado Pago

- `motoristas.conta_mercado_pago_id text` existe e é nullable;
- índice parcial único impede a mesma conta Mercado Pago em mais de um motorista;
- nenhum token OAuth é armazenado;
- não existem validade, escopo, refresh token ou estado real da conexão.

### 2.4 Função de aceite

`public.accept_corrida_atomic(uuid, uuid)`:

- é `SECURITY DEFINER`;
- possui `search_path` fixo;
- execução revogada de `PUBLIC`, `anon` e `authenticated`;
- execução concedida somente a `service_role`;
- bloqueia motorista e aceita corrida atomicamente;
- ainda não valida credencial Pix dentro da transação.

A função não será alterada na fundação do banco. O gancho Pix será desenhado e testado em microetapa própria.

### 2.5 Advisors

- Os advisors registram avisos preexistentes de segurança e performance fora do Pix.
- Nenhum deles será corrigido por aproveitamento de escopo.
- O aviso diretamente relevante ao Pix é a FK não indexada `pagamentos.corrida_id`; o índice será incluído no desenho futuro.

## 3. Decisão de armazenamento de credenciais

Será criado um schema `private`, não exposto aos clientes. O servidor criptografará Access Token e Refresh Token antes do banco usando AES-256-GCM e uma chave exclusiva de ambiente.

O banco armazenará somente envelopes criptografados versionados. Não armazenará token OAuth em texto puro.

Motivos:

- compatibilidade com o cliente de servidor já usado pelo projeto;
- nenhuma chave de criptografia no banco ou navegador;
- separação entre identidade pública da conta e credenciais secretas;
- possibilidade de rotação futura do formato criptográfico;
- redução do impacto caso uma consulta administrativa exponha dados indevidamente.

O schema `vault` disponível não será adotado nesta primeira arquitetura. Usá-lo exigiria funções privilegiadas específicas e ampliaria a superfície de mudança. A decisão pode ser revista somente por nova versão da Fonte da Verdade.

## 4. Divisão da fundação em migrations pequenas

Quando houver ambiente autorizado, a Supabase CLI deverá criar os arquivos oficiais. Os nomes abaixo são nomes lógicos, não timestamps inventados.

### Migration lógica PIX-01 — credenciais OAuth privadas

Responsabilidades:

- criar schema `private`;
- revogar acesso de `PUBLIC`, `anon` e `authenticated`;
- conceder apenas o mínimo necessário a `service_role`;
- criar `private.motorista_mercadopago_credenciais`;
- habilitar RLS como defesa em profundidade;
- criar funções `SECURITY INVOKER` exclusivas da `service_role` para gravar, consultar e revogar envelopes criptografados.

Tabela proposta:

```text
private.motorista_mercadopago_credenciais
  motorista_id uuid primary key
  mercadopago_user_id text not null unique
  access_token_encrypted text not null
  refresh_token_encrypted text not null
  encryption_version smallint not null default 1
  expires_at timestamptz not null
  scope text null
  token_type text null
  connection_status text not null
  connected_at timestamptz not null default now()
  last_refreshed_at timestamptz null
  revoked_at timestamptz null
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
```

Constraints planejadas:

- FK `motorista_id -> public.motoristas(id) ON DELETE CASCADE`;
- `connection_status IN ('active','revoked','error')`;
- `encryption_version > 0`;
- `revoked_at` obrigatório quando status for `revoked`;
- índice em `expires_at` somente para conexões ativas;
- índice da FK já coberto pela PK.

Funções de acesso planejadas:

- `public.pix_oauth_credentials_upsert(...)`;
- `public.pix_oauth_credentials_get(uuid)`;
- `public.pix_oauth_credentials_revoke(uuid)`.

Regras das funções:

- `SECURITY INVOKER`;
- `search_path = public, private, pg_temp`;
- `REVOKE EXECUTE FROM PUBLIC, anon, authenticated`;
- `GRANT EXECUTE TO service_role`;
- recebem/devolvem somente envelopes criptografados;
- não tomam decisões de autenticação do navegador;
- não retornam credenciais para clientes públicos.

### Migration lógica PIX-02 — tentativas e Webhook

Responsabilidades:

- criar `public.pagamentos_pix_tentativas`;
- criar `private.mercadopago_webhook_eventos`;
- criar FKs, índices, constraints, RLS e grants mínimos;
- não alterar corridas nem o enum financeiro.

Tabela de tentativas proposta:

```text
public.pagamentos_pix_tentativas
  id uuid primary key default gen_random_uuid()
  pagamento_id uuid not null
  motorista_id uuid not null
  mercadopago_payment_id text null unique
  idempotency_key text not null unique
  estado_interno text not null default 'criando'
  provider_status text null
  provider_status_detail text null
  valor_total numeric(10,2) not null
  valor_comissao numeric(10,2) not null
  pix_copia_cola text null
  expires_at timestamptz null
  approved_at timestamptz null
  failed_at timestamptz null
  refunded_at timestamptz null
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
```

Constraints e índices planejados:

- FK `pagamento_id -> pagamentos(id) ON DELETE CASCADE`;
- FK `motorista_id -> motoristas(id) ON DELETE RESTRICT`;
- `valor_total > 0`;
- `valor_comissao >= 0 AND valor_comissao <= valor_total`;
- `estado_interno IN ('criando','pendente','pago','falhou','estornado')`;
- índice em `pagamento_id`;
- índice em `motorista_id`;
- índice parcial em `expires_at` para tentativas pendentes;
- unicidade parcial: no máximo uma tentativa ativa por pagamento quando estado for `criando`, `pendente` ou `pago`.

Segurança planejada:

- RLS habilitada;
- nenhum grant para `anon`;
- nenhum grant direto para `authenticated`;
- acesso de passageiro e motorista somente por Server Functions com ownership verificado;
- `service_role` com privilégios mínimos necessários.

Tabela de eventos proposta:

```text
private.mercadopago_webhook_eventos
  id uuid primary key default gen_random_uuid()
  event_key text not null unique
  request_id text null
  topic text not null
  action text null
  resource_id text not null
  payload_hash text not null
  processing_status text not null default 'received'
  processing_attempts integer not null default 0
  received_at timestamptz not null default now()
  processed_at timestamptz null
  error_code text null
```

Regras:

- nenhum payload bruto por padrão;
- índice por `resource_id` e `received_at`;
- `processing_attempts >= 0`;
- estados internos controlados;
- RLS habilitada sem policy pública;
- somente `service_role` acessa;
- `event_key` e `payload_hash` impedem processamento duplicado.

### Migration lógica PIX-03 — integridade agregada

Responsabilidades:

- adicionar campos temporais mínimos em `public.pagamentos`;
- adicionar índices sem modificar registros históricos;
- manter enum `pagamento_status` intacto;
- não mudar dinheiro ou cartão.

Alterações propostas:

- `pago_at timestamptz null`;
- `estornado_at timestamptz null`;
- índice em `pagamentos(corrida_id)` para cobrir a FK;
- índice único parcial em `pagamentos(corrida_id) WHERE meio = 'pix'`;
- índice único parcial em `id_transacao_mercadopago WHERE id_transacao_mercadopago IS NOT NULL`.

Antes da criação dos índices únicos, a migration deverá abortar se consultas de pré-condição encontrarem duplicidade. Nenhum dado será apagado ou alterado automaticamente para fazer a constraint passar.

## 5. Regras que não entram na fundação

Ficam expressamente fora da Etapa 1:

- modificar `accept_corrida_atomic`;
- criar cobrança Mercado Pago;
- Webhook HTTP;
- tela de QR Code;
- alterar cancelamento;
- bloquear início da corrida;
- reembolso;
- Realtime;
- painel administrativo;
- corrigir grants preexistentes de outras tabelas;
- corrigir advisors fora do Pix;
- backfill das 17 corridas históricas sem pagamento.

Esses itens terão microetapas e testes próprios.

## 6. Ordem de aplicação futura

1. Gerar migration PIX-01 com Supabase CLI.
2. Revisar SQL e plano de rollback.
3. Aplicar em ambiente isolado.
4. Testar grants, RLS e credenciais fictícias criptografadas.
5. Aprovar ou corrigir PIX-01.
6. Repetir para PIX-02.
7. Repetir para PIX-03.
8. Somente depois avaliar aplicação controlada no projeto principal.

Não será aplicada uma migration única contendo toda a fundação.

## 7. Testes obrigatórios das migrations futuras

### Segurança

- `anon` não acessa schema privado;
- `authenticated` não acessa schema privado;
- `authenticated` não lê tentativas diretamente;
- `service_role` acessa somente o necessário;
- funções privadas não são executáveis publicamente;
- nenhum token em texto puro;
- advisor sem novo alerta causado pelo Pix.

### Integridade

- motorista inexistente não recebe credencial;
- mesma conta Mercado Pago não pertence a dois motoristas;
- tentativa exige pagamento e motorista existentes;
- comissão não ultrapassa o total;
- segunda tentativa ativa é rejeitada;
- IDs externos e chaves de idempotência não duplicam;
- Webhook duplicado não cria segundo efeito;
- tentativa paga não permite nova tentativa ativa.

### Performance

- todas as FKs novas possuem índice de cobertura;
- busca por pagamento, motorista, ID Mercado Pago e evento usa índice adequado;
- índice parcial de pendentes não inclui registros finalizados;
- nenhuma nova query exige varredura desnecessária quando o volume crescer.

### Regressão

- criação de corrida em dinheiro continua igual;
- seleção de cartão continua igual;
- registros históricos permanecem intactos;
- `accept_corrida_atomic` mantém definição e ACL atuais;
- contagens antes/depois conferem;
- nenhuma policy preexistente é removida.

## 8. Rollback lógico planejado

- Cada migration será independente.
- Se uma estrutura nova falhar antes de produção, ela não será promovida.
- Em produção, o comportamento será desligado por feature flag antes de qualquer recuperação.
- Colunas e tabelas aditivas não serão apagadas se isso puder perder evidência financeira.
- Correções serão feitas por migration posterior versionada.
- Nenhum rollback modifica registros históricos de dinheiro ou cartão.

## 9. Critério de aprovação da Etapa 1A

A Etapa 1A pode ser aprovada quando:

- este documento for o único diff da microetapa;
- GitHub e Supabase forem reconferidos;
- nenhuma migration tiver sido criada/aplicada;
- nenhuma alteração de core existir;
- o desenho estiver coerente com a Fonte da Verdade;
- as migrations futuras estiverem divididas e testáveis isoladamente.

## 10. Referências atuais

- Supabase — RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase — Segurança da Data API: https://supabase.com/docs/guides/api/securing-your-api
- Supabase — Secrets de Edge Functions: https://supabase.com/docs/guides/functions/secrets
- Supabase — Otimização de consultas: https://supabase.com/docs/guides/database/query-optimization
- PostgreSQL — Índices parciais: https://www.postgresql.org/docs/current/indexes-partial.html
