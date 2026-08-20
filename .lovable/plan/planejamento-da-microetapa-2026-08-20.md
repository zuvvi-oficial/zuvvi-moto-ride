ZUVVI — SPRINT 2
MICROETAPA 2.1 — ACEITE ATÔMICO E SEGURO DE CORRIDA

### Planejamento da Microetapa

1.  **Migração SQL**:
    *   Criar RPC `accept_corrida_atomic(p_corrida_id uuid, p_motorista_id uuid)`.
    *   Criar índice UNIQUE parcial em `corridas(motorista_id)` para status ativos.
    *   Configurar permissões estritas (apenas `service_role`).

2.  **Server Functions (`src/lib/motorista.functions.ts`)**:
    *   Refatorar `aceitarCorrida` para chamar a RPC `accept_corrida_atomic`.
    *   Remover updates manuais em `corridas` e `motoristas` dentro da função.
    *   Manter todas as validações de elegibilidade e segurança server-side.

3.  **Tipos do Supabase**:
    *   Atualizar `src/integrations/supabase/types.ts` se necessário (o Lovable geralmente atualiza automaticamente, mas vou garantir a consistência).

### Verificações Prévias (Auditoria)
- [ ] Validar se `4c7de3baca49c17f1e591a30bfae198b72920e95` é o baseline.
- [ ] Confirmar que não há corridas violando o novo índice UNIQUE.
- [ ] Garantir que `evaluateMotoristaOperationalEligibility` seja preservado.

---
**Status: Aguardando aprovação do plano.**
