# Plano de Implementação - Fluxo de Cadastro Zuvvi

Este plano estabelece a base técnica para a autenticação do projeto Zuvvi, focando no cadastro de usuários e sua integração com a tabela `public.usuarios` já existente.

## Alterações Propostas

### 1. Backend e Autenticação (TanStack Server Functions)
- Criar `src/lib/auth.functions.ts` para lidar com a lógica de cadastro no lado do servidor (se necessário para processos atômicos) ou apenas facilitar a integração cliente-Supabase.
- Garantir que o `signUp` do Supabase Auth seja seguido imediatamente pela criação do registro correspondente em `public.usuarios`.

### 2. Rotas e Telas
- Criar `src/routes/auth.tsx` como uma rota pai para fluxos de autenticação (opcional).
- Criar `src/routes/auth.cadastro.tsx` contendo o formulário de cadastro.
- Campos do formulário: Nome, E-mail, Celular, CPF, Data de Nascimento e Senha.
- Adicionar seleção inicial de perfil (`is_passageiro` ou `is_motorista`).

### 3. Componentes UI
- Criar componentes de formulário reutilizáveis se necessário, ou usar os componentes shadcn já presentes (`src/components/ui/`).
- Implementar feedback visual de erros (Zod para validação e Sonner para notificações).

### 4. Integração Supabase
- Utilizar o cliente Supabase em `src/integrations/supabase/client.ts`.
- Vincular o `auth.uid()` ao campo `auth_user_id` na tabela `usuarios`.

## Detalhes Técnicos
- **Validação**: Uso de Zod para garantir que CPF, e-mail e celular sigam os formatos corretos antes do envio.
- **Segurança**: RLS já configurado na tabela `usuarios` garantirá que o usuário só acesse seus próprios dados após o cadastro.
- **UX**: Design seguindo a identidade visual "Asphalt & Amber" (Space Grotesk, tons escuros e âmbar).

## O que NÃO será feito agora
- Recuperação de senha.
- Login social.
- Telas internas do aplicativo (dashboard, mapas, etc).
- Upload de documentos ou fotos de perfil.
