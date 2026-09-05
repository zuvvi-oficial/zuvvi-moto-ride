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

### 4.14-C — VISUAL: CABEÇALHO PASSAGEIRO PREMIUM — ✅ FECHADA
- Atualizado `src/routes/index.tsx`: Cabeçalho agora utiliza o componente `ZuvviLogo` oficial com `surface="dark"`.
- Mantido o design premium com `backdrop-blur-lg` e `bg-zuvvi-indigo/60`.

### 4.14-B — CORRIGIR FILTRO DE USUÁRIO NO HISTÓRICO — ✅ FECHADA
- Corrigido bug em `getHistoricoCorridas` onde o filtro usava `auth_user_id` em vez de `usuarios.id`.
- Implementada resolução prévia do ID do usuário logado na tabela `usuarios` a partir do `context.userId`.
- Confirmado que a tela de histórico agora exibe corridas para usuários com dados reais no banco.
- Arquivos tocados: `src/lib/historico.functions.ts` e `ZUVVI-FECHAMENTO-CONTROLE.md`.
- Verificado que `corridas.tsx` e `index.tsx` não sofreram alterações.

### 4.14 — HISTÓRICO DE CORRIDAS DO PASSAGEIRO (somente leitura) — ✅ FECHADA
- Criado `src/lib/historico.functions.ts` com a server function `getHistoricoCorridas` (GET).
- Implementada rota `/corridas` em `src/routes/corridas.tsx` com lista de até 50 corridas recentes.
- Botão "Corridas" no menu inferior da Home do Passageiro ligado à nova rota.
- Dados exibidos: data, destino, valor, status e nome do motorista.
- Regra de negócio: consulta restrita ao `passageiro_id` do usuário logado; join com `usuarios` para nome do motorista.
- Nota técnica: A função `criarVeiculo` (G5) reseta a aprovação do veículo sem checar status atual, mas isso não é alcançável hoje porque motoristas aprovados são redirecionados para fora da tela de onboarding. Pendência de hardening defensivo registrada para futura tela de edição de veículo.

### 4.12 — TOTAL DE CORRIDAS E TEMPO NA ZUVVI DO MOTORISTA — ✅ FECHADA
- `getAcompanhamentoPassageiro` agora retorna `total_corridas` (concluídas) e `membro_desde`.
- Implementada função `formatarTempoNaZuvvi` com lógica de dias/meses/anos conforme regra de negócio.
- Card do motorista atualizado com estatísticas de fidelidade e experiência.
- Auditoria: A Microetapa 4.5 foi identificada como não aplicada no banco anteriormente; gatilho e backfill realizados manualmente em 24/08/2026. Lição aprendida: conferir migrações no banco real.

### 4.13 — Cabeçalho Premium Zuvvi no Admin — ✅ FECHADA
- Adicionada Top Bar institucional Premium na rota `/admin`.
- Uso do componente oficial `ZuvviLogo` com `surface="dark"`.
- Estilização: `sticky top-0`, `bg-zuvvi-indigo/90`, `backdrop-blur-xl`, `border-b border-white/10`.
- Responsividade: logo e botão de sair preservados em todos os breakpoints; textos secundários ocultos no mobile.
- Dashboard, cards e lógica funcional original 100% preservados e congelados.

### 4.12-NOTIF — Microcorreção Visual: Contador de Notificações — ✅ FECHADA

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

### MICROCORREÇÃO 3.7-C — ✅ FECHADA
- Adicionada validação `Number.isFinite(valorFinal)` server-side em `finalizarCorrida`.
- Refatorada a detecção de mudança de rota para usar `phase` (pickup/destination) e `targetLat/Lng`.
- O status `em_andamento` agora força a atualização do alvo da rota para o destino do passageiro.
- `lastRouteCoordsRef` updated to contain the atomic structure of phase and real target.
- Build verified.
- Commit funcional: `74cc66c1f715e21908221804b77f884a44b7d159`.

### MICROCORREÇÃO 3.7-D — PÓS-FINALIZAÇÃO SEGURO + SUCESSO VISUAL DO MOTORISTA — ✅ IMPLEMENTADA — PROVA MANUAL PENDENTE

### MICROETAPA 4.10 — NOME DO PASSAGEIRO AO MOTORISTA — ✅ FECHADA
- `fetchActiveRide` agora seleciona `passageiro_id`.
- `getMotoristaStatusHome` busca o nome do passageiro em `public.usuarios`.
- Implementado fail-safe: se a busca falhar ou o nome vier vazio, exibe "Passageiro".
- `home-motorista.tsx` exibe o nome do passageiro no card da corrida ativa com o ícone `User`.
- Foto de perfil não foi implementada por falta de estrutura no sistema.
- Build verificado com sucesso.

### MICROETAPA 4.11 - CORRIGIR NOTA "0.0" DE MOTORISTA NUNCA AVALIADO - ✅ FECHADA
- Coluna `public.motoristas.nota_media` alterada para aceitar NULL e removido DEFAULT 0.
- Migration aplicada: `20260824002100_fix_motorista_nota_media_null.sql`.
- Motoristas com nota 0 (nunca avaliados) corrigidos para NULL.
- Contra-prova: 4 motoristas corrigidos; trigger `recalcular_nota_media_motorista` intacto.
- Nenhum arquivo em `src/` foi alterado.


### MICROETAPA 4.9 — CORREÇÃO DE RECURSÃO RLS (MOTORISTAS X CORRIDAS) — ✅ FECHADA
- Criada função `public.passageiro_tem_corrida_ativa_com_motorista` com `SECURITY DEFINER` para consultar a tabela `corridas` sem disparar RLS recursivo.
- Revogadas permissões públicas da função e concedido `EXECUTE` para `authenticated`.
- Política `"Passenger can see driver location of active ride"` na tabela `motoristas` reescrita para usar a nova função.
- Resolvido erro Postgres `42P17` (infinite recursion) que quebrava o Realtime durante mudanças de status de corrida.
- Migration aplicada: `20260823235000_fix_rls_recursion_corridas_motoristas.sql`.
- Build verificado.


### MICROETAPA 4.6 — TELA DO PASSAGEIRO AVALIANDO O MOTORISTA — ✅ FECHADA
- Implementado sistema de avaliação integrado ao modal de "CORRIDA CONCLUÍDA" em `src/routes/acompanhamento.tsx`.
- Chamada atômica a `getAvaliacaoStatus` para evitar avaliações duplicadas na mesma sessão ou após refresh.
- Interface de 5 estrelas clicáveis com comentário opcional.
- Botão "ENVIAR AVALIAÇÃO" com estado de loading e validação de input.
- Fluxo de agradecimento pós-avaliação.
- Opção "PULAR" mantida para não travar o usuário.
- Tratamento de erro via toast com recuperação atômica.
- Build verificado.

### MICROETAPA 4.7 — TELA DO MOTORISTA AVALIANDO O PASSAGEIRO — ✅ FECHADA
- Implementado bloco de avaliação dentro do modal `completedRideNotice` em `home-motorista.tsx`.
- Reutilizada a função `criarAvaliacao` via `useServerFn`.
- Interface compacta com 5 estrelas e comentário opcional (max 500 chars).
- Botão de envio com estado de loading e feedback de sucesso ("Obrigado!").
- Reset de estados de avaliação ao iniciar nova finalização para evitar persistência de dados antigos.
- Modal ajustado com scroll interno para garantir usabilidade em telas pequenas.
- Build verificado.

