# Plano de Implementação: Cancelamento de Corrida

Implementar a funcionalidade de cancelamento de corrida pelo passageiro enquanto o sistema busca por um motorista. O cancelamento atualizará o status da corrida no banco de dados e redirecionará o usuário para a tela inicial.

## Alterações

### Servidor (Backend)
- **`src/lib/user.functions.ts`**: Adicionar a função `cancelarCorrida` usando `createServerFn`.
  - Validar se o usuário é o dono da corrida (passageiro).
  - Atualizar o status da corrida para `cancelada`.
  - Definir campos `cancelado_por` como `passageiro` e `data_cancelamento` como `now()`.

### Frontend (UI/UX)
- **`src/routes/procurando-motorista.tsx`**:
  - Implementar um modal de confirmação (Dialog) ao clicar em "CANCELAR CORRIDA".
  - Adicionar estados para controle do modal e processamento (loading).
  - Conectar o botão de confirmação à função `cancelarCorrida`.
  - Realizar o redirecionamento para `/` após sucesso.
  - Mostrar feedback visual (sonner toast) em caso de erro ou sucesso.

## Detalhes Técnicos
- **Status aceitos**: `cancelada` (confirmado no tipo `corrida_status`).
- **Segurança**: Uso de `requireSupabaseAuth` e validação de `auth.uid()` via `supabaseAdmin`.
- **Prevenção de Cliques**: Desabilitar botões durante o processamento.

## Passos para Teste
1. Iniciar uma nova corrida a partir da Home.
2. Na tela de radar ("Buscando motorista"), clicar em "CANCELAR CORRIDA".
3. Verificar se o modal de confirmação aparece.
4. Clicar em "Continuar buscando" e verificar se nada muda.
5. Clicar em "Cancelar corrida".
6. Confirmar se o sistema redireciona para a Home.
7. Opcional: Verificar no dashboard do Supabase se a corrida está com `status = 'cancelada'`.
