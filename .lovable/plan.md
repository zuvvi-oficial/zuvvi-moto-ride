# Plano de Implementação: Busca de Destino e Confirmação de Corrida

O objetivo é ativar a busca de endereços na tela inicial para passageiros e criar uma nova tela de confirmação de corrida com cálculo de tarifa baseado nos dados reais da cidade.

## 1. Infraestrutura de Servidor e Dados
- **Novas Funções de Servidor (`src/lib/user.functions.ts`)**:
  - `calcularValorCorrida`: Recebe `distanciaKm` e `tempoMin`, busca a tarifa da cidade do usuário e calcula o valor final usando a fórmula: `bandeirada + (distanciaKm * valorKm) + (tempoMin * valorMin)`, respeitando a `tarifa_minima`.

## 2. Tela Inicial do Passageiro (Tela 1)
- **Ativação da Busca (`src/routes/index.tsx`)**:
  - Habilitar o campo "Para onde vamos?" quando a cidade estiver disponível.
  - Implementar geocoding em tempo real usando a **Mapbox Geocoding API** (requisições via fetch para `https://api.mapbox.com/geocoding/v5/mapbox.places/`).
  - Filtrar sugestões pela proximidade (`proximity`) das coordenadas atuais do usuário.
  - Ao selecionar um destino, navegar para `/confirmar-corrida` passando os parâmetros de origem e destino via query string.

## 3. Nova Tela: Confirmar Corrida (Tela 2)
- **Nova Rota (`src/routes/confirmar-corrida.tsx`)**:
  - **Mapa de Rota**: Exibir o trajeto entre origem e destino usando a **Mapbox Directions API**.
  - **Cálculo de Distância/Tempo**: Obter km e minutos reais da rota via API.
  - **Card de Resumo**:
    - Endereço de destino.
    - Valor estimado (calculado pela server function).
    - Botão "Chamar Zuvvi" (apenas UI).
    - Botão de voltar para a Home.
  - **Design System**: Manter Indigo/Volt, Poppins, e efeitos de blur.

## Detalhes Técnicos
- **APIs Mapbox**:
    - Geocoding: `mapbox.places` para busca de texto -> coordenadas.
    - Directions: `mapbox/driving` para coordenadas -> geometria de rota, distância e duração.
- **Navegação**: Uso de `useNavigate` do TanStack Router com `search` params para persistir origem/destino entre as telas.
- **Segurança**: As server functions continuam protegidas pelo middleware de autenticação do Supabase.

Não serão alterados fluxos de login, cadastro, banco de dados (apenas leitura) ou lógica de motoristas.