**Status: ✅ BLOQUEADOR B4 (AVALIAÇÕES) - INTEGRALMENTE CONCLUÍDO (PASSAGEIRO E MOTORISTA)**


- Resolvido ErrorComponent global client-side após finalização.
- Eliminado double-cleanup do Mapbox.
- Feedback visual (overlay de sucesso) desacoplado da activeRide.
- Motorista permanece OFFLINE após finalizar.

### MICROETAPA 3.8-A + 3.8-A1 — ✅ COMPROVADAS
- Proteção contra criação de nova corrida se já houver uma ativa.
- Trava síncrona `createInFlightRef` no frontend.

### MICROETAPA 3.8-B1 — SANEAMENTO CONTROLADO DAS SOLICITAÇÕES LEGADAS — ✅ COMPROVADA NO SUPABASE
- 13 registros legados identificados e saneados (solicitada → sem_motorista).
- 0 legadas em solicitada; 13 em sem_motorista.
- Pagamentos intactos.
- Migration count: 50.
- Latest migration: 20260822044703_4c09eb6a-631d-415e-949a-19286faeaccd.sql.
- Hash GitHub: f7122f5a487ca5ca96766eaffe2ea9a959e801d5
- B2 ainda NÃO implementada.
- Timeout ainda NÃO implementado.


### MICROETAPA 3.8-A — Bloqueio funcional de solicitação duplicada — ✅ IMPLEMENTADA — PROVA MANUAL PENDENTE
- Implementada validação server-side em `criarCorrida` ANTES de qualquer chamada externa (Mapbox) ou escrita (INSERT).
- Status bloqueadores: `solicitada`, `buscando_motorista`, `aceita`, `motorista_a_caminho`, `motorista_chegou`, `em_andamento`.
- Status terminais (não bloqueiam): `concluida`, `cancelada`, `sem_motorista`.
- Proteção contra duplo clique no cliente via guarda atômica `if (isCreating) return;`.
- Erro de corrida aberta retorna mensagem segura: "Você já possui uma corrida em andamento ou aguardando motorista."
- Core da corrida, motorista, chat e GPS permanecem intactos.
- Nenhuma migration aplicada; nenhum dado legado alterado.
- Timeout e lógica de `sem_motorista` ainda NÃO implementados.
- Unicidade atômica no banco (constraint/trigger) ainda NÃO implementada.
- Build verificado com sucesso.

- **Causa da falha identificada:** Double-cleanup no Mapbox. O cleanup pós-finalização da Home tentava remover layers/sources de uma instância que o MapView (proprietário do lifecycle) já estava destruindo via `map.remove()`.
- **Ownership do lifecycle do mapa:** MapView permanece único responsável por `map.remove()`. O cleanup da Home foi refatorado para ser fail-safe e não tocar no mapa se ele estiver sendo desmontado.
- **Desacoplamento de dados:** Criado estado `completedRideNotice` que captura os dados necessários antes da corrida ser removida do `active_ride`, garantindo feedback visual consistente.
- **Fluxo de Sucesso do Motorista:** Implementado overlay Zuvvi completo após sucesso do backend, exibindo valor final, forma de pagamento e mensagem de status OFFLINE.
- **Hardening Pós-Finalização:** Invalidação de cache (`invalidateQueries`) agora é best-effort e não bloqueante, impedindo que falhas de rede/sincronização pós-sucesso derrubem a aplicação.
- **Estado do Chat:** Chat é encerrado visualmente e limpo imediatamente após a finalização do backend.
- **Status do Motorista:** Confirmado que o motorista permanece OFFLINE após a conclusão.
- **Contra-prova do teste anterior:** Backend concluiu corretamente; Supabase gravou `concluida`, `data_finalizacao` e `valor_final`. Falha era estritamente client-side.
- Nenhuma migration ou alteração em banco/pagamentos realizada.
- Build verificado com `bun run build`.

### MICROETAPA 3.7 — CONCLUSÃO DA CORRIDA — ✅ IMPLEMENTADA — PROVA MANUAL PENDENTE
- `finalizarCorrida` server-side com validações de ownership, status e `data_inicio`.
- Reversão da permissão temporária de cancelamento (3.6-C).
- Atualização do `valor_final` como `Number(valor_estimado)`.

### MICROCORREÇÃO 3.7-A — REPROVADA POR DIVERGÊNCIAS FUNCIONAIS
- Falhas identificadas no GPS e modal de confirmação.

### MICROCORREÇÃO 3.7-B — ✅ IMPLEMENTADA — PROVA MANUAL PENDENTE
- Restaurado envio de GPS no status `em_andamento`.
- Implementado Modal de Finalização funcional na Home Motorista.
- Ajustada lógica de alvo da rota (Target Lat/Lng) para `destino` durante `em_andamento`.
- Adicionada `concluida` ao Realtime do passageiro e overlay final de sucesso.
- Build verificado.

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

### Checklist Pré-Produção (Obrigatório)
- **REVERTER Microetapa 3.6-C**: Restringir `cancelarCorridaMotorista` apenas para `['aceita', 'motorista_a_caminho']`.

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

### Microetapa 3.5-A — ❌ REVERTIDA (implementação não autorizada)
- Esta alteração foi feita fora do escopo autorizado do
  prompt da Microetapa 3.5, sem passar pelo processo de
  ABORTAR E REPORTAR exigido pela regra 14.
- Revertida por decisão do responsável do projeto em
  22/08/2026.
- cancelarCorridaMotorista voltou a aceitar cancelamento
  apenas nos status 'aceita' e 'motorista_a_caminho'.
- O problema real que motivou a tentativa (motorista sem
  saída após motorista_chegou) é legítimo e será resolvido
  formalmente na Microetapa 3.6.

### Microetapa 3.6 — INÍCIO REAL DA CORRIDA — ✅ IMPLEMENTADA
- Criada a função `iniciarCorrida` em `src/lib/motorista.functions.ts` com validação de código de 4 dígitos e transição para `em_andamento`.
- Implementada UI de validação de código na `home-motorista.tsx`.
- Segurança: Validação de ownership e status `motorista_chegou` obrigatórios no servidor.
- Mensagem de erro de código incorreto não revela o código real.
- Prova manual pendente.
- Arquivos tocados: `src/lib/motorista.functions.ts`, `src/routes/home-motorista.tsx`, `ZUVVI-FECHAMENTO-CONTROLE.md`.

### Microetapa 3.6-B — CORREÇÃO DO REALTIME DO PASSAGEIRO — ✅ IMPLEMENTADA
- Bug de Realtime corrigido: eventos de `postgres_changes` em `corridas` não chegavam ao passageiro devido à falta de autenticação no canal.
- Adicionado `await supabase.realtime.setAuth(session.access_token)` antes da criação e inscrição dos canais em `procurando-motorista.tsx` e `acompanhamento.tsx`.
- Causa raiz: RLS bloqueia eventos de Realtime anônimos mesmo em canais nomeados; a autenticação explícita resolve o travamento do passageiro e a propagação de cancelamentos.
- Canal de chat em `acompanhamento.tsx` permaneceu intocado por já possuir lógica própria ou estar fora do escopo de "corridas".
- Prova manual pendente.
- Arquivos tocados: `src/routes/procurando-motorista.tsx`, `src/routes/acompanhamento.tsx`, `ZUVVI-FECHAMENTO-CONTROLE.md`.

