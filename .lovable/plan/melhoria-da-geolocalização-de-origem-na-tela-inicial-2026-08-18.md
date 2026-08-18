# Melhoria da Geolocalização de Origem na Tela Inicial

## Objetivo
Melhorar a gestão da localização de origem na tela de busca de corridas (passageiro).

## Mudanças Técnicas
1. **Refatoração da Home Passageiro**:
   - Adicionar estado `manualOrigin` (coordenadas e endereço) para permitir sobrepor a localização GPS atual.
   - Adicionar estado `isUpdatingLocation` para UI de carregamento durante a busca por GPS.

2. **Componente de Origem**:
   - Exibir o endereço de origem (GPS ou manual).
   - Adicionar botão de "re-centrar/atualizar GPS" ao lado do endereço.
   - Tornar o endereço de origem clicável para alternar para um estado de "busca/edição" de endereço (usando o mesmo motor do destino).

3. **Lógica de Atualização**:
   - Ao editar manualmente a origem, atualizar as coordenadas e o nome da origem.
   - Ao re-centrar GPS, limpar o estado manual e re-buscar a localização do dispositivo.

4. **Interface**:
   - Card de origem (z-index 10, topo da tela, antes da busca de destino).
   - Botões de ação (atualizar GPS, limpar/editar manual).

## Testes
- Verificar exibição correta do endereço atual.
- Testar atualização via GPS.
- Testar edição manual e sua persistência para o cálculo da corrida.
- Verificar reversão para GPS após editar manualmente.
