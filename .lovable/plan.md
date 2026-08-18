# Plano: Obter Endereço Real da Origem

O objetivo é substituir o texto genérico "Sua localização" pelo endereço real (rua, número, bairro) obtido através de geolocalização reversa da localização atual do passageiro.

## Alterações Propostas

### 1. Camada de Dados e Lógica de Servidor
- **`src/lib/user.functions.ts`**:
    - Adicionar uma nova função `getReverseGeocoding` (usando `createServerFn`) que consome a Mapbox Geocoding API para transformar coordenadas em um endereço legível.
    - Esta função será chamada na tela inicial quando a localização for obtida.

### 2. Fluxo da Tela Inicial (Passageiro)
- **`src/routes/index.tsx`**:
    - Criar um estado `originAddress` para armazenar o nome da rua/bairro.
    - Quando o GPS retornar a posição, disparar a chamada para `getReverseGeocoding`.
    - Ao selecionar um destino, passar esse `originAddress` via query parameters (search params) para a tela de confirmação.

### 3. Tela de Confirmação de Corrida
- **`src/routes/confirmar-corrida.tsx`**:
    - Atualizar o `searchSchema` para aceitar `originName`.
    - Exibir `originName` no card de resumo da rota em vez de "Sua localização atual".
    - Passar esse nome real para a função `criarCorrida` (que já aceita `origemNome`).

### 4. Tela Buscando Motorista
- **`src/routes/procurando-motorista.tsx`**:
    - A tela já consome `origem_nome` da tabela `corridas`, então ao garantir que a criação da corrida envie o endereço real, esta tela passará a exibi-lo automaticamente.

## Detalhes Técnicos
- Utilizaremos a API do Mapbox: `https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json`.
- A estrutura do banco já suporta `origem_nome` e `destino_nome` (conforme verificado no código).

## Como Testar
1. Abrir o app no celular ou simulador.
2. Permitir acesso à localização.
3. Observar se a origem é carregada com o nome da rua (pode haver um pequeno delay para a chamada da API).
4. Pesquisar um destino e avançar.
5. Verificar se o endereço real aparece na tela de confirmação e na tela de busca por motorista.
