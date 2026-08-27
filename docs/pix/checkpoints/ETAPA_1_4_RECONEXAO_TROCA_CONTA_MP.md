# ETAPA 1.4 — Reconectar mesma conta versus trocar conta

## Status

EM EXECUÇÃO.

## Baseline

- Branch: `feature/pix-100-seguro`.
- Base aprovada: Etapa 1.3 com confirmação explícita e migration de produção `20260827203802_pix_oauth_pending_confirmation`.
- A autorização OAuth já fica pendente e não ativa conta silenciosamente.
- O callback já exige confirmação explícita.
- O banco já preserva propriedade histórica `mercadopago_user_id -> motorista_id`.
- Não existe configuração persistida no banco identificando a conta Mercado Pago da plataforma.
- Documentação oficial atual do Mercado Pago confirma que `client_credentials` usa as credenciais da própria aplicação para acessar recursos próprios e que `/oauth/token` retorna `user_id`; esse `user_id` será usado apenas server-side para impedir que a conta integradora seja ativada como conta recebedora de motorista.

## Objetivo único

Fechar o comportamento de reconexão/troca de conta sem depender de parâmetro OAuth não documentado:

1. pendência deve informar ao motorista um identificador mascarado da conta autorizada;
2. se houver propriedade histórica para o mesmo motorista, marcar a ação como reconexão e exigir clique explícito em `Reconectar esta conta`;
3. se o motorista quiser trocar de conta, cancelar a autorização pendente antes de orientar nova autenticação/troca no Mercado Pago;
4. descobrir o `user_id` da própria aplicação/integrador por `client_credentials` no servidor;
5. impedir atomicamente que a conta integradora seja promovida para credencial ativa;
6. remover qualquer caminho de confirmação que possa contornar a trava da conta integradora.

## Allowlist

Somente estes caminhos podem mudar:

- `docs/pix/checkpoints/ETAPA_1_4_RECONEXAO_TROCA_CONTA_MP.md`;
- `supabase/migrations/*_pix_oauth_reconnect_switch_guard.sql`;
- `supabase/tests/pix_14_oauth_reconnect_switch_guard.sql`;
- `src/lib/pix-mercadopago-oauth.server.ts`;
- `src/lib/pix-mercadopago-oauth-supabase.server.ts`;
- `src/lib/pix-mercadopago-oauth.functions.ts`;
- `src/routes/motorista.mercadopago-callback.tsx`;
- testes TypeScript diretamente ligados ao cliente/adaptador OAuth;
- `.github/workflows/pix-oauth-reconnect-switch.yml`.

## Fora da allowlist

Proibido alterar pagamento/cobrança, corrida, comissão, tarifa, dinheiro, cartão, GPS, mapas, matching, autenticação geral, design system global, dependências/lockfile, `main`, Lovable ou qualquer tabela/função sem ligação direta com OAuth Pix.

## Portões obrigatórios

- pgTAP da 1.4;
- regressão 1.2 e 1.3;
- `anon` e `authenticated` sem acesso direto às RPCs privadas;
- cancelamento remove pendência e não ativa credencial;
- reconexão é identificada pela propriedade histórica, mas nunca ativa sem clique;
- conta integradora retorna bloqueio e não cria propriedade/credencial/projeção pública;
- conta de vendedor diferente do integrador continua confirmável;
- cliente `client_credentials` retorna somente o `user_id` necessário ao fluxo e não expõe token ao browser;
- TypeScript, ESLint e build;
- todos os workflows Pix verdes antes de produção;
- nenhuma escrita em produção antes do CI verde.

## Rollback

Antes de produção, rollback é apenas Git. Depois de produção, não executar rollback destrutivo; qualquer correção deverá ser nova migration Pix aditiva/compatível, preservando evidência financeira e OAuth.
