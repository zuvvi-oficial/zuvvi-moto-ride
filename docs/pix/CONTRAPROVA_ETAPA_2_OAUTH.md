# CONTRAPROVA TÉCNICA — ETAPA 2 / OAUTH PIX

**Data:** 25/08/2026  
**Fonte normativa:** `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI.md` v1.30  
**Branch:** `feature/pix-100-seguro`  
**Checkpoint de código antes desta contraprova:** `80c605cdf2841f76ce89ae42a3ace271b9394ecf`  
**Supabase:** `qycblinfvijhfjcmdoof`

## 1. Objetivo

Registrar a contraprova técnica e o checkpoint de restauração da Etapa 2 — OAuth seguro do motorista, após a aplicação controlada da migration de desconexão segura no Supabase principal.

Este documento não autoriza merge, deploy, cobrança real, Webhook, alteração de dinheiro/cartão nem avanço de etapa em desacordo com a Fonte da Verdade.

## 2. Migration aplicada e reconciliada

Arquivo versionado no GitHub:

`supabase/migrations/20260825123937_pix_oauth_safe_disconnect.sql`

A aplicação pelo conector do Supabase criou inicialmente uma versão remota temporária diferente da identidade do arquivo. O histórico foi reconciliado imediatamente e somente para essa entrada, preservando a versão oficial do arquivo:

`20260825123937_pix_oauth_safe_disconnect`

Contraprova pós-reconciliação:

- a versão oficial `20260825123937` existe no histórico remoto;
- a versão temporária criada pelo conector não permanece no histórico;
- nenhuma migration anterior foi alterada;
- a função `public.pix_oauth_disconnect_safe(uuid)` existe no catálogo real.

## 3. Contraprova de segurança da função

Estado verificado no Supabase principal:

- `SECURITY INVOKER`;
- `search_path` fechado;
- `anon`: sem `EXECUTE`;
- `authenticated`: sem `EXECUTE`;
- `service_role`: com `EXECUTE`;
- bloqueio de corrida Pix ativa presente;
- bloqueio de obrigação financeira Pix presente;
- revogação dos envelopes de Access Token e Refresh Token presente;
- limpeza da projeção pública `motoristas.conta_mercado_pago_id` presente;
- trava pessimista da linha do motorista (`FOR UPDATE`) presente.

## 4. Integridade financeira pós-aplicação

Fotografia de controle imediatamente após a aplicação:

- corridas totais: 102;
- pagamentos totais: 85;
- pagamentos Pix históricos: 5;
- tentativas Pix: 0;
- credenciais OAuth privadas: 0;
- corridas Pix ativas: 0;
- pagamentos duplicados por corrida: 0;
- IDs Mercado Pago duplicados: 0.

As contagens financeiras permaneceram inalteradas pela migration.

## 5. Código da Etapa 2 já presente na branch

O fluxo atual da branch já contém, de forma isolada no servidor:

- state OAuth de uso único;
- PKCE S256;
- Access Token e Refresh Token criptografados;
- renovação de Access Token;
- vínculo privado/público coerente da conta Mercado Pago;
- Server Functions autenticadas;
- callback que aceita somente `code` e `state`;
- status de conexão que exige credencial privada ativa e coerente;
- filtro de oferta Pix que não confia apenas em `conta_mercado_pago_id`;
- desconexão segura ligada à RPC `pix_oauth_disconnect_safe`.

## 6. Regressão acumulada

No checkpoint `80c605cdf2841f76ce89ae42a3ace271b9394ecf`, os 11 workflows Pix associados ao commit finalizaram com sucesso, incluindo fundação, OAuth, integridade agregada, criação financeira atômica e cobrança após aceite.

A migration de desconexão segura possui prova pgTAP local acumulada e agora também possui contraprova de catálogo/ACL no Supabase principal.

## 7. Advisors

Após a aplicação, os Advisors foram executados novamente.

Não foi identificado alerta novo causado por `pix_oauth_disconnect_safe`.

Avisos restantes pertencem a objetos preexistentes ou a estruturas Pix deliberadamente fechadas para `service_role`; não fazem parte desta microetapa e não devem ser corrigidos lateralmente.

## 8. Classificação honesta

**ETAPA 2 — APROVADA TECNICAMENTE EM CÓDIGO + CI + CATÁLOGO REAL, COM HOMOLOGAÇÃO E2E MERCADO PAGO AINDA PENDENTE.**

A Fonte da Verdade exige teste ponta a ponta e teste prático para a classificação final `APROVADA`. Como a branch Pix ainda não está executando em um ambiente de preview sem merge e não há credencial OAuth privada real no banco, não é correto declarar a Etapa 2 homologada ponta a ponta.

Não será usado dado fictício como prova de conexão real.

## 9. Bloqueio restante para aprovação formal

A única prova funcional externa ainda pendente da Etapa 2 é executar o fluxo real em ambiente que rode esta branch:

1. motorista autenticado inicia conexão;
2. Mercado Pago autoriza;
3. callback conclui com `code + state`;
4. credencial privada criptografada e projeção pública ficam coerentes;
5. refresh/reabertura mantém conexão;
6. replay/state inválido falham;
7. desconexão sem obrigação funciona;
8. desconexão com corrida Pix/obrigação financeira é bloqueada.

Até essa homologação, a Etapa 2 permanece formalmente parcial conforme a regra da Fonte da Verdade.

## 10. Checkpoint de restauração

Em caso de regressão, o destino de recuperação é:

- código: checkpoint anterior `80c605cdf2841f76ce89ae42a3ace271b9394ecf` mais este documento de contraprova;
- migration remota final: `20260825123937_pix_oauth_safe_disconnect`;
- nenhuma alteração em dinheiro/cartão;
- nenhuma Edge Function criada;
- nenhuma PR mesclada;
- nenhuma cobrança real realizada nesta contraprova.
