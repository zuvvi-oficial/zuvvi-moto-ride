# Plano de Correção: Disponibilidade do Motorista

O problema identificado é que o motorista não consegue ficar "Online" porque o sistema exige um veículo com status `aprovado`. No entanto, durante a fase piloto ou de testes, o veículo pode estar `em_analise`, impedindo a ativação mesmo que o motorista já tenha sido aprovado individualmente.

## Alterações Propostas

### Backend (Server Functions)
- Ajustar a lógica em `src/lib/motorista-status.functions.ts` para permitir que motoristas fiquem online se o veículo estiver em estado `aprovado` **OU** `em_analise` (caso o motorista já tenha sido aprovado pelo administrador).
- Manter a trava de segurança que impede ficar online se não houver NENHUM veículo vinculado ou se o veículo estiver explicitamente `rejeitado`.

### Frontend (UI)
- Nenhuma alteração visual necessária, pois o feedback de erro já é tratado pelo `toast`. Apenas a lógica de permissão no servidor será flexibilizada para o fluxo operacional.

## Detalhes Técnicos
- Modificar a consulta SQL em `updateMotoristaDisponibilidade` para aceitar `status_aprovacao` IN ('aprovado', 'em_analise').
- Garantir que a auditoria (`createAuditLog`) registre corretamente a tentativa de mudança de status.

## Inegociável
- **Proteção do Core**: Não serão alteradas tabelas do banco de dados, nem o fluxo de autenticação ou onboarding. Apenas a regra de negócio de ativação de disponibilidade será refinada.
