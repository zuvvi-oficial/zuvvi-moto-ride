# CONTRAPROVA TÉCNICA — ETAPA 4 / COBRANÇA PIX E RECONCILIAÇÃO

**Data:** 25/08/2026  
**Fonte normativa:** `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI.md` v1.30  
**Branch:** `feature/pix-100-seguro`  
**Checkpoint técnico:** `4cd57e332171311ba9a90c877df902f525f5fd3e`  
**Supabase:** `qycblinfvijhfjcmdoof`

## 1. Objetivo

Registrar a contraprova técnica da Etapa 4 — cobrança Pix após aceite — incluindo compensação segura de falha determinística e reconciliação canônica quando o estado externo do Mercado Pago for incerto.

Este documento não autoriza merge, deploy, cobrança real, Webhook, alteração de dinheiro/cartão ou avanço em desacordo com a Fonte da Verdade.

## 2. Arquitetura comprovada

No checkpoint acima, o motor de cobrança:

- cria a cobrança somente após o aceite de motorista elegível;
- usa Access Token OAuth do próprio motorista vendedor;
- renova e rotaciona token quando necessário;
- usa `application_fee` com a comissão congelada da corrida;
- usa chave de idempotência determinística;
- envia `external_reference` determinístico para recuperação posterior;
- não usa token geral da plataforma;
- persiste o ID Mercado Pago e a tentativa de forma controlada;
- impede segunda cobrança concorrente para o mesmo agregado.

## 3. Compensação segura de falha

Migration aplicada e alinhada no Supabase principal:

`20260825172410_pix_charge_failure_compensation.sql`

Função:

`public.pix_charge_failure_compensate(uuid, uuid, uuid, text)`

Contraprova de catálogo/ACL:

- `SECURITY INVOKER`;
- `search_path` fechado;
- `anon`: sem `EXECUTE`;
- `authenticated`: sem `EXECUTE`;
- `service_role`: com `EXECUTE`;
- bloqueia compensação se o agregado ou a tentativa já possuir identificador Mercado Pago;
- em falha comprovadamente sem cobrança externa, marca tentativa/agregado como falhos, cancela tecnicamente a corrida e libera o motorista;
- dinheiro/cartão não entram nessa função.

A migration foi primeiro gerada/testada em Supabase local descartável pela CLI 2.115.0. A prova pgTAP passou 23/23, com lint e advisors locais sem issues. Depois foi versionada, repetida e somente então aplicada no projeto principal.

## 4. Correção de estado externo incerto

Foi identificado e corrigido um risco importante: erro de rede, rate limit, conflito de idempotência ou erro 5xx durante o POST não prova que o Mercado Pago deixou de criar a cobrança.

A regra final é falhar fechado:

- rejeições HTTP determinísticas 400, 401, 403, 404 e 422 podem entrar na compensação segura;
- 409, 429, 5xx e falhas de transporte/rede NÃO cancelam automaticamente a corrida como se não houvesse cobrança;
- nesses cenários, o sistema tenta localizar a cobrança pelo `external_reference` e consultar o pagamento canônico;
- se a cobrança for encontrada e validada, o resultado é persistido sem criar um segundo Pix;
- se não for possível provar o estado externo, a tentativa permanece para reconciliação e nenhuma segunda cobrança é criada.

## 5. Validação canônica Mercado Pago

O módulo servidor `src/lib/pix-mercadopago-reconcile.server.ts` valida antes de confiar no pagamento recuperado:

- Payment ID;
- `external_reference` exata;
- `payment_method_id = pix`;
- moeda `BRL`;
- `collector_id` igual à conta Mercado Pago do motorista esperado;
- valor total em centavos igual ao snapshot financeiro;
- QR Code e QR Code Base64 presentes.

Busca por referência ambígua é bloqueada. Divergência de vendedor, valor, meio ou moeda falha fechada.

## 6. Regressão acumulada

No checkpoint `4cd57e332171311ba9a90c877df902f525f5fd3e`, 12 workflows Pix finalizaram com sucesso:

1. PIX OAuth Crypto;
2. PIX Mercado Pago OAuth Client;
3. PIX Compensação falha de cobrança;
4. PIX DB Attempts and Webhook Events;
5. PIX DB Foundation;
6. PIX DB OAuth FK Index;
7. PIX DB OAuth State and PKCE;
8. PIX Criação Financeira Atômica;
9. PIX DB Aggregate Integrity;
10. PIX Cobrança após aceite;
11. PIX DB Mercado Pago Account Uniqueness;
12. PIX DB OAuth Atomic Connection.

O workflow de cobrança comprovou novamente:

- motorista conectado;
- motorista desconectado bloqueado;
- token expirado e renovação;
- comissão congelada;
- idempotência;
- persistência do ID Mercado Pago;
- regressão de dinheiro e cartão sem dependência Mercado Pago;
- testes TypeScript da Etapa 4;
- TypeScript integral;
- build de produção.

## 7. Fotografia do Supabase principal após a microetapa

- corridas totais: 103;
- pagamentos totais: 86;
- pagamentos Pix históricos: 6;
- corridas Pix ativas: 0;
- tentativas Pix ativas: 0;
- pagamentos duplicados por corrida: 0;
- IDs Mercado Pago duplicados: 0;
- migration Pix final: `20260825172410_pix_charge_failure_compensation`.

A microetapa de reconciliação não executou DDL nem DML no Supabase principal.

## 8. Classificação honesta

**ETAPA 4 — APROVADA TECNICAMENTE EM CÓDIGO + CI + CATÁLOGO REAL; HOMOLOGAÇÃO FINANCEIRA MERCADO PAGO AINDA PENDENTE.**

A Fonte da Verdade exige prova ponta a ponta com Mercado Pago Sandbox/conta de vendedor para a classificação formal final `APROVADA`.

Ainda falta comprovar externamente, com credencial OAuth de teste/real controlada:

1. cobrança criada na conta correta do motorista;
2. valor bruto exato;
3. `application_fee` exata da Zuvvi;
4. QR Pix válido;
5. repetição com a mesma idempotência sem cobrança duplicada;
6. recuperação/reconciliação contra resposta real do provedor.

Nenhum dado fictício deve ser apresentado como essa prova externa.

## 9. Checkpoint de restauração

Em caso de regressão, o checkpoint técnico desta Etapa 4 é:

`4cd57e332171311ba9a90c877df902f525f5fd3e`

Banco aprovado até:

`20260825172410_pix_charge_failure_compensation`

A PR permanece em rascunho e sem merge. Dinheiro/cartão não receberam alteração de regra nesta microetapa.
