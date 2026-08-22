# ZUVVI-FECHAMENTO-CONTROLE

**Projeto:** Zuvvi  
**Processo:** Fechamento controlado  
**Sprint 0:** ✅ CONCLUÍDO  
**Sprint 1:** ✅ CONCLUÍDO E COMPROVADO PONTA A PONTA  
**Data do fechamento funcional do Sprint 1:** 20/08/2026  
**Último commit funcional de referência:** f9d6f092ff5ad939cdfc39832e598aa6763a9500

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
12. Todo prompt funcional deve possuir TRAVA MÁXIMA.
13. Tudo não autorizado é proibido.
14. Se a solução exigir alteração fora do escopo ou colocar em risco fluxo já aprovado: ABORTAR A MISSÃO E REPORTAR O CONFLITO SEM IMPLEMENTAR.

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

**FECHAMENTO FUNCIONAL:** 21/08/2026  
**Último commit funcional de referência:** e52a679aaa474d798003c906a6b01260454cbbd4

**Próxima etapa oficial:**
Sprint 2 — GPS Pós-Aceite e Rastreamento.

## Reconciliação oficial do Sprint 2 — Baseline 20/08/2026

### Auditoria
- Microetapa 2.0-R — auditoria de reconciliação realizada.
- Microcorreção 2.0-R-A — divergências da auditoria corrigidas.
- Contra-prova independente GitHub/Supabase concluída.
- baseline oficial atual: 6a6717e9d48b7b04988c879fe3a119bc4c697e86.

### Funcionalidades tecnicamente existentes (SEM DECLARAR O SPRINT 2 CONCLUÍDO)
- motorista online/offline;
- GPS antes do aceite;
- recebimento real de ofertas;
- filtro por cidade;
- filtro por elegibilidade operacional;
- ordenação por proximidade;
- recusa de corrida;
- aceite de corrida;
- aceite atômico;
- proteção contra aceite concorrente;
- proteção contra duas corridas ativas para o mesmo motorista;
- recuperação/exibição de corrida ativa na Home Motorista;
- Realtime de public.corridas;
- passageiro detecta aceite;
- passageiro é redirecionado para /acompanhamento;
- handoff seguro de dados da corrida, motorista e veículo;
- mapa do passageiro já existente.

### MICROETAPAS COMPROVADAS POR MIGRATION
- **20260820164016**: accept_corrida_atomic + índice único de corrida ativa.
- **20260820175105**: set_motorista_online_atomic.
- **20260820183150**: Microetapa 2.5 — Realtime de public.corridas.

*Nota: Existe implementação posterior à 2.5 relacionada ao handoff do passageiro, porém ela ainda não possui fechamento documental oficial. A numeração 2.6-A NÃO é oficial.*

### BLOQUEADOR CRÍTICO — GPS PÓS-ACEITE
**GPS DURANTE CORRIDA ATIVA: NÃO FUNCIONA ATUALMENTE.**

**Motivo comprovado:**
1. `accept_corrida_atomic` grava `motoristas.is_disponivel = false` após o aceite;
2. `home-motorista.tsx` mantém `watchPosition` somente enquanto `status.is_disponivel = true`;
3. Quando `is_disponivel = false`, o frontend executa `stopGps()`;
4. `updateLocalizacaoMotorista` também rejeita server-side o envio de GPS se `is_disponivel = false`.

**Consequência:** O motorista deixa de transmitir localização após aceitar a corrida.

### MAPAS E RASTREAMENTO
- Mapa do passageiro: **IMPLEMENTADO**.
- Rastreamento ao vivo do motorista pelo passageiro: **NÃO IMPLEMENTADO**.
- Mapa operacional do motorista após aceite: **NÃO IMPLEMENTADO**.
- Rota do motorista até o passageiro: **NÃO IMPLEMENTADA**.

### ESTADOS POSTERIORES DA CORRIDA (NÃO FECHADOS)
- `motorista_a_caminho`;
- `motorista_chegou`;
- início real da corrida;
- `em_andamento`;
- conclusão real da corrida.

