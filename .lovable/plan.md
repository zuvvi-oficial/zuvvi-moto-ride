# Plano de Implementação: Cancelamento de Corrida (Motorista)

O objetivo é adicionar a funcionalidade de cancelamento de corrida para o motorista na tela de `home-motorista.tsx`, mantendo a integridade do core e seguindo o design visual Zuvvi.

## Alterações Propostas

### 1. Banco de Dados (Supabase)
- Nenhuma alteração de schema necessária. A tabela `corridas` já possui o status `cancelada` e o campo `cancelado_por` (Enum).

### 2. Backend (Server Functions)
- Criar a função `cancelarCorridaMotorista` em `src/lib/motorista.functions.ts`.
- A função validará se a corrida pertence ao motorista autenticado e se está em um status que permite cancelamento (aceita, motorista_a_caminho).
- A função atualizará o status para `cancelada`, definirá `cancelado_por` como 'motorista' e, crucialmente, devolverá o motorista ao estado `is_disponivel = false` (offline) para que ele decida quando ficar online novamente após o cancelamento.

### 3. Frontend (UI/UX)
- Modificar o componente `HomeMotorista` em `src/routes/home-motorista.tsx`.
- Adicionar um botão "CANCELAR CORRIDA" no card de corrida ativa (`activeRide`).
- O botão seguirá o padrão visual da Zuvvi: fundo escuro com borda sutil, texto em caixa alta e feedback visual durante o processamento.
- Implementar a chamada para a nova server function com feedback de sucesso/erro via `sonner`.

## Detalhes Técnicos
- **Segurança**: Validação rigorosa de `auth_user_id` no servidor para impedir que um motorista cancele corridas alheias.
- **Estado**: Após o cancelamento, a query `motorista-status` será invalidada, removendo o card de corrida ativa da interface e voltando o motorista para o estado offline (padrão de segurança para evitar recebimento imediato de nova oferta indesejada).
- **Consistência**: Uso de `useMutation` para gerenciar o estado da requisição e evitar cliques duplos.

## Critérios de Aceite
- O botão de cancelamento aparece apenas quando há uma corrida ativa.
- Ao clicar, o motorista é solicitado (via confirmação visual ou processamento imediato conforme pedido) e a corrida é marcada como cancelada.
- O motorista volta para a tela inicial de "Offline".
- A operação é registrada corretamente no banco de dados com a marcação de cancelamento pelo motorista.
