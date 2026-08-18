# Plano: Tela "Procurando Motorista" e Conexão de Fluxo

Este plano descreve a implementação da tela de espera por um motorista e a navegação automática após a criação de uma corrida.

## Objetivos
1. Criar a nova rota `/procurando-motorista`.
2. Implementar a interface de "Procurando Motorista" com a identidade visual Zuvvi.
3. Conectar a tela `/confirmar-corrida` à nova rota.
4. Implementar monitoramento em tempo real (Supabase Realtime) do estado da corrida.

## Alterações Técnicas

### 1. Servidor (`src/lib/user.functions.ts`)
- Adicionar função `getCorrida` para buscar detalhes de uma corrida específica.
- (Opcional) Adicionar função de cancelamento básico (apenas visual por enquanto, conforme solicitado).

### 2. Frontend - Nova Rota (`src/routes/procurando-motorista.tsx`)
- Criar a rota com parâmetro `rideId` na busca.
- Usar `useSuspenseQuery` para carregar dados iniciais da corrida.
- Implementar `useEffect` com Supabase Realtime (`corrida:id=eq.ID`) para monitorar mudanças no `motorista_id` ou `status`.
- UI:
  - Animação de pulso/busca.
  - Card com resumo da corrida (Origem, Destino, Valor, Pagamento).
  - Botão "Cancelar corrida" (apenas UI).
  - Detecção de aceite do motorista (navegação futura).

### 3. Frontend - Ajuste Navegação (`src/routes/confirmar-corrida.tsx`)
- Atualizar `handleConfirmarCorrida` para usar `navigate` enviando o `rideId` para `/procurando-motorista` após o sucesso.

## Experiência do Usuário
- O passageiro clica em "CONFIRMAR E CHAMAR".
- O botão fica desabilitado com spinner.
- Sucesso -> Redirecionamento instantâneo para a tela de busca.
- Na tela de busca, o usuário vê que o sistema está procurando uma moto.
- Se um motorista aceitar (simulado ou real), o app detecta e avisa (preparando o terreno para a próxima tela).

## Detalhes Visuais
- Cores: Indigo (#130F36), Violeta (#6C3CE9), Volt (#C6FF3D).
- Fonte: Poppins.
- Efeitos: Backdrop blur, bordas sutilmente iluminadas (zuvvi-glow).
