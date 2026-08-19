# Plano de Implementação - Fase 1: Gestão de Cidades (Somente Leitura)

Implementação da visualização administrativa de cidades no painel do Zuvvi, permitindo que administradores consultem a base geográfica, status operacional e configurações de tarifas sem permissão de alteração.

## Alterações Técnicas

### 1. Funções de Servidor (Server Functions)
- **Arquivo**: `src/lib/admin.functions.ts`
- **Nova Função**: `getCidadesAdmin`
  - Protegida por `requireSupabaseAuth` e `checkAdmin`.
  - Parâmetros: `pagina` (offset), `limite` (20 por padrão), `uf` (filtro), `status` (filtro), `busca` (nome da cidade).
  - Retorno: Lista de cidades com contagem total de usuários e motoristas por cidade, além de metadados para paginação.
- **Nova Função**: `getUFsAdmin`
  - Reuso ou adaptação de `getUFs` para o contexto administrativo.

### 2. Interface Administrativa (Frontend)
- **Novo Arquivo**: `src/routes/admin/cidades.tsx`
  - Rota de listagem de cidades.
  - Componentes Shadcn: `Table`, `Input` (busca), `Select` (filtros UF/Status), `Pagination`.
  - Visualização dos campos: Nome, UF, Status, Bandeirada, Valor KM, Valor Min, Tarifa Mínima, Comissão %.
  - Badge colorido para status (`piloto`, `ativa`, `em_breve`, `desativada`).
- **Modificação**: `src/routes/admin/index.tsx`
  - Adicionar link "Gerenciar Cidades" no dashboard principal.

## Portões de Segurança e Restrições
- **Somente Leitura**: Nenhuma função de `UPDATE` ou `INSERT` será criada nesta fase.
- **Schema Fixo**: Uso estrito dos campos `bandeirada`, `valor_km`, `valor_min`, `tarifa_minima` e `comissao_pct`.
- **Isolamento**: Acesso restrito ao papel `admin` via middleware.

## Verificação
- Inspecionar a nova rota no painel administrativo.
- Testar filtros por UF e busca por nome.
- Validar se a paginação responde corretamente ao volume de >5.500 registros.
- Confirmar que não há botões de "Editar" ou "Salvar" na interface.
