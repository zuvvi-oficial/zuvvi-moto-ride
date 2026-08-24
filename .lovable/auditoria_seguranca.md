# Relatório de Auditoria Técnica: Segurança e Suporte Zuvvi

## 1. Estrutura Existente (Supabase)

### Tabelas de Core Operacional
- **`usuarios`**: Tabela central vinculada ao Supabase Auth (`auth_user_id`). Armazena perfis (`passageiro`, `motorista`), CPF e celular com restrições de unicidade.
- **`motoristas`**: Gerencia `status_aprovacao` (piloto, aprovado, etc), `nota_media` e `is_disponivel`.
- **`corridas`**: Histórico completo com estados (`solicitada`, `aceita`, `motorista_chegou`, `em_andamento`, `concluida`, `cancelada`, `sem_motorista`).
- **`mensagens_corrida`**: Sistema de chat operacional ativo durante a corrida.

### Módulo de Suporte e Segurança (Identificado)
- **`chamados_suporte`**: Já existe no banco (Migração `20260817220454`).
  - **Tipos**: `duvida`, `sos`, `reclamacao`.
  - **Status**: `aberto`, `em_atendimento`, `resolvido`, `fechado`.
  - **RLS**: Protegida. Usuários só veem seus próprios chamados.
- **`viagens_compartilhadas`**: Estrutura para link público de acompanhamento SOS.
- **`admin_audit_logs`**: Rastreia ações administrativas (aprovações, alterações de status e justificativas).

## 2. Interface e UX

### Aplicativo (Passageiro/Motorista)
- **Existente**: Sistema de Chat, Avaliações (estrelas + comentário) e Notificações In-app.
- **Lacuna**: Não existe atualmente um botão visível de "Suporte" ou "Central de Ajuda" nas homes operacionais (`index.tsx` do passageiro ou `home-motorista.tsx`). O módulo de `chamados_suporte` está sem interface frontend.

### Painel Administrativo
- **Gestão de Cidades**: 
  - **Status**: `piloto`, `ativa`, `em_breve`.
  - **Filtros**: Já possui busca por nome e filtro por UF e Status Operacional.
  - **Atalhos**: É possível criar chips de filtro rápido (Atalhos) sem alterar a lógica, apenas manipulando o estado `status` da query existente.

## 3. Segurança e Regras de Negócio

- **RLS**: Implementado em todas as tabelas sensíveis. Bloqueios atômicos impedem corridas duplicadas e aceites simultâneos.
- **Suspensão/Bloqueio**: 
  - Motoristas perdem `is_disponivel` imediatamente se um documento obrigatório ou veículo for invalidado pelo admin (`admin.functions.ts`).
  - A suspensão de motorista é auditada e exige justificativa.

## 4. Arquivos Intocáveis (Core)
- `supabase/migrations/*` (Histórico de schema).
- `src/lib/admin.functions.ts` (Regras de validação e auditoria).
- `src/integrations/supabase/*` (Conexão e tipos).

## 5. Proposta para Módulo de Reclamações
- **Curto Prazo**: Ativar a interface para a tabela `chamados_suporte` existente.
- **Segurança**: Garantir que uma reclamação (`tipo: reclamacao`) possa ser vinculada a uma `corrida_id` específica para auditoria cruzada.
- **Admin**: Criar `/admin/suporte` para triagem de tickets.

Aguardando aprovação para Etapa 1.