> **REGISTRO HISTÓRICO — SUPERADO EM 21/08/2026**
> O diagnóstico abaixo registra o estado encontrado na auditoria
> anterior e é preservado exclusivamente como evidência histórica.
> Ele NÃO representa o estado atual.
> Atualmente os arquivos `20260819113539_fix_usuarios_auth_user_id_unique_constraint.sql`
> e `20260819114735_complete_tipo_chave_pix_migration.sql`
> estão presentes em `supabase/migrations/`.
> A reconciliação futura GitHub × Supabase permanece necessária
> apenas para validar a paridade completa do histórico antes de
> novas migrations.

### DRIFT DE MIGRATIONS
**STATUS: DRIFT DE HISTÓRICO DE MIGRATIONS PENDENTE DE RECONCILIAÇÃO.**

O Supabase possui em `supabase_migrations.schema_migrations` as versões abaixo, que não possuem arquivos correspondentes na branch `main`:
- `20260819113539` — fix_usuarios_auth_user_id_unique_constraint
- `20260819114735` — complete_tipo_chave_pix_migration

**REGRA:** Nenhuma nova alteração de banco deverá ser executada até que esse drift seja tratado em microetapa própria.

### 2.7 — Cancelamento de Corrida pelo Motorista — ✅ FECHADA
- Implementado botão "CANCELAR CORRIDA" na Home do Motorista.
- Server function `cancelarCorridaMotorista` valida ownership e status da corrida.
- Corrida é marcada como `cancelada` com `cancelado_por = 'motorista'`.
- Motorista é mantido offline após o cancelamento por segurança.
- Design alinhado com a identidade visual Zuvvi.
- Nenhuma alteração no core ou no banco de dados necessária (aproveitamento de estrutura existente).

#### 2.7-A — Modal Profissional de Cancelamento — ✅ FECHADA
- Substituído `window.confirm` nativo (branco/básico) por modal personalizado Zuvvi.
- Design alinhado: Fundo indigo, bordas 2.5rem, tipografia Poppins e ícones Lucide.
- Feedback de processamento integrado no botão de confirmação.
- Travas de segurança preservadas (não altera o core do cancelamento).
- Experiência profissional de confirmação/desistência.

---

## Reconciliação oficial do Sprint 2 — Baseline 21/08/2026

### Estado operacional

*   **Sprint 1:** ✅ FECHADO.
*   **Sprint 2:** ⚠️ EM ANDAMENTO.
*   **Implementação mais recente:** Microetapa 2.7-A — Modal Profissional de Cancelamento.
*   **Principal bloqueador funcional:** GPS pós-aceite da corrida (o motorista deixa de transmitir localização após aceitar a corrida).
*   **Interface:** A Home do Motorista ainda não possui mapa operacional da corrida.
*   **Fluxo:** Os estados posteriores ao aceite (a caminho, chegou, em andamento) ainda não estão completamente fechados.
*   **Passageiro:** O acompanhamento do passageiro existe, porém o rastreamento vivo completo (realtime GPS) ainda não está fechado.

### Reconciliação do histórico de migrations

Anteriormente, este documento registrava que as migrations:
*   `20260819113539_fix_usuarios_auth_user_id_unique_constraint.sql`
*   `20260819114735_complete_tipo_chave_pix_migration.sql`

não existiam na branch `main`.

**ATUALIZAÇÃO 21/08/2026:** O drift de migrations NÃO foi resolvido e permanece aberto.
- GitHub: 55 arquivos em `supabase/migrations/`
- Supabase: 49 versões em `supabase_migrations.schema_migrations`
- última migration real no banco: 20260821224348

Os 6 arquivos abaixo existem no GitHub e NÃO possuem registro no histórico do Supabase:
1. 20240321000000_create_cidades.sql
2. 20240321000001_create_usuarios.sql
3. 20240818000000_full_cities_load.sql
4. 20260818190000_consolidate_motorista_recusas.sql
5. 20260818190500_ensure_realtime_corridas.sql
6. 20260818231000_add_tipo_chave_pix.sql

