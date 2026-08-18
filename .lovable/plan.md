# Plano de Estabilização do Fluxo de Autenticação e Cadastro Zuvvi

Este plano visa corrigir e estabilizar o fluxo de autenticação via Google e o redirecionamento pós-cadastro/login, garantindo que todas as etapas obrigatórias sejam respeitadas sem loops ou travamentos na tela de processamento.

## Alterações Técnicas

### 1. Refatoração da Lógica de Redirecionamento Social (`src/lib/auth-google.functions.ts`)
- Ajustar a função `handleGoogleAuthRedirect` para seguir a nova ordem de validação:
  - **Passo 1: Identificação.** Localizar, vincular ou criar o usuário (preservando a lógica de segurança existente).
  - **Passo 2: Cadastro Básico.** Verificar `cpf`, `celular`, `data_nascimento` e `cidade_id`. Se faltar algum, redirecionar para `/auth/completar-cadastro`.
  - **Passo 3: Perfil.** Se o cadastro estiver ok, verificar se `is_passageiro` ou `is_motorista` é true. Se não, redirecionar para `/auth/perfil`.
  - **Passo 4: Home.** Se tudo estiver ok, redirecionar para a Home (`/`).
- Garantir que o retorno contenha sempre um `redirectTo` válido e capturar erros de banco para evitar que o usuário fique preso no "Processando".

### 2. Sincronização do Fluxo de Login por E-mail (`src/routes/auth.login.tsx` & `src/lib/auth-status.functions.ts`)
- Atualizar a função `checkUserProfileStatus` para retornar o status completo do cadastro (não apenas perfil).
- Modificar o redirecionamento pós-login em `auth.login.tsx` para seguir a mesma ordem rigorosa: Dados Básicos -> Perfil -> Home.

### 3. Proteção na Escolha de Perfil (`src/routes/auth.perfil.tsx`)
- Adicionar uma verificação no carregamento da página (ou no clique) que impeça o usuário de selecionar um perfil se o cadastro básico ainda estiver incompleto, redirecionando-o de volta para o "Quase lá!".

### 4. Otimização da Tela de Callback (`src/routes/auth.callback.tsx`)
- Remover a duplicação de `navigate`.
- Melhorar o tratamento de erros para que qualquer falha na server function interrompa o estado de "Processando" e mostre uma mensagem clara com botão de retorno.

## Impacto e Segurança
- **Dados:** Nenhuma migração ou alteração de banco será realizada.
- **Identidade:** A fonte Poppins e as cores Zuvvi Indigo/Volt serão mantidas.
- **Funcionalidades:** A lógica de geolocalização, mapas e homes existentes não será alterada.

## Resumo de Ordem de Validação (Fluxo Final)
1. Autenticação (Google ou E-mail).
2. Existe CPF, Celular, Nascimento e Cidade? 
   - Não -> `/auth/completar-cadastro`.
3. Escolheu ser Passageiro ou Motorista?
   - Não -> `/auth/perfil`.
4. Tudo OK -> Redireciona para `/`.
