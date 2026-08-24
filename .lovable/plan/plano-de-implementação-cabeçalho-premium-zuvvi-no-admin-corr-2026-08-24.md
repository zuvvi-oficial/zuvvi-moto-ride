# Plano de Implementação: Cabeçalho Premium Zuvvi no Admin (Correção/Refinamento)

Re-aplicação e refinamento do cabeçalho institucional Premium Zuvvi no topo da rota `/admin`, garantindo o cumprimento estrito das novas instruções (instrucoes-37.md).

## Alterações

### Componente Admin (`src/routes/admin/index.tsx`)
- Garantir a importação correta de `ZuvviLogo` de `@/components/brand/ZuvviLogo`.
- Implementar a `nav` (Top Bar) com:
    - `sticky top-0 z-40`
    - `bg-zuvvi-indigo/90 backdrop-blur-xl border-b border-white/10`
    - Layout: `ZuvviLogo` (esquerda), "Administrativo" (centro/identificador), Botão "Sair" (direita).
- Ajustar o container `main` para `max-w-7xl mx-auto`.
- Estilizar o cabeçalho do conteúdo (Título e Última atualização) conforme a direção visual premium.
- **Trava de Segurança:** Não alterar nenhuma lógica de dados (`stats`), funções (`handleSignOut`), ou a estrutura dos cards abaixo do cabeçalho.

## Detalhes Visuais
- Logo compacta e elegante.
- Borda inferior discreta.
- Responsividade: Ocultar textos secundários em telas muito pequenas, mantendo a logo e o botão de sair.
- Indicador de status (pulso) na última atualização.
