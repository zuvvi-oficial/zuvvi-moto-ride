# ETAPA 1.4 — Reconectar mesma conta versus trocar conta

## Status

APROVADA.

## Baseline

- Branch: `feature/pix-100-seguro`.
- Base aprovada: Etapa 1.3 com confirmação explícita e migration de produção `20260827203802_pix_oauth_pending_confirmation`.
- A autorização OAuth já fica pendente e não ativa conta silenciosamente.
- O callback já exige confirmação explícita.
- O banco já preserva propriedade histórica `mercadopago_user_id -> motorista_id`.
- Documentação oficial atual do Mercado Pago confirma que `client_credentials` usa as credenciais da própria aplicação para acessar recursos próprios e que `/oauth/token` retorna `user_id`; esse `user_id` é usado apenas server-side para impedir que a conta integradora seja ativada como conta recebedora de motorista.

## Objetivo único

Fechar o comportamento de reconexão/troca de conta sem depender de parâmetro OAuth não documentado:

1. pendência informa ao motorista um identificador mascarado da conta autorizada;
2. se houver propriedade histórica para o mesmo motorista, a ação é marcada como reconexão e exige clique explícito em `Reconectar esta conta`;
3. `Trocar de conta` cancela a autorização pendente antes de nova autorização;
4. o servidor descobre o `user_id` da própria aplicação/integrador por `client_credentials`;
5. a conta integradora é impedida atomicamente de ser promovida para credencial ativa;
6. a assinatura antiga de confirmação sem a trava da conta integradora foi removida.

## Allowlist executada

- `docs/pix/checkpoints/ETAPA_1_4_RECONEXAO_TROCA_CONTA_MP.md`;
- `supabase/migrations/*_pix_oauth_reconnect_switch_guard.sql`;
- `supabase/tests/pix_14_oauth_reconnect_switch_guard.sql`;
- `src/lib/pix-mercadopago-oauth.server.ts`;
- `src/lib/pix-mercadopago-oauth-supabase.server.ts`;
- `src/lib/pix-mercadopago-oauth.functions.ts`;
- `src/lib/pix-mercadopago-oauth-flow.server.ts` apenas para estreitamento de tipo da dependência realmente usada, sem mudança de runtime;
- `src/routes/motorista.mercadopago-callback.tsx`;
- testes TypeScript diretamente ligados ao cliente/adaptador OAuth;
- `.github/workflows/pix-oauth-reconnect-switch.yml`;
- ajuste estrito da allowlist server-only no workflow OAuth existente para reconhecer o consumidor server-only autorizado.

## Fora da allowlist preservado

Não houve alteração funcional em pagamento/cobrança, corrida, comissão, tarifa, dinheiro, cartão, GPS, mapas, matching, autenticação geral, design system global, dependências/lockfile, `main` ou Lovable.

## Evidências de aprovação

- Migration de produção canônica: `20260827213952_pix_oauth_reconnect_switch_guard`.
- Git reconciliado por rename puro da migration originalmente nomeada `20260827211500_pix_oauth_reconnect_switch_guard.sql`, sem mudança de SQL.
- SHA reconciliado antes do fechamento documental: `55d7accdaa5632566699e846b3b4b20949cd0a95`.
- 15/15 workflows Pix concluídos com `success` nesse SHA.
- pgTAP 1.4: 36/36 assertions aprovadas no portão específico.
- Regressões 1.2 e 1.3 aprovadas antes da migration 1.4 no banco local descartável.
- TypeScript, ESLint, build, DB lint e advisors aprovados.
- A função antiga `public.pix_oauth_pending_authorization_confirm(uuid)` não existe mais em produção.
- A confirmação válida em produção é `public.pix_oauth_pending_authorization_confirm(uuid, text)`.
- `summary`, `cancel` e `confirm` são `SECURITY DEFINER`, usam `search_path = pg_catalog, public, private` e têm `EXECUTE` restrito a `service_role`/owner privilegiado; `anon` e `authenticated` não possuem execução.
- Estado pós-produção: 0 autorizações pendentes; 2 credenciais privadas, sendo 1 ativa e 1 revogada; 1 motorista com projeção pública de conta Mercado Pago.
- Histórico financeiro permaneceu intacto: 33 tentativas Pix, todas em `estado_interno = 'falhou'`; nenhuma cobrança nova foi criada pela Etapa 1.4.
- PR #2 permaneceu draft, aberta e não mergeada em `main`.

## Incidentes de CI tratados durante a etapa

- O primeiro portão encontrou apenas formatação Prettier; corrigida sem mudança lógica.
- Dois workflows antigos exigiam compatibilidade com a nova interface server-only; as guardas foram atualizadas sem afrouxar isolamento.
- Um commit intermediário reescreveu indevidamente parte de um teste OAuth; essa reescrita foi removida e o arquivo voltou exatamente ao blob íntegro anterior antes do portão final.
- Nenhuma dessas correções foi usada para contornar falha funcional.

## Classificação

**APROVADA.**

Com a 1.1, 1.2, 1.3 e 1.4 aprovadas, a **Etapa 1 — conta Mercado Pago individual, propriedade histórica, autorização pendente, confirmação explícita, reconexão/troca segura e bloqueio da conta integradora — está encerrada**.

A próxima etapa autorizada pela Fonte da Verdade é a **Etapa 2 — Marketplace/Split + `application_fee`**, iniciando pela Microetapa 2.1 de prova de configuração.

## Rollback

Não executar rollback destrutivo. Qualquer correção futura deverá ser nova migration Pix aditiva/compatível, preservando evidência financeira e OAuth.