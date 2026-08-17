# Plan - Adição de Login com Google

Adicionar suporte para autenticação via Google nas telas de Login e Cadastro, garantindo o preenchimento automático de dados e o redirecionamento correto para escolha de perfil para novos usuários.

## User Review Required

> [!NOTE]
> A implementação assume que o provedor Google já está configurado no painel do Supabase do projeto. O redirecionamento após o login social usará a URL atual da aplicação (localhost em desenvolvimento).

## Proposed Changes

### 1. Autenticação (Backend/Lib)
- Criar `src/lib/auth-google.functions.ts` para centralizar a lógica de redirecionamento e tratamento pós-login (OAuth).
- Implementar função para verificar se o usuário Google já possui um registro em `public.usuarios` e redirecionar para `/auth/perfil` ou `/` conforme o estado.

### 2. Componentes UI
- Criar `src/components/auth/GoogleLoginButton.tsx` (estilo Zuvvi Indigo/Volt).
- Adicionar o divisor "ou" com estilo minimalista.

### 3. Telas de Login e Cadastro
- Inserir o botão de Google no topo dos formulários em `src/routes/auth.login.tsx` e `src/routes/auth.cadastro.tsx`.
- Ajustar o layout para manter a harmonia visual com os campos existentes.

### 4. Fluxo de Onboarding (Novo Usuário Social)
- Garantir que usuários criados via OAuth (sem registro prévio no DB) sejam interceptados para criação do registro na tabela `usuarios` e enviados para `/auth/perfil`.

## Technical Details

- **OAuth Provider:** Google via `supabase.auth.signInWithOAuth`.
- **Redirect URL:** `window.location.origin` (ajustado para o ambiente).
- **Database Trigger (Opcional/Fallback):** Caso o redirecionamento client-side falhe em criar o registro no banco, um listener no `onAuthStateChange` na raiz da aplicação será considerado para garantir a integridade do registro em `public.usuarios`.
- **Zod Validation:** Os campos existentes de email/senha continuarão funcionando de forma independente.

## Confirmation

- [ ] Botão "Continuar com Google" visível e funcional.
- [ ] Usuários novos direcionados para Escolha de Perfil.
- [ ] Usuários recorrentes direcionados para Home.
