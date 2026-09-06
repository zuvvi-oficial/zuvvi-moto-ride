# P1B — Disponibilidade de mototaxistas — roteiro de teste para publicação

**Baseline da main antes da P1B:** `e89855533d0052268553f7f2a48e36b3d80431ec`  
**Branch:** `p1b/aviso-sem-motorista-online`  
**Status:** IMPLEMENTADA / TESTE MANUAL PENDENTE  
**Banco alterado:** NÃO  
**Migrations:** NENHUMA

## Objetivo

Quando a cidade estiver `piloto` ou `ativa`, a Home do passageiro deve distinguir:

- cidade atendida e com mototaxista elegível disponível;
- cidade atendida, porém sem mototaxista elegível disponível naquele momento.

## Regra de disponibilidade

A verificação complementar considera disponível somente mototaxista da mesma cidade, aprovado, online, com CNH válida A/AB, GPS recente, veículo aprovado/ativo, documentos obrigatórios aprovados e sem corrida operacional ativa.

A P1 continua sendo a autoridade da localização real: o aviso de ausência de mototaxista só pode aparecer depois que a origem GPS real também estiver autorizada para a cidade cadastrada.

## Teste manual pós-publicação

1. Iepê ainda `em_breve` → mantém a mensagem de cidade não atendida.
2. Alterar Iepê para `piloto`, com passageiro cadastrado em Iepê e nenhum mototaxista elegível online → mostrar **Estamos começando em Iepê** e não expor a solicitação de corrida.
3. Corridas, Carteira e Perfil devem continuar acessíveis.
4. Colocar um mototaxista de Iepê totalmente elegível online e com GPS recente → em até 15 segundos, ou ao tocar em **Verificar novamente**, o aviso deve desaparecer e a Home deve liberar origem/destino.
5. Colocar esse mototaxista offline novamente → o aviso deve reaparecer após nova verificação.
6. Passageiro fora da própria cidade cadastrada → prevalece o bloqueio da P1 por cidade/origem real; não deve aparecer o aviso de falta de motorista da cidade cadastrada.

## Travas

Não alterar nesta etapa: tarifa, criação/aceite de corrida, Pix, Mercado Pago, RLS, migrations, onboarding, documentos, GPS do motorista ou máquina de estados da corrida.

Se qualquer teste falhar, a P1B permanece aberta e deve ser corrigida antes de seguir para P2.
