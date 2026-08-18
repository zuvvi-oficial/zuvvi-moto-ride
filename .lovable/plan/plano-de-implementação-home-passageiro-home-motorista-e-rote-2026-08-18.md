# Plano de Implementação: Home Passageiro, Home Motorista e Roteamento Inteligente

Este plano descreve a criação das telas reais de destino pós-login para passageiros e motoristas, além da lógica para alternar automaticamente a Home na rota raiz baseada no estado da sessão.

## 1. Criação das Homes e Componentes

### Home Passageiro (Mobile-first)
- Local: Integrada na rota raiz `src/routes/index.tsx`.
- Interface:
  - Header com saudação ("Olá, [Nome]") e botão de logout.
  - Barra de busca desabilitada com placeholder "Qual o seu destino?".
  - Badge flutuante: "Em breve você poderá pedir corridas aqui".
  - Bottom Bar fixa: Início, Corridas, Pagamento, Perfil.
  - Cartão promocional: "Primeira corrida com 50% OFF (Em breve)".

### Home Motorista (Mobile-first)
- Local: Sobrescrevendo `src/routes/onboarding-motorista.tsx`.
- Interface:
  - Header com saudação e status do cadastro (Pendente, Em Análise, Aprovado).
  - Seção de próximos passos: Checklist de documentos pendentes (CNH, CRLV, Pix, Foto).
  - Botão de ação: "Enviar Documentos".
  - Resumo de performance: Nota média e ganhos diários (zerados/mock).
  - Bottom Bar fixa: Início, Histórico, Carteira, Perfil.

## 2. Lógica de Roteamento Inteligente

### Detecção de Sessão na Rota "/"
- Utilizar a Server Function `getAuthStatus` para verificar se há um token de autenticação válido.
- A rota raiz `src/routes/index.tsx` passará a renderizar condicionalmente:
  - **Não logado**: Landing Page institucional (marketing).
  - **Logado (Passageiro)**: Home Passageiro.
  - **Logado (Motorista)**: Home Passageiro (por enquanto, conforme requisito, mas redirecionando visualmente se necessário). *Correção: O requisito pede a Home correspondente.*

## 3. Detalhes Técnicos e Segurança

- **Server Functions**:
  - `getSessionUser`: Busca dados completos do usuário e relação com motorista usando Supabase Admin (servidor).
  - `getAuthStatus`: Verifica autenticidade da sessão via JWT no servidor.
- **Estado Global**:
  - Uso de `TanStack Query` para cachear o estado da sessão e evitar múltiplas chamadas ao banco.
- **Identidade Visual**:
  - Aplicação rigorosa das cores Zuvvi Indigo, Violeta e Volt.
  - Uso de ícones da biblioteca `lucide-react`.
  - Design mobile-first com containers centralizados em `max-w-md`.

## 4. Próximos Passos (Fora do Escopo Atual)
- Implementação de upload de documentos reais.
- Integração com Mapas (Google Maps/Mapbox).
- Fluxo real de solicitação de corrida.
