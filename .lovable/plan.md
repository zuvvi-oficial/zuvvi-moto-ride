# Plano de Implementação: Tela de Início do Passageiro com Mapa

Implementação da interface de mapa em tela cheia para o passageiro, com geolocalização e verificação de disponibilidade da cidade.

## Etapas

1. **Configuração de Infraestrutura**
   - Adicionar `mapbox-gl` ao projeto (concluído).
   - Solicitar o Mapbox Public Access Token ao usuário via interface.

2. **Novas Server Functions em `src/lib/user.functions.ts`**
   - Criar `checkCityAvailability`: verifica se a cidade do usuário (ou a localização atual) está com status `piloto` ou `ativa`.

3. **Desenvolvimento do Componente `HomePassageiro` em `src/routes/index.tsx`**
   - Implementar solicitação de geolocalização via Geolocation API.
   - Adicionar estados para carregamento, erro de permissão e disponibilidade de cidade.
   - Integrar o `Mapbox GL JS` para renderizar o mapa em tela cheia atrás da UI.
   - Adaptar o layout existente (Header, Search Bar, Bottom Nav) para sobrepor o mapa.

4. **Lógica de Disponibilidade**
   - Caso a cidade não esteja liberada: exibir overlay amigável "Zuvvi ainda não chegou aqui".
   - Caso a permissão seja negada: exibir instrução para ativar GPS com botão de tentar novamente.

## Detalhes Técnicos

- **Geolocalização:** `navigator.geolocation.getCurrentPosition`.
- **Mapa:** Inserir contêiner `div` com `z-0` e `fixed inset-0`. A UI usará `z-10` e fundos semitransparentes.
- **Estilização:** Tailwind CSS v4 seguindo a identidade "Zuvvi Indigo & Volt".
- **Dados:** Consultar `cidades` via `cidade_id` do perfil do usuário para a validação inicial solicitada.

## Verificação

- Testar fluxo com geolocalização permitida (deve mostrar mapa).
- Testar fluxo com geolocalização negada (deve mostrar erro).
- Testar usuário em cidade com status `em_breve` (deve mostrar aviso de indisponibilidade).