### Microetapa 3.6-C — ⚠️ TEMPORÁRIA (liberação de teste) — ✅ IMPLEMENTADA
- Autorizada diretamente pelo responsável do projeto em 22/08/2026.
- A função `cancelarCorridaMotorista` agora aceita os status: 'aceita', 'motorista_a_caminho', 'motorista_chegou' e 'em_andamento'.
- Motivo: Evitar travamentos em fluxos de teste manuais enquanto a conclusão da corrida (3.7) não está finalizada.
- **ALERTA**: Esta liberação é temporária e PRECISA ser revertida antes do piloto real em Jacarezinho. Adicionado ao "Checklist Pré-Produção".
- Arquivos tocados: `src/lib/motorista.functions.ts`, `ZUVVI-FECHAMENTO-CONTROLE.md`.

### Microetapa 3.6-D — FECHADA / COMPROVADA PONTA A PONTA
- Prova: motorista_chegou → código → em_andamento.
- Validação server-side do código e Realtime confirmados.
- Implementada entrega segura do `codigo_embarque` via server-side `getAcompanhamentoPassageiro` estritamente no status `motorista_chegou`.
- Atualizado Realtime do passageiro para reagir aos estados `motorista_chegou` e `em_andamento` com sincronização server-side garantida.
- Cabeçalho de acompanhamento atualizado com estados explícitos: MOTORISTA A CAMINHO, MOTORISTA CHEGOU, CORRIDA EM ANDAMENTO.
- Implementado Card de Código de Embarque Zuvvi com destaque visual (4 dígitos) e sumiço automático após início da corrida.
- Segurança: O código nunca é exposto fora do status correto e o controle de início permanece 100% no motorista (validado pelo backend).
- Fail-safe: A UI protege contra códigos inexistentes ou inconsistentes sem travar o fluxo.
- Arquivos tocados: `src/lib/user.functions.ts`, `src/routes/acompanhamento.tsx`, `ZUVVI-FECHAMENTO-CONTROLE.md`.

### Microcorreção 3.6-D-A — Fail-safe e sincronização do código — ✅ IMPLEMENTADA — PROVA MANUAL PENDENTE
- Implementada validação rigorosa do código de embarque via regex `/^\d{4}$/`.
- Criado fail-safe visual quando `motorista_chegou` mas o código é inválido ou ausente, exibindo mensagem de erro e botão "TENTAR NOVAMENTE".
- Centralizada a sincronização da corrida na função `syncRide` (useCallback), tratando erros e prevenindo `Promise` sem tratamento.
- Implementada proteção contra race conditions (concorrência) usando `syncCounterRef` para garantir que respostas antigas do servidor não sobrescrevam estados mais novos.
- Removido o fallback falso do cabeçalho que transformava qualquer status em "Motorista Aceitou"; agora utiliza mapeamento explícito e fallback neutro "Atualizando corrida".
- Corrigidas as dependências do `useEffect` para incluir `syncRide` adequadamente.
- Confirmado que `iniciarCorrida` e regras de banco/RLS não foram alteradas.
- Arquivos tocados: `src/routes/acompanhamento.tsx`, `ZUVVI-FECHAMENTO-CONTROLE.md`.

### Microcorreção 3.6-D-B — Dependências e regressão de carregamento — ✅ IMPLEMENTADA — PROVA MANUAL PENDENTE
- Corrigida a dependency array do `useEffect` de Realtime em `acompanhamento.tsx` para incluir `syncRide`.
- Refatorada a inicialização da tela para carregar a corrida (`syncRide`) e o token do mapa (`getMapboxTokenFn`) de forma independente, eliminando o bloqueio da tela por falha no mapa.
- Removido o estado morto `rideSyncError`.
- Preservadas as proteções de race condition, regex de código de embarque e fail-safes visuais da etapa anterior.
- Resultado: Carregamento mais resiliente e sem risco de spinner infinito por falhas colaterais.

### Microetapa 3.7 — Viagem ao destino e conclusão — ✅ IMPLEMENTADA — PROVA MANUAL PENDENTE
- Implementada a transição `em_andamento` → `concluida`.
- A Home do Motorista agora reconhece o estado `em_andamento` e altera a rota do mapa para o destino final.
- Botão "FINALIZAR CORRIDA" adicionado com modal de confirmação.
- Server function `finalizarCorrida` implementada com travas de ownership, status e data_inicio.
- Regra `valor_final = valor_estimado` aplicada no servidor (sem recalcular tarifa).
- Reversão da exceção temporária 3.6-C: cancelamento do motorista não é mais permitido em `em_andamento`.
- O motorista permanece OFFLINE após a conclusão.
- O passageiro recebe o status `concluida` via Realtime e visualiza a tela de encerramento.
- Pagamentos permanecem intactos (fluxo financeiro separado).
- Nenhuma migration criada.

### MICROETAPA 3.8-B2-A — Unicidade atômica de corrida aberta por passageiro — ✅ IMPLEMENTADA — CONTRA-PROVA PENDENTE
- Criado índice único parcial `idx_corridas_passageiro_aberta_unique` na tabela `public.corridas`.
- Estados protegidos (unicidade exigida): `solicitada`, `buscando_motorista`, `aceita`, `motorista_a_caminho`, `motorista_chegou`, `em_andamento`.
- Estados terminais ignorados (permitidos duplicados): `concluida`, `cancelada`, `sem_motorista`.
- Proteção atômica independente do frontend, garantindo integridade contra race conditions e requisições simultâneas.
- Validação fail-closed na migration: aborta se houver duplicidade prévia ou índice conflitante.
- Nenhum dado ou pagamento alterado.
- Nenhum arquivo `src/` alterado.
- Tratamento amigável do erro 23505 (unique violation) no frontend reservado para a Microetapa 3.8-B2-B.
- Timeout automático ainda NÃO implementado.

### MICROETAPA 3.8-B2-B — Tratamento amigável da violação atômica — ✅ IMPLEMENTADA — CONTRA-PROVA PENDENTE
- 23505 tratado somente para idx_corridas_passageiro_aberta_unique;
- mesma mensagem da 3.8-A;
- demais erros continuam genéricos;
- nenhum banco alterado;
- nenhuma migration;
- pagamento intacto;
- timeout ainda não implementado.

### Próxima microetapa oficial
Sprint 3 — Auditoria e Finalização de Bloqueadores Financeiros.



## BLOQUEADORES ABERTOS PARA O PILOTO — auditoria 21/08/2026

B1. A corrida não termina. A validação do código de embarque e o início real da corrida (em_andamento) passaram a existir (3.6), mas o bloqueador CONTINUA ABERTO, pois falta ainda a conclusão da corrida (concluida, data_finalizacao, valor_final). O codigo_embarque é gerado em toda corrida e agora é validado pelo motorista. Prova: 1 corrida presa em em_andamento.
B2. Pagamento inexistente. Mercado Pago não está no código. 36 pagamentos, 100% no status pendente.
B3. O passageiro não recebe a posição do motorista. RESOLVIDO (Microetapa 4.4). Aviso de 500 metros não existe.
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

**OBSERVAÇÃO PARA O FUTURO:** MATRIZ DE CANCELAMENTO PENDENTE: quando os estados em_andamento e concluida forem implementados, a matriz de estados canceláveis do motorista E do passageiro deverá ser revisada em microetapa própria. A falha G1 (passageiro cancela sem filtro de status) permanece ABERTA e NÃO foi tocada nesta etapa.

