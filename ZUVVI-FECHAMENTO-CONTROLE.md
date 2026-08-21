$(cat ZUVVI-FECHAMENTO-CONTROLE.md.restored)

## Reconciliação operacional atual — 21/08/2026

### Baseline operacional atual

- GitHub funcional auditado antes desta atualização:
  f9d6f092ff5ad939cdfc39832e598aa6763a9500

### Supabase REAL

- 15 tabelas públicas;
- 45 migrations;
- última migration: 20260821212540;
- public.corridas está no Supabase Realtime;
- nenhuma tabela de chat, mensagens ou conversas existe;
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
❌ NÃO IMPLEMENTADO

Estado real:

- nenhuma tabela de chat existe;
- nenhuma estrutura de mensagens existe;
- nenhuma presença de chat existe;
- nenhum Realtime específico de chat existe;
- /acompanhamento ainda contém "Em breve: Chat".

Próxima funcionalidade planejada:

CHAT 1 —
Banco + ownership + RLS + segurança + Realtime.

Isto é planejamento.
NÃO declarar implementado.

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

### Próxima microetapa oficial

CHAT 1 —
Fundação de banco, ownership, RLS,
segurança e Realtime.

A implementação do Chat NÃO faz parte desta
microcorreção documental.