**STATUS: DRIFT AINDA ABERTO.** Reconstruir o banco do zero pelo GitHub pode não produzir o banco que está no ar. A reconciliação deve virar microetapa própria, futura, e NÃO faz parte desta.


### MICROETAPA 2.8 — GPS Pós-Aceite — ✅ FECHADA

Comprovada funcionalmente em 21/08/2026.

**Evidências comprovadas:**

1. **Antes do aceite:**
   - motorista `is_disponivel=true`;
   - nenhuma corrida ativa;
   - GPS atualizando normalmente.

2. **Após o aceite:**
   - corrida `status=aceita`;
   - motorista `is_disponivel=false`;
   - exatamente 1 corrida ativa;
   - GPS continuou atualizando mesmo com `is_disponivel=false`.

**Prova temporal:**
- `data_aceite`: 21/08/2026 12:13:31 horário local;
- `ultima_localizacao_at` posterior ao aceite: 21/08/2026 12:15:13 horário local.

**Portanto:** GPS permaneceu transmitindo após o aceite.

3. **Após cancelamento pelo motorista:**
   - corrida `status=cancelada`;
   - `cancelado_por=motorista`;
   - motorista permaneceu offline;
   - último GPS: 12:16:16;
   - cancelamento: 12:16:24;
   - após mais de 2 minutos o timestamp de GPS não avançou.

**Portanto:** GPS parou corretamente quando não havia mais corrida ativa.

---

## Bloqueadores Críticos Descobertos

### PASSAGEIRO — CANCELAMENTO PÓS-ACEITE NÃO PROPAGADO — ⚠️ BLOQUEADOR
Registrado em 21/08/2026 como PENDÊNCIA (não falha da 2.8).

**Comportamento comprovado:**
- motorista cancela corrida aceita;
- banco registra corretamente `status=cancelada`;
- tela do motorista fecha a corrida e permanece offline;
- passageiro permanece na tela `/acompanhamento` exibindo o estado anterior da corrida.

**Auditoria técnica:**
`src/routes/acompanhamento.tsx` atualmente carrega a corrida somente na inicialização e não possui atualização Realtime/polling para mudanças posteriores do status. A tela também mantém o rótulo "Motorista Aceitou" de forma fixa.

**Status:** ✅ RESOLVIDO (Microetapa 2.9).

### MICROETAPA 2.9 — Cancelamento no Passageiro — ✅ FECHADA

Comprovada funcionalmente em 21/08/2026.

- Tela `/acompanhamento` reage em tempo real ao cancelamento da corrida.
- Exibe overlay visual "Corrida cancelada" com motivo.
- Redireciona para a Home após 1.8s.

---

### Microetapa 3.0 — Mapa do Local de Embarque — ✅ FECHADA

Implementação comprovada:

- após o motorista aceitar a corrida, a Home Motorista exibe mapa Mapbox dentro do card da corrida ativa;
- o mapa utiliza as coordenadas reais: corridas.origem_lat, corridas.origem_lng;
- o marcador representa o local de embarque do passageiro;
- MapView existente foi reutilizado sem alteração;
- getMapboxToken existente foi reutilizado;
- o mapa possui container com dimensão real para celular;
- card de origem, destino, valor e pagamento foi preservado;
- GPS pós-aceite da Microetapa 2.8 permaneceu intacto;
- fluxo do passageiro permaneceu intacto;
- nenhuma migration ou alteração Supabase foi necessária.

TESTE MANUAL APROVADO EM 21/08/2026:

Fluxo comprovado:
Passageiro solicita corrida
→ motorista recebe
→ motorista aceita
→ Home Motorista entra em estado EM CORRIDA
→ seção LOCAL DE EMBARQUE aparece
→ mapa Mapbox carrega corretamente
→ marcador aparece no local de embarque.

CONTRA-PROVA:

GitHub final:
13a44281a55df2257b57c3a32fdfccc106efbdb7

Commit funcional da implementação:
6bd1603cf7aab3ad0e2eb944580f8ad31e64f606

