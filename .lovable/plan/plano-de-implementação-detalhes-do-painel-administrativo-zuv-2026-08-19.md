# Plano de Implementação - Detalhes do Painel Administrativo Zuvvi

Adição de funcionalidade de visualização detalhada para motoristas e veículos no painel administrativo, garantindo acesso seguro a dados sensíveis e documentos via URLs assinadas.

## Alterações

### 1. Funções de Servidor (Server Functions)
- **src/lib/admin.functions.ts**:
    - `getMotoristaDetalheAdmin`: Nova função para carregar dados completos (usuário, motorista, cidade, veículo, documentos e logs de auditoria).
    - `getVeiculoDetalheAdmin`: Nova função para carregar dados do veículo e seu proprietário.
    - Proteção via `checkAdmin` e `requireSupabaseAuth`.
    - Mascaramento de CPF e Pix no servidor (exibição apenas se autorizado).
    - Geração de URLs assinadas para documentos no Storage.

### 2. Interface (Frontend)
- **src/routes/admin/motoristas.tsx**:
    - Adição de coluna "Detalhes" com ícone de olho (Lucide `Eye`).
    - Implementação de um `Sheet` ou `Dialog` lateral para exibir a ficha do motorista.
    - Estados de loading e erro.
- **src/routes/admin/veiculos.tsx**:
    - Adição de ícone "Ver detalhes" em cada linha.
    - Implementação da ficha detalhada do veículo.

### 3. Componentes de UI
- Uso de componentes Shadcn existentes: `Sheet`, `Badge`, `Card`, `Separator`, `Tooltip`.

## Detalhes Técnicos
- **Segurança**: Consultas feitas via `supabaseAdmin` para acessar tabelas protegidas. O retorno é filtrado para campos específicos.
- **Documentos**: Uso de `supabaseAdmin.storage.from('documentos-motorista').createSignedUrl(path, 60)` para acesso temporário.
- **Auditoria**: Filtro na tabela `admin_audit_logs` pelo `entidade_id` correspondente.

## Verificação
- Validação de que usuários não-admin recebem erro 403.
- Teste de visualização de documentos com URLs expiradas.
- Verificação do mascaramento de dados sensíveis.
