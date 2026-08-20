# ZUVVI-FECHAMENTO-CONTROLE

**Projeto:** Zuvvi  
**Processo:** Fechamento controlado  
**Etapa atual:** Sprint 0 — Organização, segurança e estabilização  
**Último commit de referência:** a21492eef00a5640f3c286a5c61da6ef057e9dd6

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

### 0.4 — Base de Contra-Prova permanente — ✅ FECHADA
- arquivo ZUVVI-FECHAMENTO-CONTROLE.md criado;
- processo de microetapas e auditoria antes/depois registrado;
- nenhuma alteração no Supabase.

### 0.5 — Remoção do bootstrap automático de Admin — ✅ FECHADA
- bootstrap por e-mail removido de src/lib/admin.server.ts;
- autorização Admin depende de admin_users, ativo = true e role = admin;
- banco permaneceu intacto;
- teste manual aprovado nas telas Gestão de Motoristas, Gestão de Veículos e Gestão de Cidades.

### 0.6 — Proteção de getMapboxToken — ✅ FECHADA TECNICAMENTE
- getMapboxToken agora exige requireSupabaseAuth;
- logs que revelavam informações sobre o token foram removidos;
- nenhuma alteração no Supabase;
- teste visual do mapa/acompanhamento ficou ADIADO, pois depende da implementação futura do fluxo:
  - Passageiro solicita → Mototaxista recebe → Mototaxista aceita → acompanhamento/mapa
- **Observação:** A regressão visual da 0.6 deverá ser executada obrigatoriamente quando o fluxo de aceite do Mototaxista estiver disponível.

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
A definir após auditoria técnica de encerramento do Sprint 0.