Supabase:
42 migrations
última migration:
20260820183150

MICROETAPA 3.0 — ✅ FECHADA

---

## Status final consolidado

**SPRINT 0 — ✅ CONCLUÍDO**

**SPRINT 1 — ✅ CONCLUÍDO E COMPROVADO PONTA A PONTA**

**SPRINT 2 — ⚠️ EM ANDAMENTO**

**CORE CONGELADO:**
- mapa do embarque do motorista;
- origem_lat/origem_lng no activeRide;
- MapView utilizado nessa tela;
- getMapboxToken utilizado nessa tela;
- GPS pós-aceite já aprovado.

**FECHAMENTO FUNCIONAL ATUAL:** 21/08/2026
**BASELINE GITHUB:** 13a44281a55df2257b57c3a32fdfccc106efbdb7

**PRÓXIMA MICROETAPA PLANEJADA:**

Microetapa 3.1 — Posição do motorista + rota até o local de embarque.

## Favoritos do Passageiro — ✅ FECHADO E CONGELADO

### Favoritos 1 — Banco e segurança — ✅ FECHADA

- criada tabela public.enderecos_favoritos;
- ownership por usuario_id;
- FK para usuarios com ON DELETE CASCADE;
- nome máximo 40;
- endereço máximo 300;
- latitude/longitude validadas;
- nome único por usuário de forma case-insensitive;
- RLS ativo;
- exatamente 4 policies para authenticated;
- anon sem SELECT/INSERT/UPDATE/DELETE;
- updated_at preservado.

### Favoritos 2 — Backend e gerenciamento — ✅ FECHADA

- listarFavoritos;
- criarFavorito;
- excluirFavorito;
- usuário resolvido server-side;
- cliente não define usuario_id;
- ownership validado também server-side;
- duplicidade de nome recebe mensagem amigável;
- criação, persistência e exclusão suportadas;
- modal premium;
- modo Novo favorito;
- comportamento mobile com visualViewport;
- teclado não desloca Home;
- botão SALVAR permanece acessível acima do teclado;
- lista com scroll interno.

### Favoritos 3 — Usar favorito como destino — ✅ FECHADA E COMPROVADA

- favorito salvo pode ser selecionado como destino;
- coordenadas salvas são reutilizadas diretamente;
- não ocorre nova geocodificação Mapbox;
- seleção reutiliza handleDestinationSelected;
- fluxo permanece:
  Favorito → /confirmar-corrida;
- NÃO pula diretamente para procura de motorista;
- clique funcional comprovado manualmente;
- card visual corrigido;
- endereço truncado;
- coluna exclusiva para lixeira;
- ausência de overflow lateral comprovada visualmente;
- overlay de Favoritos mais escuro;
- outros Dialogs preservam comportamento padrão.

### Favoritos 4 — Limite de 10 — ✅ FECHADA

Regra oficial:

- máximo de 10 favoritos por passageiro;
- 0–9: pode adicionar;
- 10: nova criação bloqueada;
- mensagem:
  "Você atingiu o limite de 10 favoritos. Exclua um favorito para adicionar outro.";
- ao excluir e voltar para 9, adicionar é liberado novamente.

### Camadas de proteção

1. Interface:
   - em 10/10 substitui botão por aviso;
   - em 9/10 botão reaparece.

2. Server-side:
   - criarFavorito conta favoritos do usuário;
   - bloqueia count >= 10;
   - traduz erro de limite de forma amigável.

3. Banco:
   - função:
     public.enforce_enderecos_favoritos_limit()
   - SECURITY INVOKER;
   - trigger:
     enforce_enderecos_favoritos_limit_trigger
   - BEFORE INSERT;
   - pg_advisory_xact_lock por usuario_id contra concorrência.

### Migration real aplicada

20260821212540_7c2f0dd6-b3cc-4761-a2d5-c8f4758e8884.sql

### Reconciliação GitHub/Supabase

- migration duplicada 20260821213000_enforce_favoritos_limit.sql
  foi removida do GitHub;
