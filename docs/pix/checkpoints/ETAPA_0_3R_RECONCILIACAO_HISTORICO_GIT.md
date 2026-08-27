# CHECKPOINT PIX ZUVVI — ETAPA 0.3R

**Microetapa:** Reconciliação segura do histórico Git das migrations Pix  
**Data:** 27/08/2026  
**Fonte da Verdade:** `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI_V2.md`  
**Checkpoint anterior:** `docs/pix/checkpoints/ETAPA_0_3_RECONCILIACAO_MIGRATIONS.md`  
**Branch:** `feature/pix-100-seguro`  
**Supabase:** `qycblinfvijhfjcmdoof`  
**Classificação final:** **APROVADA**

## Objetivo

Alinhar exclusivamente os cinco timestamps de arquivos de migration no GitHub com as versões já registradas no histórico real do Supabase, sem executar migration, sem `migration repair`, sem DDL/DML remoto e sem alterar o SQL dos arquivos.

## Baseline antes da escrita

- `main`: `de4d054643f7c67f22ee9c183a84af05f0809db7`;
- branch Pix: `73067bd874aab804cecf7e7f89d7ebd87806cbd9`;
- tree base: `dcfe3d5f2fabd404538d219de3b795e36bb4b400`;
- PR `#2`: aberta, draft, não mergeada e não mergeável;
- CI/status no SHA da branch: nenhum status disponível no momento do baseline;
- os cinco nomes de destino foram confirmados como inexistentes na branch antes da escrita;
- o Supabase continha somente as cinco versões de produção esperadas, e não as versões divergentes da branch.

## Allowlist executada

Somente estes caminhos de migration foram renomeados, preservando o mesmo blob/conteúdo:

1. `20260826161000_pix_aguardando_pagamento_status.sql` → `20260826164605_pix_aguardando_pagamento_status.sql`
2. `20260826161100_pix_confirmacao_pagamento_gate.sql` → `20260826164714_pix_confirmacao_pagamento_gate.sql`
3. `20260826161200_pix_operational_gate_keep_accept.sql` → `20260826164927_pix_operational_gate_keep_accept.sql`
4. `20260826183600_pix_device_session_antifraud.sql` → `20260826184836_pix_device_session_antifraud.sql`
5. `20260826201000_pix_ticket_url_diagnostics.sql` → `20260826200511_pix_ticket_url_diagnostics.sql`

Além deles, somente este checkpoint documental foi criado/atualizado.

## Commit funcional da reconciliação

Commit:

`c4625310eac1718f6965068149d655da74325037`

Mensagem:

`chore(pix): reconcilia timestamps das migrations com produção`

A comparação do parent `73067bd874aab804cecf7e7f89d7ebd87806cbd9` com esse commit confirmou:

- 5 arquivos com status GitHub `renamed`;
- 0 adições nos cinco arquivos SQL;
- 0 exclusões nos cinco arquivos SQL;
- 0 mudanças de conteúdo nos cinco arquivos SQL;
- 1 único arquivo adicional: este checkpoint documental.

Portanto, nenhum SQL foi reescrito.

## Prova de preservação

Os renames foram construídos reutilizando diretamente os blobs Git existentes dos cinco arquivos. O GitHub reconheceu cada par como rename puro com `changes = 0`.

Não houve alteração em código de aplicação, dependência, lockfile, dinheiro, cartão, OAuth funcional, pagamentos, corrida ou qualquer área de core.

## Prova do Supabase após a escrita Git

Depois do commit Git, o Supabase foi consultado novamente somente por `SELECT`.

O histórico continuou contendo exatamente as versões:

- `20260826164605_pix_aguardando_pagamento_status`;
- `20260826164714_pix_confirmacao_pagamento_gate`;
- `20260826164927_pix_operational_gate_keep_accept`;
- `20260826184836_pix_device_session_antifraud`;
- `20260826200511_pix_ticket_url_diagnostics`.

As cinco versões antigas divergentes continuaram ausentes do histórico de produção.

A migration mais recente permaneceu:

`20260826200511_pix_ticket_url_diagnostics`

Contagens de controle permaneceram iguais ao baseline:

- tentativas Pix: 33 total;
- `falhou`: 33;
- `criando`: 0;
- `pendente`: 0;
- `pago`: 0;
- `estornado`: 0;
- credenciais OAuth: 2 total;
- ativas: 1;
- revogadas: 1.

Isso comprova ausência de escrita ou efeito operacional no Supabase durante a 0.3R.

## Main

A `main` foi reconferida após a mudança e permaneceu em:

`de4d054643f7c67f22ee9c183a84af05f0809db7`

Logo, a `main` permaneceu intacta.

## Rollback

Não foi necessário rollback.

Se futuramente for necessário desfazer apenas esta reconciliação, o ponto imediatamente anterior aos renames é:

`73067bd874aab804cecf7e7f89d7ebd87806cbd9`

Qualquer reversão deve preservar os mesmos blobs e nunca reaplicar SQL no Supabase.

## Classificação

**APROVADA**

Critérios satisfeitos:

- cinco e somente cinco renames de migration;
- conteúdo SQL preservado integralmente;
- nenhum arquivo de código alterado;
- nenhum objeto ou dado Supabase alterado;
- `main` inalterada;
- nomes/timestamps finais do GitHub agora coincidem com o histórico real de produção.

A Etapa 0.4 pode ser iniciada somente após reabrir a Fonte da Verdade V2, registrar novo baseline e executar a integração controlada da `main` na branch Pix conforme as regras do plano mestre.