**STATUS:** ABERTOS. Não corrigir nenhum deles nesta etapa.

### MICROETAPA 3.8-C1 — Fundação server-side do timeout de busca — ✅ FECHADA
- timeout oficial inicial = 120 segundos;
- solicitada sem motorista pode virar sem_motorista;
- update condicionado contra race com aceite;
- ownership do passageiro validado;
- solicitação vencida não bloqueia nova criação;
- pagamentos não alterados;
- nenhuma migration;
- UI ainda não implementada;
- filtro das ofertas ainda não implementado.

### MICROCORREÇÃO 3.8-C1-A — Fail-closed dos erros de expiração — ✅ IMPLEMENTADA — CONTRA-PROVA PENDENTE
- erro da limpeza pré-criação tratado;
- erro da releitura pós-race tratado;
- timeout permanece 120 segundos;
- nenhuma migration;
- C2 não implementada;
- C3 não implementada.

### MICROETAPA 3.8-C2 — Timeout visual e encerramento automático da busca — ✅ IMPLEMENTADA — PROVA MANUAL PENDENTE
- 120 segundos de busca máxima;
- contagem usa created_at real da corrida (não inicia 120s novos ao montar);
- servidor é autoridade final (verificarTimeoutCorrida decide expiração);
- sem_motorista tratado por chamada server-side e por Realtime;
- aceite prevalece na race (servidor nunca expira corrida já aceita);
- refresh respeita tempo já decorrido (recalcula a partir do created_at);
- proteção contra chamadas duplicadas via timeoutCheckInFlightRef;
- retry controlado (3s) se servidor dis não expirado por diferença de relógio;
- erro de rede não fala sem_motorista localmente; toast seguro e retry de 5s;
- estado final: "NENHUM MOTORISTA DISPONÍVEL" com botão "TENTAR NOVAMENTE";
- botão CANCELAR CORRIDA oculto quando sem_motorista;
- cleanup de interval, retry timeout e canal Realtime no unmount;
- aria-live="polite" no bloco de status; contagem não anunciada a cada segundo;
- nenhuma migration;
- pagamentos intactos;
- C3 ainda NÃO implementada.

### MICROCORREÇÃO 3.8-C2-A — Reconciliação server-side após timeout — ✅ IMPLEMENTADA — PROVA MANUAL PENDENTE
- status atribuído retornado pelo servidor (aceita, motorista_a_caminho, motorista_chegou, em_andamento) navega diretamente para /acompanhamento?rideId=<rideId>;
- Realtime continua preservado integralmente como caminho rápido;
- perda/atraso de evento Realtime não deixa passageiro preso em 00:00;
- sem_motorista: limpa retryTimeoutRef pendente antes de setSemMotorista(true);
- nenhuma migration;
- pagamentos intactos;
- C3 não implementada.

### Microetapa 4.4 — Destravar posição do motorista em tempo real — ✅ IMPLEMENTADA
- Criada política de RLS aditiva em `public.motoristas` ("Passenger can see driver location of active ride") permitindo leitura de `ultima_lat`, `ultima_lng` e `ultima_localizacao_at`.
- Restrição da política: apenas para o passageiro autenticado com corrida ativa (`aceita`, `motorista_a_caminho`, `motorista_chegou`, `em_andamento`) vinculada ao motorista.
- Corrigida falha de autenticação no canal Realtime `motorista-posicao` em `src/routes/acompanhamento.tsx`.
- Adicionado `await supabase.realtime.setAuth(session.access_token)` antes do `subscribe` no `useEffect` de posição do motorista.
- Nenhuma política existente foi alterada ou removida.
- Bloqueador B3 marcado como resolvido (rastreamento vivo funcional).
- Arquivos tocados: `src/routes/acompanhamento.tsx`, `ZUVVI-FECHAMENTO-CONTROLE.md`, Supabase RLS (via SQL).

### Microetapa 4.5 — Base de Avaliações (Backend + Nota Média) — ✅ FECHADA
- Criado `src/lib/avaliacoes.functions.ts` com `criarAvaliacao` e `getAvaliacaoStatus`.
- Criada migration `20260823232600_recalculate_motorista_rating.sql` com trigger de nota média.
- RLS e estrutura de `avaliacoes` preservados conforme exigido.
- Nenhuma alteração em telas ou componentes.
- Bloqueador B4 (Backend) resolvido; funcionalidade completa aguarda 4.6 e 4.7.




### Microetapa 4.8 - Corrigir perda de aceite na abertura da busca - ✅ IMPLEMENTADA
- Implementada checagem extra do estado da corrida no callback SUBSCRIBED do canal Realtime em procurando-motorista.tsx.
- A checagem captura o aceite do motorista que pode ter ocorrido durante a janela de conexão do Realtime (autenticação/inscrição).
- Se o motorista for detectado na checagem extra, o passageiro é redirecionado imediatamente para /acompanhamento, resolvendo o bloqueio de 120s.
- Lógica de timeout de 120s e cancelamento preservadas como rede de segurança.
- Build verificado.
- Arquivos tocados: src/routes/procurando-motorista.tsx, ZUVVI-FECHAMENTO-CONTROLE.md.
- Bloqueador B3 (Race Condition na Busca) marcado como resolvido.

## Auditoria de reconciliação ponta a ponta — 05/09/2026

Realizada auditoria completa do estado real do código (não apenas deste documento, que estava desatualizado desde a 4.8) contra as pendências G1-G7 e B1-B6 registradas na seção "BLOQUEADORES ABERTOS PARA O PILOTO — auditoria 21/08/2026". Confirmado tecnicamente:
- G1 (cancelarCorrida sem filtro de status) e o Checklist Pré-Produção (reverter 3.6-C): já FECHADOS anteriormente (3.7), confirmados no código atual.
- B1 (conclusão de corrida), B3 (posição do motorista), B4 (avaliações), B6 (timeout de corrida órfã): confirmados FECHADOS no código atual.
- Bloco Pix/Mercado Pago (B2): arquitetura implementada, mas SEM prova de pagamento real aprovado (33 tentativas históricas, 0 pagas); webhook sem validação de `x-signature` nem deduplicação; expiração de tentativa não é autoritativa no servidor; reembolso (`estornado`) nunca é escrito por nenhum código. Mantido como bloqueador crítico aberto, tratado à parte por ser sensível a dinheiro real.
- B5 (notificações): confirmado aberto — segue apenas in-app, sem push/SMS.
- Recursos `contatos_confianca` / `viagens_compartilhadas`: confirmado que existem apenas no schema, sem função de servidor ou tela.
- G3 (corrida não grava distância/tempo/tarifa aplicada) e itens de hardening (G4 upload, drift de migrations não reverificável nesta sessão) permanecem em aberto, registrados para microetapas futuras.

