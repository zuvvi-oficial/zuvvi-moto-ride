# CHECKPOINT PIX ZUVVI — ETAPA 0.3R

**Microetapa:** Reconciliação segura do histórico Git das migrations Pix  
**Data:** 27/08/2026  
**Fonte da Verdade:** `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI_V2.md`  
**Checkpoint anterior:** `docs/pix/checkpoints/ETAPA_0_3_RECONCILIACAO_MIGRATIONS.md`  
**Branch:** `feature/pix-100-seguro`  
**Supabase:** `qycblinfvijhfjcmdoof`  

## Objetivo

Alinhar exclusivamente os cinco timestamps de arquivos de migration no GitHub com as versões já registradas no histórico real do Supabase, sem executar migration, sem `migration repair`, sem DDL/DML remoto e sem alterar o SQL dos arquivos.

## Baseline antes da escrita

- `main`: `de4d054643f7c67f22ee9c183a84af05f0809db7`;
- branch Pix: `73067bd874aab804cecf7e7f89d7ebd87806cbd9`;
- tree base: `dcfe3d5f2fabd404538d219de3b795e36bb4b400`;
- PR `#2`: aberta, draft, não mergeada e não mergeável;
- CI/status no SHA da branch: nenhum status disponível no momento do baseline;
- os cinco nomes de destino foram confirmados como inexistentes na branch antes da escrita;
- o Supabase contém somente as cinco versões de produção esperadas, e não contém as versões divergentes da branch.

## Allowlist

Somente estes caminhos de migration podem ser renomeados, preservando o mesmo blob/conteúdo:

1. `20260826161000_pix_aguardando_pagamento_status.sql` → `20260826164605_pix_aguardando_pagamento_status.sql`
2. `20260826161100_pix_confirmacao_pagamento_gate.sql` → `20260826164714_pix_confirmacao_pagamento_gate.sql`
3. `20260826161200_pix_operational_gate_keep_accept.sql` → `20260826164927_pix_operational_gate_keep_accept.sql`
4. `20260826183600_pix_device_session_antifraud.sql` → `20260826184836_pix_device_session_antifraud.sql`
5. `20260826201000_pix_ticket_url_diagnostics.sql` → `20260826200511_pix_ticket_url_diagnostics.sql`

Além deles, somente este checkpoint documental pode ser criado.

## Regra de preservação

A reconciliação é feita por movimentação de caminho no Git tree usando os blobs Git já existentes. Nenhum SQL é reescrito. Portanto, o hash/blob de cada migration precisa permanecer o mesmo antes e depois da mudança de nome.

## Supabase

Nenhuma escrita é autorizada nesta microetapa. Em especial, é proibido:

- reaplicar qualquer uma das cinco migrations;
- alterar `supabase_migrations.schema_migrations`;
- executar `migration repair`;
- executar DDL/DML;
- modificar tabela, função, trigger, policy, índice ou dado.

## Rollback

Se a validação do commit revelar qualquer arquivo fora da allowlist ou qualquer mudança de blob/conteúdo, não avançar para a Etapa 0.4. Restaurar a branch ao parent `73067bd874aab804cecf7e7f89d7ebd87806cbd9` ou criar commit inverso que devolva exatamente os cinco caminhos antigos com os mesmos blobs.

## Critério de aprovação

A 0.3R só pode ser classificada como `APROVADA` após provar:

- exatamente cinco renames de migration e um checkpoint documental;
- nenhum SQL alterado nos cinco arquivos;
- nenhum outro arquivo alterado;
- `main` inalterada;
- Supabase sem escrita e com o mesmo histórico/contagens do baseline;
- os cinco nomes Git finais coincidindo com as versões de produção.
