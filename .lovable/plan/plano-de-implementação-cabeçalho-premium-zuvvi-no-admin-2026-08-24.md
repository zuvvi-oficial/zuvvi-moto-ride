# Plano de Implementação: Cabeçalho Premium Zuvvi no Admin

Adição de uma barra superior institucional Premium à tela de administração, mantendo a integridade do dashboard atual.

## Alterações

### Componente Admin (`src/routes/admin/index.tsx`)
- Importar `ZuvviLogo` de `@/components/brand/ZuvviLogo`.
- Adicionar a `TopBar` fixa no topo com efeito de desfoque (backdrop blur) e design system Zuvvi.
- Ajustar o layout principal para acomodar a nova barra superior.
- Mover a funcionalidade de "Sair" para a barra superior.

## Detalhes Técnicos
- Utilizar `sticky top-0 z-40` para a barra superior.
- Aplicar `bg-zuvvi-indigo/90 backdrop-blur-xl border-b border-white/10`.
- Garantir responsividade total sem overflow horizontal.
- Preservar todas as funções de estado e carregamento de dados originais.
