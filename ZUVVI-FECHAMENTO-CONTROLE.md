# ZUVVI-FECHAMENTO-CONTROLE

**Projeto:** Zuvvi  
**Processo:** Fechamento controlado  
**Etapa atual:** Sprint 0 — Organização, segurança e estabilização  
**Último commit de referência:** 09ca80b4a00441154c042834c27d37a4bb5293b7

## Regras obrigatórias
1. Uma microetapa por vez.
2. Auditoria GitHub/Supabase antes da alteração.
3. Proteção explícita do core em todo prompt.
4. Tudo que não estiver autorizado fica proibido.
5. Auditoria GitHub/Supabase depois da alteração.
6. Mudança fora do escopo reprova a etapa até análise.
7. Teste manual quando aplicável.
8. Não avançar enquanto a etapa atual não estiver aprovada.
9. Registrar divergências entre GitHub e Supabase.
10. Não confiar apenas no relatório do agente executor.

## Microetapas concluídas

### 0.1 — Proteção de acesso à corrida — ✅ FECHADA
- `getCorrida` exige usuário autenticado participante da corrida.
- Passageiro proprietário autorizado.
- Motorista atribuído autorizado.
- Terceiros recebem resposta genérica "Corrida não encontrada".
- Teste manual de criação/visualização/cancelamento aprovado.

### 0.2 — Remoção de SECURITY DEFINER desnecessário — ✅ FECHADA
- `public.get_distinct_ufs()` passou a executar sem privilégio SECURITY DEFINER.
- Continua retornando 27 UFs.
- Permissões necessárias preservadas.
- Security Advisor deixou de acusar a função.

### 0.3 — Ownership da policy de INSERT de corridas — ✅ FECHADA
- Policy "Passageiros podem criar suas próprias corridas" corrigida.
- `passageiro_id` passa por `usuarios.id` → `auth_user_id` → `auth.uid()`.
- Migration aplicada real: `20260820012411_4cefdfa3-ced7-47f5-a92f-f1f10b629447.sql`.
- Drift temporário de migrations identificado e reconciliado.

## Pendências conhecidas — NÃO executar
*Registradas somente como pendências, sem correção:*
- Proteção contra senhas vazadas depende de avaliação/plano do Supabase;
- Fluxo real de oferta/aceite de corrida ainda não fechado;
- Rastreamento ao vivo ainda não fechado;
- Notificações ainda não fechadas;
- Pagamentos reais ainda não fechados;
- Avaliações ainda não fechadas;
- Admin completo ainda não fechado;
- Piloto real ainda não autorizado.

## Status
**SPRINT 0 EM ANDAMENTO**

**Próxima microetapa:**
A definir após auditoria técnica.