### Microetapa 5.1 — Correções isoladas de baixo risco (G5, G7, limpeza de G2) — ✅ FECHADA
- **G5 corrigido:** `criarVeiculo` (`src/lib/motorista.functions.ts`) agora lê o veículo existente antes do upsert e só reseta `status_aprovacao` para `em_preenchimento` (e `ativo` para `true`) quando placa/marca/modelo/ano/cor realmente mudaram. Reenvio idêntico de um veículo já aprovado não derruba mais a aprovação.
- **G7 corrigido:** `codigoEmbarque` em `criarCorrida` (`src/lib/user.functions.ts`) trocado de `Math.floor(1000 + Math.random() * 9000)` para `crypto.randomInt(1000, 10000)` (módulo `crypto` já importado na função), eliminando o gerador pseudoaleatório fraco.
- **G2 (limpeza):** removida a server function `calcularValorCorrida` de `src/lib/user.functions.ts` — estava morta (nenhuma chamada em `src/`) e duplicava exatamente a fórmula de tarifa já usada em `cotarCorrida`, que é a versão realmente ligada à UI e com assinatura HMAC anti-adulteração.
- Nenhuma migration necessária; nenhuma alteração de schema.
- Validação: `npx tsc --noEmit` e `npx eslint` rodados nos dois arquivos tocados — nenhum erro novo introduzido (apenas os erros pré-existentes de módulos ausentes/formatação já registrados em "LINT GLOBAL — PENDENTE").
- Próxima etapa: bloco Pix (B2) — validação de webhook, expiração autoritativa e reembolso.

### Microetapa 5.2 — Webhook Mercado Pago: deduplicação + validação de assinatura — ✅ IMPLEMENTADA — HOMOLOGAÇÃO PENDENTE
- **Deduplicação:** `private.mercadopago_webhook_eventos` (existia ociosa desde a migration `pix_attempts_webhook`) passou a ser usada de fato. Duas novas funções `SECURITY DEFINER` em `public` (schema `private` não é exposto via PostgREST, mesmo padrão das funções `pix_oauth_*`):
  - `pix_mercadopago_webhook_register_event`: insere o evento com `event_key` único; se já existir, retorna `is_new=false` e o `processing_status` atual em vez de duplicar.
  - `pix_mercadopago_webhook_finalizar_evento`: marca o evento como `processed` ou `failed`, incrementando `processing_attempts`.
  - Migration: `20260905090000_pix_webhook_dedup_functions.sql`. Ambas as funções revogadas de `public`/`anon`/`authenticated`, `EXECUTE` concedido só a `service_role`.
  - `event_key` usa o `id` de notificação de topo do Mercado Pago (`mp-notification:<id>`), distinto do `data.id` (id do pagamento) — garante que reentregas do mesmo evento sejam deduplicadas sem colapsar eventos genuinamente diferentes sobre o mesmo pagamento (ex.: aprovação seguida de estorno). Fallback documentado para o formato legado sem id de notificação.
  - Reentrega antes da finalização não é tratada como duplicada (ainda `received`) e é reprocessada; reentrega após `processed` é ignorada sem nova chamada à API do Mercado Pago.
- **Validação de assinatura `x-signature`:** novo módulo `src/lib/pix-mercadopago-webhook-signature.server.ts`, seguindo o manifesto oficial `id:{data.id};request-id:{x-request-id};ts:{ts};`, HMAC-SHA256 com `MERCADOPAGO_WEBHOOK_SECRET`, comparação em tempo constante (`timingSafeEqual`) e janela de tolerância de 15 minutos contra replay do `ts`.
  - Comportamento fail-closed: sem `MERCADOPAGO_WEBHOOK_SECRET` configurado, o webhook responde 503 (retry) sem processar nada; assinatura ausente/inválida responde 401.
  - **AÇÃO NECESSÁRIA FORA DO CÓDIGO:** a variável de ambiente `MERCADOPAGO_WEBHOOK_SECRET` (valor gerado no dashboard do Mercado Pago em Suas integrações → Webhooks) precisa ser configurada no ambiente de produção antes do deploy desta etapa, senão nenhuma notificação real será processada.
- **Validação realizada nesta sessão:**
  - `npx tsc --noEmit` e `npx eslint` sem erros novos (só os `@typescript-eslint/no-explicit-any` já comentados no código, mesmo padrão de `criar_corrida_financeira_atomica`, por RPC nova ainda sem tipos regenerados).
  - Lógica de assinatura testada isoladamente com HMAC real (assinatura válida aceita; segredo errado, dataId/request-id adulterados, header ausente, hex inválido e timestamp fora da janela — todos rejeitados; manifesto sem `request-id` ainda válido).
  - Migration aplicada de ponta a ponta em Postgres 16 local (schema `private` + tabela reconstruída a partir da migration original): novo evento, reentrega antes de finalizar, finalização como `processed`, reentrega pós-processado corretamente ignorada, evento distinto sobre o mesmo pagamento tratado como novo, finalização como `failed` incrementa tentativas, status inválido rejeitado, permissões `anon`/`authenticated` negadas e `service_role` permitida.
  - **NÃO testado nesta sessão:** notificação real do Mercado Pago em produção/sandbox (sem acesso a credenciais reais neste ambiente). Homologação final depende de configurar `MERCADOPAGO_WEBHOOK_SECRET` e observar uma notificação real chegar com assinatura válida.
- Nenhuma alteração em `src/routes` ou fluxo de reconciliação (`sincronizarPagamentoPixComMercadoPago` intacto); apenas o gatilho HTTP do webhook foi enrijecido.
- Próxima etapa: expiração autoritativa de tentativa Pix no servidor (hoje é só cálculo sob demanda) e módulo de reembolso.

### Microetapa 5.3 — Sincronizar expiração real da cobrança Pix no Mercado Pago — ✅ IMPLEMENTADA
- **Achado durante a investigação (mais grave do que o registrado anteriormente):** `montarCorpoCobrancaPix` (`src/lib/pagamento.server.ts`) nunca enviava `date_of_expiration` ao criar a cobrança no Mercado Pago. Sem esse campo, o Mercado Pago aplica o próprio padrão de validade da cobrança Pix (bem mais longo que o timeout local da Zuvvi), enquanto a tela do passageiro já mostrava "expirado" após `PIX_PAYMENT_TIMEOUT_SECONDS` (padrão 5 minutos) — um cálculo puramente local em `derivarEstadoPagamentoPix`, que nunca escrevia nada no banco.
  - Consequência 1: a corrida ficava presa em `aguardando_pagamento` e o motorista preso/indisponível por muito mais tempo do que os 5 minutos mostrados ao passageiro, até o Mercado Pago expirar a cobrança sozinho — sem qualquer job ou reconciliação forçando esse fechamento antes disso.
  - Consequência 2 (mais grave): como a cobrança no Mercado Pago continuava válida além do timeout local, um passageiro que pagasse o Pix minutos depois de ver "expirado" na tela ainda teria o pagamento aprovado pelo Mercado Pago — reabrindo a corrida de forma inesperada bem depois do usuário já ter desistido visualmente dela.
- **Correção:** `montarCorpoCobrancaPix` agora calcula `date_of_expiration = now + PIX_PAYMENT_TIMEOUT_SECONDS` (mesma função `getPixPaymentTimeoutSeconds` já usada para o timeout exibido ao passageiro) e envia esse valor na criação da cobrança. Isso sincroniza a validade real no Mercado Pago com o que a tela mostra, e reaproveita 100% da lógica de cancelamento já existente e testada (`pix_charge_attempt_complete` e `pix_payment_status_project`, que já tratam `rejected`/`cancelled` cancelando a corrida, liberando o motorista e notificando ambos os lados) — nenhuma lógica nova de cancelamento foi criada.
  - Combinado com o webhook validado da Microetapa 5.2, a expiração real no Mercado Pago agora chega ao servidor de forma autoritativa (webhook) e não depende só da tela do passageiro continuar aberta e chamando `sincronizarPagamentoPixComMercadoPago` em loop.
  - Afeta as duas rotas de criação de cobrança que usam `montarCorpoCobrancaPix` (`pagamento.server.ts` e a regeneração em `pix-etapa.server.ts`).
