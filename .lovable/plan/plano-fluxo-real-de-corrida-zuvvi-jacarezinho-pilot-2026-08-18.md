# Plano: Fluxo Real de Corrida Zuvvi (Jacarezinho Pilot)

Implementação do fluxo ponta a ponta: Solicitação -> Despacho -> Aceite -> Acompanhamento, com foco na praça piloto de Jacarezinho/PR.

## Alterações de Banco de Dados (via Supabase Migration)

- Adição de campos de disponibilidade e localização na tabela `motoristas`: `is_disponivel`, `ultima_lat`, `ultima_lng`, `ultima_localizacao_at`.
- Garantia de status `piloto` apenas para Jacarezinho.

## Backend (Server Functions em `src/lib/`)

- `src/lib/motorista.functions.ts`: Novas funções para motoristas.
  - `toggleDisponibilidade`: Ativar/desativar modo online.
  - `updateLocalizacaoMotorista`: Atualizar GPS do motorista.
  - `aceitarCorrida`: Lógica transacional para assumir uma corrida (valida status, motorista aprovado e cidade).
  - `recusarCorrida`: Libera a oferta para outros motoristas.
  - `getOfertasDisponiveis`: Lista corridas 'solicitada' na cidade do motorista.
- `src/lib/user.functions.ts`: Refinamento de `criarCorrida`.
  - Validação rigorosa de cidade (apenas Jacarezinho permitida para criação).
  - Status inicial 'solicitada'.

## Frontend e Fluxos (React Components & Routes)

- **Home Passageiro (`src/routes/index.tsx`)**:
  - Manter validação de `checkCityAvailability` (bloquear fora de Jacarezinho).
- **Procurando Motorista (`src/routes/procurando-motorista.tsx`)**:
  - Melhorar Realtime para ouvir mudanças de status e redirecionar para `/acompanhamento` assim que `motorista_id` for preenchido.
- **Home Motorista (`src/routes/onboarding-motorista.tsx`)**:
  - Se aprovado, mostrar interface de "Ficar Online".
  - Se online, mostrar card de "Nova Corrida" ao detectar via Realtime.
- **Acompanhamento (`src/routes/acompanhamento.tsx`)**:
  - Substituir placeholders por dados reais do motorista (nome, foto, veículo).
  - Adicionar polimento para mostrar que o rastreamento em tempo real é a localização do motorista.

## Segurança

- Todas as chamadas usam `requireSupabaseAuth`.
- Validação de perfil (passageiro vs motorista) no servidor.
- `aceitarCorrida` usa `supabaseAdmin` para garantir que apenas um motorista consiga o `UPDATE` com sucesso através de uma condição de status.

## Detalhes Técnicos

```typescript
// Exemplo da lógica de aceite transacional
const { data, error } = await supabaseAdmin
  .from('corridas')
  .update({ motorista_id, status: 'aceita', data_aceite: new Date() })
  .eq('id', rideId)
  .eq('status', 'solicitada') // Garante atomicidade
  .is('motorista_id', null)
  .select();
```
