# ZUVVI-FECHAMENTO-CONTROLE

**Projeto:** Zuvvi  
**Processo:** Fechamento controlado  
**Sprint 0:** ✅ CONCLUÍDO  
**Sprint 1:** ✅ CONCLUÍDO E COMPROVADO PONTA A PONTA  
**Data do fechamento funcional do Sprint 1:** 20/08/2026  
**Último commit funcional de referência:** e52a679aaa474d798003c906a6b01260454cbbd4

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
11. **Processo oficial:** ALTEROU → AUDITORIA INDEPENDENTE → TESTE → CONTRA-PROVA → SOMENTE ENTÃO FECHAMENTO.
22. Todo prompt funcional deve possuir TRAVA MÁXIMA.
23. Tudo não autorizado é proibido.
24. Se a solução exigir alteração fora do escopo ou colocar em risco fluxo já aprovado: ABORTAR A MISSÃO E REPORTAR O CONFLITO SEM IMPLEMENTAR.

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

### 0.7 — Atualização da Base de Contra-Prova — ✅ FECHADA
- ZUVVI-FECHAMENTO-CONTROLE.md atualizado para registrar as microetapas 0.4, 0.5 e 0.6;
- regressão visual pendente da 0.6 registrada;
- nenhuma alteração em código ou Supabase;
- auditoria independente aprovada.

### 0.8 — Fechamento de leitura pública prematura — ✅ FECHADA
- removida a policy de SELECT público direto de public.viagens_compartilhadas;
- migration aplicada: 20260820015148_58d2469a-32bb-4691-a7d1-65942e051ae8.sql;
- RLS permaneceu ativo;
- policy de participantes autorizados foi preservada;
- tabela permaneceu com 0 registros;
- nenhuma funcionalidade de compartilhamento foi criada;
- invasão documental ocorrida durante a execução foi revertida pela Microcorreção 0.8-A;
- auditoria independente final aprovada.

## Sprint 1 — Mototaxista aprovado — ✅ CONCLUÍDO E COMPROVADO PONTA A PONTA

### 1.1 — Veículo aprovado e ativo para operação — ✅ FECHADA
- Motorista somente pode operar com veículo aprovado e ativo.
- Regra validada tecnicamente e por contra-prova.

### 1.2 — Segurança do fluxo administrativo — ✅ FECHADA
- O fluxo administrativo inseguro/legado identificado no início do Sprint foi eliminado e consolidado conforme a implementação real.

### 1.3 — Roteamento por status do motorista — ✅ FECHADA
- Motorista aprovado → Home Motorista.
- Motorista não aprovado → fluxo correspondente ao estado.
- Roteamento validado.

### 1.4 — Elegibilidade por CNH, veículo e documentos — ✅ FECHADA
- Para ficar operacionalmente elegível são exigidos:
  - CNH preenchida;
  - categoria A ou AB;
  - CNH válida;
  - veículo aprovado e ativo;
  - seis documentos obrigatórios aprovados.
- Documentos obrigatórios: `identidade`, `cnh`, `comprovante_residencia`, `crlv`, `foto_veiculo`, `foto_placa`.

### 1.5 — Veículo perde aprovação — ✅ FECHADA
- Veículo não aprovado/inativo impede operação.
- Motorista é mantido ou forçado OFFLINE.

### 1.6 — Documento obrigatório perde aprovação — ✅ FECHADA
- Qualquer documento obrigatório diferente de aprovado impede operação.
- Motorista é mantido ou forçado OFFLINE.

### 1.7 — Validação administrativa de CNH — ✅ FECHADA
- Número da CNH obrigatório.
- Categoria somente A ou AB.
- Validade obrigatória.

### 1.8 — Aprovação administrativa exige veículo regular — ✅ FECHADA
- Aprovação final não ocorre sem veículo aprovado e ativo.

### 1.9 — Remoção do caminho legado de disponibilidade — ✅ FECHADA
- A lógica operacional passou a possuir caminho único/controlado.
- **1.9-A:** microcorreção de limpeza/escopo concluída.

### 1.10 — Retomada segura do onboarding — ✅ FECHADA
- Dados previamente informados são hidratados.
- CNH, Pix, veículo e documentos são retomados.
- Visualizar a tela não gera gravação automática.
- Veículo não é salvo novamente sem alteração real.
- **1.10-A:** hardening/fail-closed da hidratação concluído.

### 1.11 — Gestão profissional dos estados do motorista — ✅ FECHADA
- Estados comprovados: `em_preenchimento`, `em_analise`, `aprovado`, `recusado`, `suspenso`.
- Recusado mostra motivo.
- Suspenso mostra motivo.
- Em análise não exibe formulário completo.
- Aprovado acessa Home Motorista.
- Estado desconhecido permanece fail-closed.

#### 1.11-A — Leitura segura de status e isolamento de cache — ✅ FECHADA
- Leitura segura de status com isolamento de cache da query de feedback.

