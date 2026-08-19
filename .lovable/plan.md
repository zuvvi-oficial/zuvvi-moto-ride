# Plano de Melhoria: Gestão de Veículos (Zuvvi Admin)

Ajustes na rota `/admin/veiculos` para inclusão de status "Suspenso", melhoria visual do status "Em Análise" e funcionalidade de edição de dados técnicos do veículo.

## Mudanças Técnicas

### 1. Backend (`src/lib/admin.functions.ts`)
- **Nova função `updateDadosVeiculo`**: 
    - Proteção via `checkAdmin`.
    - Recebe `veiculoId` e campos: `placa`, `marca`, `modelo`, `ano`, `cor`.
    - Validação de entrada com Zod.
    - Executa `update` na tabela `veiculos`.
    - Gera log de auditoria via `createAuditLog` registrando o estado anterior e novo.
    - Retorna o registro atualizado para confirmação.

### 2. Frontend (`src/routes/admin/veiculos.tsx`)
- **Visualização de Status**:
    - Alterar badge `em_analise` para azul (`#38BDF8` / `text-sky-400`).
- **Ações na Tabela**:
    - Adicionar botão **Suspender** (somente se `status === 'aprovado'`).
    - O botão abre o `Dialog` existente, que agora deve suportar o título dinâmico e exigir justificativa para suspensão.
- **Edição no Painel Lateral (`Sheet`)**:
    - Nova seção "Editar Dados do Veículo".
    - Campos de input para Placa, Marca, Modelo, Ano e Cor.
    - Cada campo terá seu próprio botão "Salvar" ou um botão único de salvamento da seção (seguindo o padrão solicitado de "Cada campo com um botão Salvar").
    - **Bloqueio**: Desabilitar campos se `status_aprovacao` for `recusado` ou `suspenso`.
    - Feedback de sucesso via `toast` e invalidação de cache via React Query.

## Auto-Verificação (Checklist)
- [ ] O botão "Suspender" aparece apenas para veículos aprovados.
- [ ] O Dialog de suspensão exige justificativa obrigatória.
- [ ] Status `em_analise` agora é azul na tabela.
- [ ] Campos de edição estão desabilitados para veículos recusados ou suspensos.
- [ ] Nenhum outro arquivo foi alterado além dos dois permitidos.