- **Limitação residual, não fechada nesta etapa:** se o webhook falhar/atrasar E o passageiro fechar a tela exatamente no momento da expiração, sem mais ninguém reabrir aquela tela, ainda não há um cron/job de backstop rodando no servidor puramente por tempo (esse projeto não usa `pg_cron`/Edge Functions em nenhum lugar hoje). O risco do "pagamento surpresa depois de expirado" e o do "motorista preso por até 24h" ficam bem menores (a cobrança real expira junto com a UI), mas o backstop 100% independente de webhook/tela aberta ainda não existe. Decisão de adicionar essa infraestrutura fica para o responsável do projeto, por ser uma escolha de infraestrutura (cron/Edge Function) e não só de código.
- Validação: `npx tsc --noEmit` sem novos erros (só o erro pré-existente de `mercadopago` não instalado neste sandbox); `npx eslint` sem novos erros na região alterada.
- Nenhuma migration necessária.

### ACHADO CRÍTICO NOVO (fora do escopo original G1-G7/B1-B6) — Cancelamento pós-pagamento Pix sem estorno
Durante a investigação da Microetapa 5.3, identificado que **nem `cancelarCorridaMotorista` nem `cancelarCorrida` (passageiro) verificam se o pagamento Pix já foi confirmado (`pagamentos.status = 'pago'`) antes de permitir o cancelamento.** Ambas aceitam cancelamento no status `aceita`, que para Pix só é alcançado exatamente quando o pagamento já foi aprovado pelo Mercado Pago (`pix_charge_attempt_complete`/`pix_payment_status_project` só movem a corrida para `aceita` quando `estado_interno = 'pago'`).
- Como o pagamento Pix usa split via `application_fee` (Mercado Pago Marketplace), o valor já vai direto para a conta do motorista menos a comissão da Zuvvi.
- Ou seja: hoje é possível o motorista OU o próprio passageiro cancelarem uma corrida Pix já paga, e **nenhum reembolso é disparado** — não existe nenhuma chamada a `/v1/payments/{id}/refunds` em todo o `src/`.
- **NÃO CORRIGIDO NESTA ETAPA.** Decidir a política correta (bloquear cancelamento pós-pagamento, estorno automático completo, estorno automático parcial preservando a comissão, ou fluxo manual via Admin) é uma decisão de produto/financeira que precisa do responsável do projeto antes de qualquer implementação — não é uma correção puramente técnica.

### Microetapa 5.4 — Bloquear cancelamento de corrida Pix já paga — ✅ FECHADA
- **Decisão do responsável do projeto:** bloquear o cancelamento (opção recomendada). Sem estorno automático nesta etapa; uma corrida Pix com pagamento confirmado só pode ser encerrada via suporte, não mais pelo botão de cancelar do app.
- **Invariante usada como base da correção:** o trigger `pix_hold_corrida_until_payment_trigger` (migration `20260826164714_pix_confirmacao_pagamento_gate.sql`) garante que uma corrida Pix só chega a `aceita` (e estados posteriores) depois que `pagamentos.status = 'pago'` é confirmado — antes disso ela fica presa em `aguardando_pagamento`. Logo, checar `forma_pagamento = 'pix'` nesses estados já é equivalente a checar pagamento confirmado, sem precisar de consulta extra à tabela `pagamentos`.
- **`cancelarCorridaMotorista`** (`src/lib/motorista.functions.ts`): pré-checagem específica lança erro claro ("pagamento Pix já confirmado... suporte Zuvvi") antes de tentar cancelar; o UPDATE real ganhou `.neq("forma_pagamento", "pix")` como reforço autoritativo (nunca depende só da mensagem amigável).
- **`cancelarCorrida`** (`src/lib/user.functions.ts`, passageiro): mesma pré-checagem. Como esta função também cancela corridas ANTES do aceite (`solicitada`, `buscando_motorista` — nesses estados nenhuma cobrança Pix existe ainda, continuam livres para cancelar), o filtro final não podia ser um `.neq` simples (bloquearia até corridas pix ainda sem cobrança). Usado `.or()` do PostgREST combinando os dois grupos: `status.in.(solicitada,buscando_motorista)` OU `and(status.in.(aceita,motorista_a_caminho), forma_pagamento.neq.pix)`.
- **Validação:** tabela-verdade com 10 combinações de status × forma de pagamento rodada como SQL equivalente em Postgres 16 local — todos os casos bateram com a política esperada (pix pré-aceite livre; pix pós-aceite bloqueado; dinheiro/cartão inalterados em todos os estados). `npx tsc --noEmit` e `npx eslint` sem erros novos nos dois arquivos.
- Nenhuma migration necessária (usa apenas a invariante já garantida por trigger existente).
- Câmbio pendente para o futuro, fora desta etapa: fluxo de suporte/admin para tratar caso a caso os cancelamentos pós-pagamento que chegarem (hoje o usuário só recebe a instrução de contatar o suporte; não há tela dedicada a isso ainda).

### Microetapa 5.5 — Gravar distância, duração e tarifa aplicada na corrida (G3) — ✅ FECHADA
- **Problema:** `criar_corrida_financeira_atomica` só gravava `valor_estimado` — nenhuma coluna registrava a distância/duração calculadas pelo Mapbox nem os valores de bandeirada/valor_km/valor_min/tarifa_mínima efetivamente usados para chegar naquele valor. Sem isso, uma corrida não tinha rastro auditável de como o preço foi calculado (importante para disputas e para o dia em que as tarifas da cidade mudarem e corridas antigas precisarem ser reconstituídas).
- **Correção — schema:** migration `20260905100000_registrar_distancia_tarifa_corrida.sql` adiciona `distancia_km`, `duracao_min`, `tarifa_bandeirada`, `tarifa_valor_km`, `tarifa_valor_min`, `tarifa_minima` em `public.corridas` (nullable, sem backfill de corridas antigas — não há como reconstituir dados históricos que nunca foram calculados). `criar_corrida_financeira_atomica` recriada (assinatura antiga removida com `drop function`) recebendo e gravando esses 6 novos parâmetros.
- **Correção — anti-adulteração:** `cotarCorrida` (`src/lib/user.functions.ts`) agora inclui distância, duração e os 4 componentes de tarifa na assinatura HMAC da cotação (mesmo mecanismo que já protegia lat/lng/valor contra adulteração pelo cliente). `criarCorrida` verifica a assinatura estendida antes de repassar esses valores para a RPC — o cliente nunca escolhe o que é gravado, só ecoa de volta exatamente o que o servidor cotou.
- **Frontend:** `src/routes/confirmar-corrida.tsx` passou a guardar a tarifa retornada por `cotarCorrida` (`quotationTarifas`) e enviá-la junto no `criarCorridaFn`.
- **Validação:** migration aplicada de ponta a ponta em Postgres 16 local sobre a função original recriada a partir do zero — corrida nova grava os 6 campos corretamente, retry idempotente continua retornando o mesmo id sem duplicar, segunda corrida concorrente continua sendo rejeitada com `23505`. Consistência da assinatura HMAC (payload idêntico entre `cotarCorrida` e `criarCorrida`, incluindo um round-trip real via `JSON.stringify`/`parse` para simular a rede, e detecção de adulteração) verificada com script Node isolado. `npx tsc --noEmit` e `npx eslint` sem erros novos.
- `finalizarCorrida` não precisou de alteração: continua usando `valor_final = valor_estimado` (regra de negócio já documentada, sem recalcular tarifa na finalização) — as novas colunas são o snapshot da cotação, não algo recalculado ao final da corrida.