#### 1.11-B — Restauração controlada do refetch após alteração de escopo — ✅ FECHADA
- `refetch` restaurado na query de sessão; callback do `OnboardingForm` preservado.

#### 1.11-C — Feedback inline de erros administrativos — ✅ FECHADA
- Erros de aprovação não ficam silenciosos.
- Ação administrativa mostra falha real do backend.

#### 1.11-D — Status documental correcao_solicitada — ✅ FECHADA
- Enum `documento_status_analise` recebeu `correcao_solicitada`.
- Migration real: `20260820124505`.
- Esta continua sendo a migration mais recente no fechamento do Sprint 1.

#### 1.11-E — Admin pode solicitar correção da CNH — ✅ FECHADA
- Correção exige justificativa.
- Ação limitada à CNH nesta implementação.
- Não altera automaticamente veículo.
- Não altera automaticamente status global do motorista.

#### 1.11-F — Elegibilidade operacional central — ✅ FECHADA
- Criada regra central server-side para validar: status aprovado; CNH; categoria A ou AB; validade; veículo aprovado e ativo; seis documentos aprovados.
- Proteção nas portas: ficar ONLINE; watchdog da Home; atualização de GPS; busca de ofertas; aceite de corrida.
- Motorista irregular é forçado OFFLINE.
- A regra nunca coloca motorista ONLINE automaticamente.
- CNH usa dia civil `America/Sao_Paulo`; CNH válida até o próprio dia de vencimento.

#### 1.11-G — Admin profissional para CNH vencida — ✅ FECHADA
- CNH vencida aparece em vermelho com BLOQUEIO AUTOMÁTICO.
- Histórico da foto anteriormente aprovada é preservado.
- Aprovação documental de CNH vencida é bloqueada server-side.
- Botão Revisar ficou explícito.

#### 1.11-H — Tela "Atualize sua CNH" — ✅ FECHADA
- Motorista em análise com CNH vencida ou correção solicitada recebe tela exclusiva.
- A tela não abre onboarding completo.
- Veículo, Pix e outros documentos permanecem preservados.

#### 1.11-I — Correção exclusiva da CNH — ✅ FECHADA
- Motorista altera somente: número da CNH; categoria; validade; nova foto da CNH.
- Documento CNH volta para PENDENTE.
- Status global continua EM ANÁLISE.
- Motorista continua OFFLINE.
- Veículo não muda.
- Pix não muda.
- Outros cinco documentos não mudam.

#### 1.11-I-A — Hardening server-side do envio da CNH — ✅ FECHADA
- Storage path vinculado ao auth user; path estrito; MIME preliminar; tamanho máximo 10 MB.
- Objeto real do Storage validado; tamanho real validado.
- Assinaturas JPEG, PNG e WEBP verificadas.
- Data real validada; gravação final confirmada server-side; ordem fail-closed preservada.

#### 1.11-J — Hardening da aprovação final — ✅ FECHADA
- Validade por dia civil `America/Sao_Paulo`.
- Os seis documentos obrigatórios precisam estar APROVADOS.
- Pendente bloqueia; recusado bloqueia; `correcao_solicitada` bloqueia; qualquer status diferente de aprovado bloqueia.
- Aprovação final sempre grava `is_disponivel = false`.
- Audit log somente após confirmação da gravação.

#### 1.11-K — Aprovação final explícita na ficha — ✅ FECHADA
- Ficha do Motorista passou a possuir seção "APROVAÇÃO FINAL".
- Estados: PRONTO PARA APROVAÇÃO FINAL; CADASTRO APROVADO.
- A ação reutiliza o mesmo fluxo administrativo existente.
- Não cria segunda lógica de aprovação.
- Confirmação manual permanece obrigatória.

### Regressão em_preenchimento — ✅ APROVADA
- Conta limpa em `em_preenchimento` abriu formulário completo: CNH; veículo; Pix; seis documentos.
- Nenhuma gravação ocorreu apenas ao abrir a tela.

### 1.12 — Teste limpo ponta a ponta de novo motorista — ✅ FECHADA
- Executado teste limpo completo, sem reutilizar o caso de correção da Nivex.
- Sequência comprovada:
  - Cadastro inicialmente em `em_preenchimento`;
  - formulário completo aberto corretamente;
  - CNH preenchida;
  - Pix preenchido;
  - veículo preenchido;
  - seis documentos enviados;
  - botão "Enviar para Análise" somente habilitou após todos os requisitos obrigatórios;
  - cadastro enviado;
  - motorista passou para `em_analise`;
  - motorista permaneceu OFFLINE;
  - veículo passou para `em_analise`;
  - seis documentos ficaram pendentes;
  - Admin aprovou veículo;
  - motorista permaneceu `em_analise` e OFFLINE;
  - Admin aprovou os seis documentos;
  - motorista permaneceu `em_analise` e OFFLINE;
  - Ficha exibiu PRONTO PARA APROVAÇÃO FINAL;
  - Admin executou aprovação final;
  - backend gravou status `aprovado`;
  - backend preservou OFFLINE;
  - audit log registrou: `status_update_aprovado`;
  - aplicativo do motorista abriu: HOME MOTORISTA;
  - estado inicial: OFFLINE.