- ela NÃO está na migration history do Supabase;
- histórico GitHub/Supabase reconciliado.

### Contra-prova final de Favoritos

GitHub:

- último commit funcional:
  647a0f7e1a764922ada0279ce00fbfd14eb7b777

- HEAD auditado:
  21b9921ebd5fd5cd5b64dfbcadda94c317d35f0d

Supabase REAL:

- 15 tabelas públicas;
- 45 migrations;
- última migration: 20260821212540;
- enderecos_favoritos com RLS = true;
- 4 policies;
- função de limite existente;
- trigger de limite existente.

### Status final

FAVORITOS DO PASSAGEIRO:
✅ FECHADO
✅ AUDITADO
✅ CONGELADO

## Reconciliação operacional atual — 21/08/2026

### Baseline operacional atual

- GitHub funcional auditado antes desta atualização:
  f9d6f092ff5ad939cdfc39832e598aa6763a9500

### Supabase REAL

Estado real auditado em 21/08/2026:
- 17 tabelas públicas, todas com RLS ativo;
- 31 policies;
- 49 migrations aplicadas;
- última migration: 20260821224348;
- Realtime: corridas, chat_mensagens, chat_presenca;
- Security Advisor: 1 único alerta, severidade baixa (proteção contra senha vazada desligada);
- bucket documentos-motorista privado;
- 0 corridas ativas no momento da auditoria;
- enderecos_favoritos preservada.


### Estado atual do fluxo

#### Microetapa 3.1 — Posição + rota até embarque
🟡 IMPLEMENTADA

- marcador da posição do motorista implementado;
- usa ultima_lat / ultima_lng;
- rota Mapbox motorista → local de embarque;
- rota aplicável nos estados aceita,
  motorista_a_caminho e motorista_chegou;
- atualização do marcador/rota implementada quando
  coordenadas mudam;
- enquadramento inicial da rota implementado;
- prova visual em repouso realizada;
- prova física de movimento/recalculo permanece ADIADO.

NÃO marcar movimento real como comprovado.

#### Microetapa 3.2 — aceita → motorista_a_caminho
✅ IMPLEMENTADA E PROVADA

- função marcarMotoristaACaminho;
- requireSupabaseAuth;
- motorista resolvido server-side;
- ownership por motorista_id;
- exige status atual aceita;
- grava motorista_a_caminho;
- ação "A CAMINHO DO EMBARQUE" existente;
- transição já comprovada funcionalmente no banco.

#### Microetapa 3.3 — Passageiro: Motorista a Caminho
🟡 CÓDIGO IMPLEMENTADO / PROVA MANUAL FINAL PENDENTE

- /acompanhamento escuta public.corridas via Realtime;
- canal filtrado pelo rideId;
- recebe motorista_a_caminho;
- atualiza estado local;
- cabeçalho suporta:
  "Motorista Aceitou"
  →
  "Motorista a Caminho".

NÃO marcar 3.3 como fechada.

### Recentes do Passageiro
✅ FECHADO

- botão Recentes funcional;
- modal Destinos recentes;
- até 10 destinos distintos;
- fonte: histórico de public.corridas;
- nenhum filtro por status;
- deduplicação por coordenadas;
- registro mais recente preservado;
- requireSupabaseAuth;
- context.userId;
- supabaseAdmin;
- ownership por passageiro_id resolvido server-side;
- cliente não envia passageiro_id;
- coordenadas validadas;
- loading;
- erro;
- vazio;
- lista;
- overlay local;
- seleção reutiliza handleDestinationSelected;
- fluxo preservado:
  Recentes → /confirmar-corrida;
- não cria corrida automaticamente;
- não procura motorista automaticamente;
- teste visual/manual aprovado.

### Favoritos do Passageiro
✅ FECHADO
✅ AUDITADO
✅ CONGELADO

A seção histórica completa de Favoritos acima
permanece como fonte de detalhe.
NÃO duplicar nem reescrever seus dados.

### Chat Passageiro ↔ Motorista
✅ IMPLEMENTADO