### Microetapa 5.6 — Enforcement real de tipo/tamanho no upload de documentos (G4) — ✅ FECHADA
- **Problema:** `getUploadUrl` (usada pelo onboarding do motorista — os 6 documentos obrigatórios) validava `mimeType`/`fileSize` no schema Zod, mas os dois campos eram `.optional()`. Pior: o único chamador real (`OnboardingForm.tsx`) nunca enviava esses campos — chamava `getUploadUrlFn({ data: { tipo } })` sem `mimeType`/`fileSize` nenhum. E mesmo com os campos presentes, nada impedia o cliente de enviar um conteúdo diferente do declarado diretamente para a signed URL, já que o bucket do Storage não tinha nenhuma restrição própria.
- **Correção — client:** `OnboardingForm.tsx` agora envia `mimeType: file.type` e `fileSize: file.size` (mesmo padrão que `CnhCorrectionForm.tsx` já usava para a correção de CNH).
- **Correção — validação do servidor:** `mimeType`/`fileSize` deixaram de ser opcionais em `getUploadUrl` (`src/lib/motorista.functions.ts`) — agora exige o mesmo formato/limite de 10 MB que `getCnhCorrectionUploadUrl` já exigia.
- **Correção — enforcement real (a que importa de fato):** migration `20260905110000_enforce_documentos_motorista_bucket_limits.sql` configura `file_size_limit = 10485760` e `allowed_mime_types` diretamente no bucket `documentos-motorista` do Supabase Storage. Isso é aplicado pelo próprio Storage a qualquer upload, independente do que o cliente declarar — fecha de vez o contorno de "declarar um tipo e enviar outro arquivo direto pra signed URL".
- **Validação:** migration testada em Postgres 16 local com uma tabela `storage.buckets` reconstruída no formato real do Supabase — cenário com o bucket existente (limite aplicado corretamente, outros buckets não afetados) e cenário sem o bucket (`NOTICE` amigável, migration não falha, sem quebrar ambientes onde o bucket ainda não existe). `npx tsc --noEmit` e `npx eslint` sem erros novos.
- Documentos já enviados anteriormente não são afetados — a restrição do bucket vale só para novos uploads.

### Microetapa 5.7 — Web Push real (B5, parcial) — ✅ IMPLEMENTADA — HOMOLOGAÇÃO PENDENTE
- **Escopo:** notificações eram só in-app (sino + Realtime). Esta etapa fecha a parte de **push web** (motorista aceitou/chegou, cancelamentos, documentos, etc. chegam mesmo com o app fechado, em navegadores/PWA que suportam Web Push). **SMS continua fora de escopo** — decisão de produto/fornecedor separada, não tratada aqui.
- **Restrição real do ambiente:** este sandbox de desenvolvimento não tem acesso ao registry privado do projeto para instalar pacotes novos (`bun add` falha com 403 mesmo para pacotes públicos, pois o registry é forçado globalmente). Por isso a implementação **não usa a biblioteca `web-push`** — reimplementa VAPID (RFC 8292) e a criptografia de mensagem aes128gcm (RFC 8291/8188) direto com `node:crypto`, sem dependência nova.
- **Arquivos novos:**
  - `src/lib/web-push-crypto.server.ts`: geração do header `Authorization: vapid ...` (JWT ES256) e criptografia do payload (ECDH P-256 + HKDF duplo + AES-128-GCM), conforme as RFCs.
  - `src/lib/web-push.server.ts`: envia a notificação via `fetch` ao endpoint da inscrição; trata 404/410 como "inscrição expirada" para o chamador remover.
  - `public/sw-push.js`: `self.addEventListener('push', ...)` e `('notificationclick', ...)` do service worker — arquivo plano, importado pelo SW gerado.
  - `src/lib/push-subscriptions.functions.ts`: `registrarPushSubscription` / `removerPushSubscription` (server functions, ownership resolvido server-side).
  - `src/lib/pwa/push-subscribe.ts`: pede permissão do navegador, inscreve via `PushManager`, envia ao servidor.
  - Migration `20260905120000_push_subscriptions.sql`: tabela `push_subscriptions` (endpoint único, RLS por `usuario_id`).
- **Arquivos alterados:**
  - `vite.config.ts`: `workbox.importScripts: ["sw-push.js"]` — `generateSW` não expõe um hook direto pra eventos arbitrários, então importScripts é o caminho oficial documentado pelo workbox para isso.
  - `src/lib/notificacoes.server.ts`: `criarNotificacao` (o único ponto de entrada de toda notificação in-app do app) agora também dispara push best-effort para as inscrições do usuário — nenhum outro call site precisou ser tocado. Falha de push nunca derruba a notificação in-app nem o fluxo que a originou.
  - `src/components/NotificationBell.tsx`: banner opcional "Ativar notificações no aparelho" (some após decisão do usuário; não aparece se o navegador já decidiu permitir/negar).
- **Validação feita nesta sessão (sem instalar nada, sem acesso a navegador real):**
  - Round-trip completo de RFC 8291 verificado com o módulo real compilado: um destinatário simulado localmente decifra corretamente o payload criptografado pelo servidor; segredo de autenticação errado é rejeitado pela tag do AES-GCM (integridade comprovada).
  - JWT VAPID gerado pelo módulo real tem assinatura ES256 verificada com sucesso contra a chave pública correspondente; JWT adulterado é corretamente rejeitado.
  - Migration `push_subscriptions` testada em Postgres 16 local: usuário autenticado só grava/vê a própria inscrição, tentativa de gravar para outro usuário é bloqueada por RLS, `service_role` enxerga tudo, `anon` não tem acesso nenhum.
  - `npx tsc --noEmit` e `npx eslint` sem erros novos nos arquivos tocados.
  - **NÃO verificado nesta sessão (só é possível no ambiente real de vocês):** entrega de uma notificação de verdade num navegador/PWA instalado, e se `workbox.importScripts` funciona exatamente como esperado na versão de `vite-plugin-pwa`/`workbox-build` instalada — não consegui instalar essas dependências aqui pra conferir o build gerado.
