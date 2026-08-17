# Plano de Atualização do Design System Zuvvi

Este plano descreve a substituição da paleta visual "Asphalt & Amber" pela identidade visual oficial da marca Zuvvi, incluindo novos tokens de cor, tipografia Poppins e atualização das telas de Landing Page, Login e Cadastro.

## Alterações Visuais

### Design System (CSS Globals)
- **Paleta de Cores:**
    - Primária: Zuvvi Indigo (`#130F36`)
    - Cabeçalhos/Nav: Zuvvi Indigo Escuro (`#1C1650`)
    - Interativo/Links: Zuvvi Violeta (`#6C3CE9`)
    - Ação/CTAs: Zuvvi Volt (`#C6FF3D`)
    - Alertas: Zuvvi Amber (`#FFB020`)
    - Semânticas: Sucesso (`#22C55E`), Perigo (`#EF4444`), Info (`#38BDF8`)
    - Texto: Cinza Texto (`#3F4354`), Cinza Neutro (`#6B7280`)
- **Tipografia:**
    - Títulos: Poppins SemiBold/Bold
    - Corpo: Poppins Regular (14-16px)
    - Botões: Poppins Medium
- **Utilidades:**
    - Substituir `ember-text`, `ember-glow`, `asphalt-gradient` por novas utilidades baseadas na marca Zuvvi (`volt-text`, `zuvvi-shadow`, etc).

### Telas
- **Landing Page (`/`):** Atualizar Hero, Header, Seções de Valores e Manifesto com a nova paleta e fontes.
- **Login (`/auth/login`) e Cadastro (`/auth/cadastro`):** Ajustar formulários, botões e labels para os novos tons de Indigo e Volt.

## Detalhes Técnicos

- **Arquivos a editar:**
    - `src/styles.css`: Atualização de variáveis `@theme` e `:root`.
    - `src/routes/__root.tsx`: Inclusão da fonte Poppins via Google Fonts.
    - `src/routes/index.tsx`: Atualização de classes CSS e cores de componentes.
    - `src/routes/auth.tsx`: Ajuste do layout de autenticação.
    - `src/routes/auth.login.tsx` & `src/routes/auth.cadastro.tsx`: Ajuste de cores de botões e estados de foco.

- **Nomenclatura:**
    - `primary`: Zuvvi Volt (`#C6FF3D`)
    - `background`: Zuvvi Indigo (`#130F36`)
    - `accent`: Zuvvi Violeta (`#6C3CE9`)