Estado real auditado no Supabase em 21/08/2026:
- `public.chat_mensagens` existe, com RLS ativo, 22 registros;
- `public.chat_presenca` existe, com RLS ativo, 8 registros;
- ambas estão na publicação `supabase_realtime`;
- migrations reais aplicadas: `20260821223450` (chat_foundation) e `20260821223540` (chat_search_path_hardening);
- o chat já está integrado na Home do Motorista com Realtime, presença, "digitando", entregues/lidas e contador de não lidas.

**Status:** IMPLEMENTADO, com prova manual ponta a ponta ainda pendente.


### Pendências do fluxo da corrida

Permanecem pendentes:

- prova manual da 3.3;
- motorista_chegou;
- botão CHEGUEI;
- data_chegada_motorista;
- código de embarque visível ao passageiro;
- validação do código pelo motorista;
- motorista_chegou → em_andamento;
- data_inicio;
- rota até destino durante corrida;
- finalização;
- concluida;
- data_finalizacao;
- valor_final;
- tela final;
- rastreamento vivo do motorista no passageiro;
- avaliação;
- pagamentos reais/liquidação;
- notificações;
- Corridas/Histórico;
- Carteira;
- Perfil do passageiro.

### Hardening futuro já identificado

- proteção de corrida ativa única existe para motorista;
- equivalente para passageiro ainda deve ser fechado;
- cancelamento do passageiro precisa de matriz explícita
  de estados canceláveis antes da produção;
- CI significativo ainda pendente;
- lint global herdado ainda pendente.

### Microetapa 3.5 — BOTÃO "CHEGUEI" NO APP DO MOTORISTA — ✅ IMPLEMENTADA
- Implementado botão "CHEGUEI NO LOCAL" na Home do Motorista.
- Server function `marcarMotoristaChegou` valida ownership e exige status `motorista_a_caminho`.
- Corrida é marcada como `motorista_chegou` com `data_chegada_motorista` preenchida.
- Interface reage ao novo status exibindo "NO LOCAL DE EMBARQUE".
- Prova manual pendente.
- Arquivos tocados: `src/lib/motorista.functions.ts`, `src/routes/home-motorista.tsx`.

### Próxima microetapa oficial

Próxima microetapa oficial: 3.6 — Passageiro recebe o estado motorista_chegou

## BLOQUEADORES ABERTOS PARA O PILOTO — auditoria 21/08/2026

B1. A corrida não termina. O botão CHEGUEI passou a existir (3.5), mas o bloqueador continua aberto, pois ainda faltam: validação do código de embarque, início real da corrida (em_andamento) e conclusão (concluida). O codigo_embarque é gerado em toda corrida e nunca é mostrado ao passageiro nem validado pelo motorista. Prova: 1 corrida presa em motorista_chegou.
B2. Pagamento inexistente. Mercado Pago não está no código. 36 pagamentos, 100% no status pendente.
B3. O passageiro não recebe a posição do motorista. getAcompanhamentoPassageiro não retorna ultima_lat / ultima_lng. Aviso de 500 metros não existe.
B4. Avaliações: tabela vazia, nenhum código.
B5. Notificações push e SMS não existem.
B6. Corridas órfãs: 13 presas em "solicitada", sem timeout. Estados buscando_motorista e sem_motorista nunca usados.

### FALHAS GRAVES ABERTAS

G1. cancelarCorrida (passageiro) não filtra status — permite cancelar corrida em_andamento e até concluida.
G2. Duas fórmulas de preço separadas (calcularValorCorrida e criarCorrida).
G3. corridas não guarda distância, tempo nem tarifa aplicada.
G4. getUploadUrl aceita qualquer arquivo, sem limite de tamanho nem verificação de imagem.
G5. criarVeiculo derruba aprovação de veículo já aprovado.
G6. Não existe trava de corrida ativa única para o passageiro.
G7. codigo_embarque gerado com Math.random(), 4 dígitos.

**STATUS:** ABERTOS. Não corrigir nenhum deles nesta etapa.

