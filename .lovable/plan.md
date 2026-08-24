# Plano: Responsividade Premium do Painel Administrativo Zuvvi

Este plano foca na transformação visual das telas administrativas para garantir uma experiência premium em dispositivos móveis (Android e iOS), mantendo a integridade funcional e a identidade visual da marca Zuvvi.

## Alterações Funcionais e Visuais

### 1. Navegação Mobile (Bottom Bar)
- Criar o componente `AdminBottomNav.tsx`.
- Visível apenas em telas menores que 768px.
- Itens: Início, Motoristas, Veículos e Cidades.
- Destaque para a aba ativa (Violeta Zuvvi) e suporte a safe-area.

### 2. Dashboard Administrativo (`/admin`)
- Layout de cards em coluna única no mobile.
- Botões de gestão empilhados verticalmente no mobile.
- Ajuste de espaçamentos para evitar cortes.

### 3. Gestão de Motoristas (`/admin/motoristas`)
- Substituição da tabela por cards premium em telas pequenas.
- Cada card exibirá: Nome, Status, Cidade, Contato, Indicador Online e Ações (Ver Detalhes, Suspender, Recusar).
- Filtros e busca adaptados para largura total.

### 4. Gestão de Veículos (`/admin/veiculos`)
- Conversão das linhas da tabela em cards premium no mobile.
- Exibição clara de Motorista, Veículo, Placa, Cidade e Status.
- Preservação de todas as ações existentes.

### 5. Gestão de Cidades (`/admin/cidades`)
- Implementação de cards expansíveis para cidades no mobile.
- Resumo visual (Cidade, UF, Status) com expansão para detalhes tarifários.
- Adaptação dos filtros para empilhamento vertical.

## Detalhes Técnicos

### Componentes
- `src/components/admin/AdminBottomNav.tsx`: Nova barra de navegação.
- `src/components/admin/AdminLayout.tsx` (ou ajuste nas rotas): Garantir `pb-20` no mobile para a barra não cobrir o conteúdo.

### Estilização (Tailwind CSS)
- Uso intensivo de classes utilitárias para breakpoints (`sm:`, `md:`, `lg:`).
- `backdrop-blur-xl`, `bg-zuvvi-indigo/90`, e bordas `white/10` para manter o visual premium.
- Alvos de toque de no mínimo 44px.

### Preservação Lógica
- **NENHUMA** alteração em server functions, banco de dados, RLS ou lógica de negócio será realizada.
- Os cliques nos botões e submissões de formulários permanecerão idênticos.
