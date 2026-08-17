# Diagnóstico e Correção do Fluxo de Autenticação Social

Identifiquei que o problema principal pode ser a falta da `SUPABASE_SERVICE_ROLE_KEY` para operações administrativas e a necessidade de capturar dados adicionais (CPF/Celular) após o login com Google.

## Diagnóstico Realizado
- A `SUPABASE_SERVICE_ROLE_KEY` está ausente no `.env`, o que impede o `supabaseAdmin` de realizar inserts e queries que ignoram RLS no servidor.
- O fluxo atual redireciona cegamente, sem tratar usuários que já existem mas têm dados incompletos ou que acabaram de ser criados via Google.

## Ações Planejadas

### 1. Ajuste de Logs e Diagnóstico em Tempo Real
- Adicionar logs detalhados na server function `handleGoogleAuthRedirect` e na rota `/auth/callback` para identificar o ponto exato de falha no servidor.

### 2. Fluxo de Complemento de Cadastro
- Criar a rota `/auth/completar-cadastro` para capturar CPF e Celular de usuários vindos do Google (obrigatórios no banco).
- Atualizar a lógica do `handleGoogleAuthRedirect` para redirecionar para essa nova tela se os dados estiverem faltando.

### 3. Tratamento de Conflitos e Segurança
- Verificar se o e-mail do Google já existe no banco vinculado a outra conta e tratar o erro.
- Garantir que o `supabaseAdmin` falhe graciosamente se a chave de serviço estiver de fato ausente, com mensagem clara.

### 4. Verificação de Middleware
- Validar se o `csrfMiddleware` e `attachSupabaseAuth` estão operando corretamente para passar o token de autenticação para as server functions.

## Detalhes Técnicos
- **Server Function**: `handleGoogleAuthRedirect` agora verifica `cpf` e `celular` e decide o redirecionamento.
- **Nova Rota**: `src/routes/auth.completar-cadastro.tsx` usando `react-hook-form` e `zod`.
- **Middleware**: Manutenção do `attachSupabaseAuth` no `src/start.ts`.
