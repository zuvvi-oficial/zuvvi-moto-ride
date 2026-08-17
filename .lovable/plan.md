# Plano de Criação da Tela de Escolha de Perfil

Este plano descreve a criação de uma nova etapa pós-cadastro para escolha de perfil (Passageiro ou Motorista) e os ajustes necessários no fluxo de cadastro técnico do Zuvvi.

## Alterações Funcionais

### 1. Ajuste no Cadastro (`src/routes/auth.cadastro.tsx`)
- Remover o campo de seleção de perfil inicial ("Eu quero ser: Passageiro / Motorista") do formulário.
- Atualizar o esquema de validação Zod para não exigir mais esse campo.
- Mudar o redirecionamento pós-sucesso para `/auth/perfil` em vez da Home `/`.

### 2. Atualização da Função de Servidor (`src/lib/auth.functions.ts`)
- Remover a lógica que define `is_passageiro`, `is_motorista` e `perfil_ativo` no momento do `signUp`.
- O registro na tabela `public.usuarios` será criado com as flags de perfil como `false` por padrão.

### 3. Nova Rota e Tela de Perfil (`src/routes/auth.perfil.tsx`)
- Criar a rota `/auth/perfil` dentro do layout `/auth`.
- Implementar dois cartões grandes:
    - **Quero pedir corridas**: Atualiza `usuarios` para `is_passageiro = true` e `perfil_ativo = 'passageiro'`.
    - **Quero dirigir e ganhar dinheiro**: Atualiza `usuarios` para `is_motorista = true` e `perfil_ativo = 'motorista'`, e cria o registro em `motoristas`.
- Redirecionar para a Home (Passageiro) ou para um placeholder de onboarding (Motorista).

### 4. Novas Funções de Servidor (`src/lib/perfil.functions.ts`)
- Criar funções `selectPassageiroPerfil` e `selectMotoristaPerfil` para realizar as atualizações no banco com segurança.

## Detalhes Visuais
- Utilizar a paleta oficial: Zuvvi Indigo, Violeta e Volt.
- Manter tipografia Poppins.
- Efeitos de hover e glow nos cartões de escolha.