**TESTE PONTA A PONTA 1.12: ✅ APROVADO**

### Prova do fluxo de CNH vencida — ✅ COMPROVADO PONTA A PONTA
- CNH vencida detectada;
- bloqueio operacional automático;
- Admin exibiu bloqueio;
- motorista recebeu "ATUALIZE SUA CNH";
- nova validade e nova imagem enviadas;
- CNH voltou para PENDENTE;
- outros documentos preservados;
- veículo preservado;
- Pix preservado;
- Admin revisou nova CNH;
- nova CNH aprovada;
- aprovação final executada;
- motorista terminou APROVADO + OFFLINE;
- Home Motorista acessível.

**Status: ✅ FLUXO DE RECUPERAÇÃO DE CNH COMPROVADO PONTA A PONTA**

## Base de Contra-Prova final do Sprint 1

### GitHub
- Repositório: `zuvvi-oficial/zuvvi-moto-ride`
- Branch: `main`
- Commit funcional de referência: `e52a679aaa474d798003c906a6b01260454cbbd4`

### Supabase
- Projeto: `qycblinfvijhfjcmdoof`
- No fechamento do Sprint 1:
  - 14 tabelas públicas;
  - 14 tabelas com RLS habilitado;
  - 25 policies;
  - bucket `documentos-motorista` privado;
  - última migration: `20260820124505`.
- Nenhuma migration adicional foi necessária para o teste 1.12.

### Prova final da conta limpa
*(Somente dados técnicos não sensíveis)*
- Motorista final: APROVADO.
- Disponibilidade: OFFLINE.
- CNH: categoria A; validade futura.
- Veículo: `ABC-1D23`; APROVADO; ATIVO.
- Documentos: 6 de 6 APROVADOS.
- Home Motorista: ACESSÍVEL.
- Estado inicial: OFFLINE.

### Prova final do caso de correção de CNH
- Motorista final: APROVADO; OFFLINE.
- CNH atualizada: validade futura.
- Documento CNH: APROVADO.
- Veículo: APROVADO + ATIVO.
- Demais documentos: APROVADOS.

## Pendências técnicas conhecidas — NÃO CORRIGIR, SOMENTE DOCUMENTAR

### LINT GLOBAL — PENDENTE
- O comando global de lint continua falhando por grande quantidade de problemas preexistentes de Prettier e tipos `any`.
- Esta pendência NÃO foi mascarada como sucesso. Não se declara "zero erros".

### CI — PENDENTE
- O repositório não possui atualmente uma prova automatizada de CI equivalente às contra-provas manuais executadas.
- Os combined statuses consultados durante as auditorias não apresentaram pipeline significativo.

### MAPBOX
- A regressão visual da Microetapa 0.6 continua adiada até existir o fluxo de corrida/aceite necessário para teste real.

### Pendências herdadas do Sprint 0 (permanecem válidas para Sprints futuros)
- Proteção contra senhas vazadas depende de avaliação/plano do Supabase;
- Fluxo real de oferta/aceite de corrida ainda não fechado;
- Rastreamento ao vivo ainda não fechado;
- Notificações ainda não fechadas;
- Pagamentos reais ainda não fechados;
- Avaliações ainda não fechadas;
- Admin completo ainda não fechado;
- Piloto real ainda não autorizado.

### Sprint 2 e seguintes — fora do escopo do Sprint 1
Permanecem fora do escopo:
- recebimento real de corridas;
- rastreamento ao vivo;
- notificações;
- pagamentos;
- avaliações;
- Admin completo;
- compartilhamento de viagem;
- piloto Jacarezinho.
Estes itens NÃO estão marcados como concluídos.

## Status final

**SPRINT 0 — ✅ CONCLUÍDO**

**SPRINT 1 — ✅ CONCLUÍDO E COMPROVADO PONTA A PONTA**

**FECHAMENTO FUNCIONAL:** 20/08/2026  
**COMMIT DE REFERÊNCIA:** e52a679aaa474d798003c906a6b01260454cbbd4

**Próxima etapa oficial:**
Sprint 2 — Mototaxista recebe corridas.

SPRINT 2 AINDA NÃO INICIADO. Antes da primeira alteração do Sprint 2 é obrigatória:
- nova auditoria GitHub;
- nova auditoria Supabase;
- leitura do Documento Mestre;
- leitura do Plano de Fechamento;
- leitura desta Base de Contra-Prova;
- definição de novo baseline;
- primeira microetapa isolada;
- TRAVA MÁXIMA.