- **AÇÃO NECESSÁRIA FORA DO CÓDIGO (obrigatória para funcionar):**
  1. Gerar um par de chaves VAPID de produção (posso gerar e entregar diretamente na conversa — são só 2 valores curtos, geração local com `node:crypto`, sem custo/conta externa nenhuma).
  2. Configurar `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (segredo do servidor) e `VITE_VAPID_PUBLIC_KEY` (mesmo valor da pública, exposto ao cliente) nas variáveis de ambiente de produção.
  3. Opcional: `VAPID_SUBJECT` (um `mailto:` ou URL de contato real da Zuvvi) — sem isso usa um valor de fallback genérico.
  4. Testar em um build de produção real (o service worker não registra em dev/preview) num navegador com suporte a Push (Chrome/Edge/Firefox desktop e Android; iOS Safari só a partir do PWA instalado na tela de início, com limitações da Apple).
- Próxima etapa possível: SMS (decisão de fornecedor) e/ou uma tela de configuração de notificações para o usuário desativar por tipo — nenhum dos dois foi tratado aqui.

### Microetapa 5.8 — Contatos de confiança + Viagem compartilhada — ✅ IMPLEMENTADA — HOMOLOGAÇÃO PENDENTE
- **Escopo:** as tabelas `contatos_confianca` e `viagens_compartilhadas` existiam no banco desde 17/08 mas nunca tiveram nenhuma função de servidor ou tela — feature de segurança inteira não entregue. Esta etapa constrói as duas de ponta a ponta.
- **ACHADO DE SEGURANÇA corrigido antes de construir em cima da tabela:** a policy pública original de `viagens_compartilhadas` (`"Leitura pública do link de acompanhamento"`) fazia `SELECT ... USING (expira_em > now())` **sem nenhum filtro por `link_publico`** — qualquer cliente anônimo podia listar TODAS as viagens compartilhadas ativas de todo mundo (corrida_id + link secreto), quebrando por completo o modelo de "link imprevisível" que a tabela pretende implementar. A tabela estava vazia em produção (feature nunca usada), então corrigir agora não tem custo de migração de dados.
  - Migration `20260905130000_viagem_compartilhada_leitura_publica_segura.sql`: remove essa policy e revoga `SELECT` de `anon` na tabela; cria `get_viagem_compartilhada_publica(p_link_publico text)` — `SECURITY DEFINER`, busca exata por token (nunca lista), retorna só o mínimo necessário (status, nomes de origem/destino, primeiro nome do motorista, placa/modelo do veículo, posição atual do motorista **só** enquanto a corrida está em estado ativo, `expira_em`) — nunca o passageiro, pagamento, código de embarque ou a corrida inteira.
  - Validado em Postgres 16 local: `anon` não lê mais a tabela diretamente nem `corridas`/`motoristas`; a RPC com token certo retorna os dados certos; token errado, expirado ou vazio retorna 0 linhas sem erro.
- **Contatos de confiança** (`src/lib/contatos-confianca.functions.ts`): `listarContatosConfianca` / `criarContatoConfianca` (limite de 5, telefone validado/normalizado) / `excluirContatoConfianca`, seguindo exatamente o padrão já usado em `favoritos.functions.ts`. UI: `ContatosConfiancaDialog` acessível em `/perfil` → "Contatos de confiança".
- **Compartilhar viagem** (`src/lib/viagem-compartilhada.functions.ts`):
  - `compartilharCorrida`: só o passageiro dono da corrida, só em estados ativos (`aceita`, `motorista_a_caminho`, `motorista_chegou`, `em_andamento`); reaproveita um link já ativo em vez de duplicar; janela de validade de 4h.
  - `encerrarCompartilhamentoCorrida`: apaga o(s) link(s) da corrida — encerramento manual a qualquer momento.
  - `getViagemCompartilhadaPublica` / `getMapboxTokenParaViagemCompartilhada`: **sem** `requireSupabaseAuth` (de propósito — quem abre o link não tem conta na Zuvvi); a segurança vem inteiramente do token de 128 bits, validado pela RPC acima. `getMapboxTokenParaViagemCompartilhada` é uma exceção controlada à regra geral de `getMapboxToken` exigir sessão — só libera o token do Mapbox depois de validar que o link é real e não expirou.
  - UI: botão "Compartilhar" (ícone) ao lado do Chat em `/acompanhamento`, abre `CompartilharViagemDialog` (link + copiar + abrir no WhatsApp + encerrar). Nova rota pública `/viagem-compartilhada?token=...` (sem login, com polling a cada 8s, mapa ao vivo via `MapView` reaproveitado).
- **Rota nova:** `routeTree.gen.ts` regenerado com o gerador oficial do TanStack Router (`@tanstack/router-generator`, config padrão do projeto — sem `tsr.config.json`, estilo/aspas conferidos batendo com o arquivo já existente) para registrar `/viagem-compartilhada`; diff mínimo, só a rota nova adicionada.
- **Validação:** `npx tsc --noEmit` e `npx eslint` sem erros novos em nenhum arquivo tocado. Migration e RPC testadas de ponta a ponta em Postgres 16 local (ver achado de segurança acima).
- **NÃO verificado nesta sessão:** fluxo completo num navegador real (gerar link → abrir em outra aba/dispositivo → ver posição atualizando) — mesma limitação de sempre neste ambiente sandbox (sem browser).
- Nenhuma alteração em fluxo de corrida, pagamento ou core existente — feature inteiramente aditiva.

## Auditoria pós-PR #6 e nova frente de trabalho — 05/09/2026

Com o PR #6 verde (microetapas 5.1 a 5.8), nova auditoria ponta a ponta identificou que o restante do trabalho para "fechar o app" deixou de ser bugs pontuais e passou a ser: features inteiras nunca construídas (carteira do motorista, parte financeira do Admin), maturidade operacional (testes automatizados, observabilidade/monitoramento de erro, rate limiting em endpoints públicos) e decisões de produto/jurídicas (SMS, LGPD/política de privacidade). Nenhum bug crítico novo encontrado nos itens já fechados.

### Microetapa 5.9 — Carteira do motorista — ✅ IMPLEMENTADA — HOMOLOGAÇÃO PENDENTE
- **Escopo:** o botão "Ganhos" na bottom nav de `home-motorista.tsx` e `perfil-motorista.tsx` era puramente decorativo (`disabled`, sem link, `opacity-50`) — motorista que recebe dinheiro via Pix (com split/`application_fee`) não tinha nenhuma tela para conferir o que ganhou.
- **`src/lib/carteira-motorista.functions.ts`** (novo): `getCarteiraMotorista` lê `corridas` do motorista autenticado (`status = 'concluida'`) com `pagamentos` embutido, e só considera ganho o que está com `pagamentos.status = 'pago'` — dinheiro que o motorista marcou como não recebido (`finalizarCorrida` com `recebido:false`) fica `pendente` e corretamente não entra na carteira. `valor_motorista` já é o valor líquido após comissão (`valor_comissao`), então a carteira mostra exatamente o que cai pro motorista.
  - Resumo: hoje / últimos 7 dias / mês civil (fusos calculados em `America/Sao_Paulo`, mesmo padrão já usado em `motorista-eligibility.server.ts` para a regra de CNH) / total acumulado / total de corridas pagas.
  - Histórico: últimas 50 corridas pagas (origem, destino, forma de pagamento, valor bruto e líquido).
  - Sem migration nova — só leitura de dados já existentes (`corridas`/`pagamentos`).
- **UI:** nova rota `/carteira-motorista` (mesmo padrão de guarda de `home-motorista.tsx`: `resolveDestinationForLoader` + `redirectTo !== "/home-motorista"`). Botões "Ganhos" em `home-motorista.tsx` e `perfil-motorista.tsx` deixaram de ser decorativos e agora levam pra lá.
- **Validação:** lógica de corte de dia/semana/mês (incluindo o caso de fuso-horário onde um pagamento às 23h UTC e outro à 1h UTC do dia seguinte caem no mesmo dia civil em `America/Sao_Paulo`) testada isoladamente com dados simulados antes de integrar — todos os casos bateram. `npx tsc --noEmit` e `npx eslint` sem erros novos (comparado arquivo a arquivo contra o estado antes da mudança).
- **NÃO verificado nesta sessão:** tela real num navegador com dados de produção — mesma limitação de sempre (sandbox sem browser).
- Nenhuma alteração em `finalizarCorrida`, fluxo de pagamento ou qualquer lógica de negócio existente — feature somente de leitura, aditiva.

