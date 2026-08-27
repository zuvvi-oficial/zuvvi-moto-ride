# FONTE DA VERDADE PIX ZUVVI — V2

**Versão:** 2.0  
**Data-base:** 27/08/2026  
**Repositório:** `zuvvi-oficial/zuvvi-moto-ride`  
**Branch de trabalho:** `feature/pix-100-seguro`  
**Pull Request:** `#2`  
**Supabase:** projeto `qycblinfvijhfjcmdoof`  
**Status:** PLANO MESTRE DE CORREÇÃO — PIX NÃO APROVADO PARA PRODUÇÃO  

---

## 1. FINALIDADE DESTE DOCUMENTO

Este arquivo é a **Fonte da Verdade operacional única para a correção e homologação do Pix da Zuvvi**.

A partir desta versão:

1. toda microetapa Pix começa pela leitura deste arquivo;
2. nenhuma alteração é feita fora da allowlist escrita antes da microetapa;
3. nenhuma etapa seguinte começa antes da etapa atual estar testada e classificada;
4. nenhuma funcionalidade fora do Pix pode ser alterada para facilitar, acelerar ou “aproveitar” a correção;
5. qualquer descoberta nova relevante é registrada aqui antes de ampliar o escopo;
6. divergência entre este documento e documentação Pix anterior é resolvida em favor desta V2 para o programa de correção atual;
7. histórico anterior não é apagado: esta V2 consolida o estado real auditado e define o plano de recuperação.

A meta não é apenas “gerar um QR Code”. A meta é provar que o ciclo financeiro completo do Pix funciona com isolamento entre motoristas, cobrança na conta correta, comissão Zuvvi, confirmação canônica, expiração, reembolso, segurança, idempotência e ausência de regressão no restante do sistema.

---

## 2. REGRA ABSOLUTA: PROJETO TRAVADO POR PADRÃO

O projeto inteiro é considerado **congelado por padrão**.

### 2.1 Fora do Pix: PROIBIDO ALTERAR

Ficam congelados:

- autenticação geral;
- cadastro geral;
- recuperação de conta;
- perfis fora do gancho Pix estritamente necessário;
- GPS;
- geolocalização;
- mapas;
- cálculo de rota;
- cotação;
- tarifas;
- matching geral;
- disponibilidade geral do motorista, salvo compensação exclusiva de falha Pix já comprovada;
- ciclo geral de corrida, salvo guardas exclusivas `forma_pagamento = 'pix'`;
- dinheiro;
- cartão;
- suporte;
- chat;
- cidades;
- documentos;
- aprovação de motorista;
- notificações gerais;
- identidade visual global;
- Design System;
- dependências sem autorização específica;
- tabelas, políticas e funções sem ligação direta com Pix.

### 2.2 Gancho mínimo obrigatório

Se uma regra Pix precisar tocar um arquivo ou função central:

- a alteração deve ser condicionada exclusivamente ao Pix;
- nenhum comportamento de dinheiro/cartão pode ser reorganizado;
- nenhuma refatoração lateral é permitida;
- nenhuma formatação ampla do arquivo é permitida;
- o diff precisa mostrar exatamente o gancho antes/depois;
- regressão de dinheiro/cartão e corrida normal é obrigatória.

### 2.3 Lovable

Durante este plano:

- **não solicitar ao Lovable para corrigir, reescrever ou implementar o Pix**;
- não usar o Lovable como agente de alteração;
- alterações de código serão feitas e versionadas no GitHub;
- alterações de banco serão feitas pelo fluxo controlado do Supabase e sempre reconciliadas com migration no GitHub;
- configuração externa inevitável do Mercado Pago, quando houver, será tratada como etapa de configuração/homologação e não como alteração automática do Lovable.

### 2.4 Main

- nenhuma escrita direta silenciosa na `main`;
- desenvolvimento e correções ficam na branch Pix controlada;
- merge só ocorre após plano de integração, testes acumulados e aprovação final.

---

## 3. FONTES CANÔNICAS QUE DEVEM SER CONSULTADAS

Antes de cada microetapa, consultar obrigatoriamente:

1. **este arquivo** `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI_V2.md`;
2. GitHub `main` atual;
3. GitHub `feature/pix-100-seguro` atual;
4. diff real entre `main` e branch Pix;
5. migrations Pix versionadas no GitHub;
6. histórico real de migrations no Supabase de produção;
7. catálogo real do Supabase para objetos afetados;
8. dados operacionais mínimos necessários ao diagnóstico, sem expor segredos;
9. documentação oficial atual do Mercado Pago para OAuth, Marketplace/Split, Pix, Webhooks e reembolsos quando a etapa depender dessas regras.

Não confiar somente em documentação antiga, comentários do código, build antigo ou resultado de teste antigo.

---

## 4. BASELINE REAL DA AUDITORIA V2

### 4.1 GitHub

No fechamento da auditoria de 27/08/2026:

- `main`: `de4d054643f7c67f22ee9c183a84af05f0809db7`;
- branch Pix: `28035747e739b34bbf5af01fb51831d742c0b666`;
- PR `#2`: aberta, draft, não mergeada e não mergeável;
- PR com 188 commits e 97 arquivos alterados;
- comparação da branch com a `main`: branch 188 commits à frente e 12 commits atrás;
- SHA atual da branch não possuía execução de GitHub Actions correspondente no momento da auditoria.

Conclusão: **a branch Pix não pode ser tratada como pronta para merge**.

### 4.2 Supabase — credenciais Mercado Pago

Estado auditado:

- 2 registros de credenciais privadas;
- 1 conexão ativa;
- 1 conexão revogada;
- 0 duplicidades de `mercadopago_user_id` ativo;
- 0 duplicidades de `motoristas.conta_mercado_pago_id`;
- 0 divergências detectadas entre projeção pública ativa e credencial privada ativa;
- tokens privados protegidos por schema privado/RLS/grants;
- RPCs OAuth sensíveis executáveis apenas pela fronteira privilegiada prevista.

### 4.3 Supabase — tentativas Pix

Estado auditado:

- 33 tentativas Pix;
- 33 `falhou`;
- 0 `criando`;
- 0 `pendente`;
- 0 `pago`;
- 0 `estornado`.

Falhas observadas:

- 16 `mercadopago_create_rejected` sem diagnóstico antigo detalhado preservado;
- 12 `rejected_high_risk`;
- 3 rejeições pelo parâmetro inválido `additional_info.payer.identification`;
- 1 `Invalid user identification number`;
- 1 `You cannot use application_fee with this payment.`

Conclusão: **não existe até este baseline uma prova real de cobrança Pix aprovada ponta a ponta**.

### 4.4 Webhook

Estado auditado:

- tabela privada de eventos existe;
- 0 eventos registrados;
- handler atual usa o Webhook como gatilho e consulta o estado canônico na API do Mercado Pago;
- assinatura `x-signature` ainda não é validada no handler atual;
- deduplicação/auditoria pela tabela privada ainda não está integrada ao handler.

### 4.5 Expiração e reembolso

Estado auditado:

- existe cálculo de deadline/contador de 5 minutos para a tela Pix;
- existe estado visual `expirado`;
- não foi comprovado um encerramento financeiro autoritativo e completo acionado no servidor pelo vencimento;
- existe estado local `estornado` no modelo;
- não foi encontrada implementação ponta a ponta de refund/reembolso Mercado Pago;
- aprovação tardia após cancelamento ainda não está fechada ponta a ponta.

### 4.6 Trava de início da corrida

Existe trigger no banco que impede corrida Pix de avançar para estados operacionais quando o pagamento agregado não está `pago`.

Esta proteção é considerada **boa e congelada**, salvo correção comprovadamente necessária.

---

## 5. INVARIANTES NÃO NEGOCIÁVEIS DO PIX ZUVVI

Estas regras devem permanecer verdadeiras em todas as etapas:

1. Cada motorista Zuvvi possui sua própria conta Mercado Pago recebedora.
2. Um motorista nunca pode consultar, usar, renovar ou receber token OAuth de outro motorista.
3. O navegador nunca recebe Access Token, Refresh Token, Client Secret, Service Role ou chave de criptografia.
4. A conta Mercado Pago recebedora de uma cobrança deve ser a conta ativa e confirmada do motorista atribuído à corrida.
5. A mesma conta Mercado Pago não pode estar ativa para dois motoristas.
6. O plano final deve preservar também um vínculo histórico que impeça a mesma conta Mercado Pago de ser apropriada por outro motorista sem processo administrativo deliberado.
7. A conta Mercado Pago da própria plataforma/integrador Zuvvi não pode ser usada como conta de motorista recebedor.
8. Desconectar uma conta precisa revogar o vínculo local e os tokens sem deixar estado fantasma.
9. Reconectar nunca pode ativar silenciosamente uma conta só porque o navegador já possui sessão Mercado Pago.
10. O retorno OAuth deve ser tratado como autorização pendente; a ativação final exige confirmação explícita e validações de propriedade.
11. Não depender de parâmetros OAuth não documentados para “forçar login” ou troca de conta.
12. Corrida Pix não pode ser aceita/continuada com credencial inválida.
13. Cobrança Pix é criada somente depois de existir motorista correto atribuído.
14. Cobrança usa Access Token OAuth daquele motorista.
15. `application_fee` só permanece quando a configuração Marketplace/Split estiver comprovadamente compatível.
16. Não remover comissão para mascarar erro de configuração.
17. Idempotência deve impedir cobrança financeira duplicada.
18. Toda cobrança precisa ser reconciliável por ID Mercado Pago + referência externa + valor + recebedor.
19. Nenhum status recebido em Webhook é aceito como verdade financeira sem consulta canônica ao Mercado Pago.
20. Webhook deve validar assinatura antes do processamento financeiro.
21. Webhook repetido não pode produzir efeito financeiro repetido.
22. Pagamento aprovado é a única condição financeira que libera o início da corrida Pix.
23. A expiração precisa ter consequência autoritativa no servidor, não apenas visual.
24. Aprovação tardia após cancelamento precisa entrar em fluxo seguro de reconciliação/reembolso.
25. Estado `estornado` só pode ser gravado após confirmação canônica do reembolso.
26. Nenhuma etapa é aprovada somente porque build passou.
27. Dinheiro e cartão devem permanecer sem mudança de comportamento.
28. Nenhum segredo deve aparecer em commit, log, relatório ou resposta.
29. Nenhuma migration de produção pode existir sem versão correspondente no GitHub.
30. Nenhuma migration histórica pode ser reaplicada apenas para “alinhar” timestamps.

---

## 6. CLASSIFICAÇÃO ATUAL DOS BLOCOS

| Bloco | Estado V2 | Regra |
|---|---|---|
| Criptografia OAuth | CONGELAR | manter salvo falha comprovada |
| PKCE/state de uso único | CONGELAR | manter |
| Tokens privados por motorista | CONGELAR | manter |
| Projeção pública de conta ativa | MANTER/VALIDAR | ajustar apenas se necessário à nova confirmação |
| Desconexão segura | MANTER/TESTAR | comportamento base está correto |
| Reconexão/troca de conta | CORRIGIR | prioridade funcional |
| Propriedade histórica da conta | IMPLEMENTAR | segurança entre motoristas |
| Bloqueio da conta integradora | IMPLEMENTAR | segurança financeira |
| Cobrança Pix | CORRIGIR/HOMOLOGAR | 0 pagamentos aprovados |
| `application_fee` | VALIDAR MARKETPLACE | não remover como gambiarra |
| Payer/CPF | VALIDAR | manter payload compatível |
| Antifraude/device ID | CORRIGIR/HOMOLOGAR | 12 high risk |
| Idempotência | CONGELAR/REGREDIR | base existente boa |
| Reconciliador canônico | CONGELAR/REGREDIR | base existente boa |
| Webhook assinatura | IMPLEMENTAR | obrigatório |
| Webhook deduplicação/auditoria | IMPLEMENTAR | obrigatório |
| Gate de início da corrida | CONGELAR | banco já protege |
| Expiração autoritativa | IMPLEMENTAR | obrigatório |
| Reembolso | IMPLEMENTAR | obrigatório |
| Aprovação tardia | IMPLEMENTAR | obrigatório |
| UI passageiro Pix | VALIDAR DEPOIS | depois do financeiro |
| UI motorista Pix | VALIDAR DEPOIS | depois do financeiro |
| Merge PR | BLOQUEADO | somente no final |

---

## 7. PROTOCOLO OBRIGATÓRIO DE CADA MICROETAPA

Toda microetapa seguirá exatamente esta sequência:

### Passo A — Reabrir a Fonte da Verdade

- ler esta V2;
- localizar etapa/microetapa atual;
- confirmar o último checkpoint aprovado.

### Passo B — Baseline somente leitura

Registrar:

- SHA da `main`;
- SHA da branch Pix;
- git diff relevante;
- estado da PR;
- migrations GitHub envolvidas;
- migrations Supabase envolvidas;
- catálogo/tabelas/funções/policies relevantes;
- contagens mínimas de controle;
- estado dos testes anteriores.

### Passo C — Allowlist antes da escrita

Escrever explicitamente:

- arquivos que podem mudar;
- arquivos novos permitidos;
- tabelas/colunas/índices/funções SQL permitidos;
- comportamento exato que poderá mudar;
- comportamento que deve permanecer byte a byte/lógico;
- testes obrigatórios;
- rollback.

Se algo necessário não estiver na allowlist: **PARAR**.

### Passo D — Uma alteração por objetivo

- uma causa comprovada;
- uma solução mínima;
- nenhum reparo lateral;
- nenhuma refatoração cosmética.

### Passo E — Revisão do diff

Reprovar automaticamente se aparecer:

- arquivo fora da allowlist;
- mudança em dinheiro/cartão;
- segredo;
- dependency/lockfile não autorizado;
- alteração ampla de core;
- migration destrutiva não prevista.

### Passo F — Teste técnico

Conforme aplicável:

- TypeScript;
- lint;
- build;
- testes unitários;
- testes de integração Pix;
- pgTAP/Supabase local;
- advisors;
- revisão de grants/RLS;
- prova de idempotência;
- prova de ownership.

### Passo G — Teste no Supabase real

Depois de mudança autorizada em produção:

- verificar catálogo;
- verificar migration history;
- verificar constraints/índices/policies/grants;
- verificar dados criados pelo teste;
- verificar ausência de efeitos em objetos congelados.

### Passo H — Teste prático

O teste manual deve dizer exatamente:

- qual conta usar;
- qual app abrir;
- onde tocar;
- qual resultado esperar;
- qual evidência observar.

### Passo I — Classificação

Somente três estados:

- `APROVADA`;
- `PARCIALMENTE APROVADA`;
- `REPROVADA`.

Somente `APROVADA` libera a próxima microetapa.

---

# 8. PLANO MESTRE DE CORREÇÃO

---

## ETAPA 0 — ESTABILIZAÇÃO GIT + MIGRATIONS + BASELINE

### Objetivo

Criar um único ponto técnico confiável antes de qualquer nova correção funcional.

### Por que vem primeiro

A branch Pix está divergente da `main`, a PR está não mergeável e o SHA atual não possui prova de CI. Corrigir funcionalidade sobre uma base divergente aumenta risco de regressão e conflito silencioso.

### Microetapa 0.1 — Fonte da Verdade V2 e fotografia

Allowlist:

- criar somente este documento V2;
- nenhuma mudança de código;
- nenhuma mudança de banco.

Teste:

- comprovar que o arquivo existe somente na branch Pix;
- confirmar `main` inalterada;
- registrar SHA do commit da V2.

Critério: `APROVADA` quando o documento estiver versionado sem qualquer outro arquivo alterado.

### Microetapa 0.2 — Mapa de divergência Git

Somente leitura:

- identificar os 12 commits da `main` ausentes da branch;
- classificar cada conflito por área;
- separar Pix de core;
- identificar mudanças recentes que afetam OAuth/Pix;
- não resolver conflitos ainda.

Saída: mapa de integração, sem escrita.

### Microetapa 0.3 — Reconciliação de migrations

Somente leitura primeiro:

- mapear cada migration lógica da branch para a versão aplicada no Supabase;
- registrar as cinco divergências conhecidas de timestamp;
- provar equivalência ou diferença real;
- nunca reaplicar migration só para igualar histórico.

Se correção Git for necessária, criar microetapa exclusiva de reconciliação de histórico, sem DDL/DML remoto.

### Microetapa 0.4 — Integração controlada da `main` na branch Pix

Somente depois de 0.2/0.3 aprovadas.

Regras:

- preservar todas as alterações funcionais novas da `main` fora do Pix;
- resolver apenas conflitos;
- em conflito entre core recente da `main` e branch Pix, preservar core recente e reaplicar somente o gancho Pix mínimo;
- nenhum merge para `main` nesta etapa.

Testes:

- diff por arquivo;
- dinheiro;
- cartão;
- autenticação;
- build;
- TypeScript;
- toda bateria Pix disponível.

### Saída da Etapa 0

Um checkpoint Git/Supabase coerente, testável e sem conflito, ainda sem declarar Pix pronto.

---

## ETAPA 1 — CONTA MERCADO PAGO INDIVIDUAL, CONFIRMADA E NÃO REUTILIZÁVEL ENTRE MOTORISTAS

### Objetivo

Eliminar definitivamente reconexão silenciosa, vínculo cruzado e apropriação da mesma conta Mercado Pago por motoristas diferentes.

### Comportamento final obrigatório

Fluxo desejado:

`Conectar -> OAuth -> retorno autorizado -> validações -> confirmação explícita -> ativar`.

Nunca:

`Conectar -> sessão já aberta no navegador -> ativar automaticamente`.

### Microetapa 1.1 — Modelo de propriedade histórica

Projetar estrutura privada mínima para registrar de forma permanente:

`mercadopago_user_id -> motorista_id`.

Regras:

- um ID Mercado Pago pode pertencer a um único motorista Zuvvi;
- revogar/desconectar não transfere a propriedade para outro motorista;
- eventual liberação futura será processo administrativo separado e auditado;
- tabela privada;
- acesso somente servidor;
- RLS/grants mínimos;
- sem token bruto.

### Microetapa 1.2 — OAuth em estado pendente

Alterar o callback para não ativar imediatamente a credencial definitiva.

No retorno OAuth:

- validar state/PKCE como hoje;
- trocar code por tokens;
- cifrar tokens;
- identificar `mercadopago_user_id`;
- validar propriedade histórica;
- rejeitar conta proibida;
- persistir autorização pendente privada com prazo curto;
- não atualizar ainda `motoristas.conta_mercado_pago_id` como ativa.

### Microetapa 1.3 — Confirmação explícita

Criar ação autenticada do motorista para confirmar a autorização pendente.

Antes de ativar:

- motorista da sessão deve ser o dono da tentativa;
- conta não pode pertencer a outro motorista;
- conta não pode ser identificada como conta da plataforma/integrador;
- autorização pendente deve estar íntegra e não vencida;
- ativação pública+privada deve ser atômica.

### Microetapa 1.4 — Reconectar mesma conta versus trocar conta

Se o navegador retornar a mesma conta recém-desconectada:

- nunca ativar silenciosamente;
- mostrar que aquela foi a conta autorizada;
- exigir confirmação explícita para “Reconectar esta conta”;
- se o objetivo for trocar, cancelar a autorização pendente e orientar nova autenticação/troca no Mercado Pago;
- não usar parâmetro OAuth não documentado para fingir que o Mercado Pago sempre mostrará login.

### Teste obrigatório da Etapa 1

Usar duas identidades Zuvvi e duas contas Mercado Pago distintas:

- Motorista A + MP A;
- Motorista B + MP B.

Cenários:

1. A conecta A;
2. B conecta B;
3. A não consegue conectar B;
4. B não consegue conectar A;
5. A não acessa credenciais de B;
6. B não acessa credenciais de A;
7. A desconecta;
8. sessão MP A permanece aberta no navegador;
9. iniciar conexão novamente não ativa MP A silenciosamente;
10. reconectar MP A exige confirmação explícita;
11. trocar para outra conta exige nova autorização confirmada;
12. replay do callback falha;
13. state de outro motorista falha;
14. autorização pendente vencida falha;
15. refresh da página não troca proprietário;
16. conta da plataforma/integrador é bloqueada.

Critério: todos aprovados.

---

## ETAPA 2 — MARKETPLACE/SPLIT E `application_fee`

### Objetivo

Provar que a arquitetura financeira oficial está correta antes de modificar o payload para contornar erros.

### Regra

A Zuvvi é plataforma/marketplace. O motorista é vendedor/recebedor. A cobrança usa OAuth do motorista e a comissão Zuvvi usa `application_fee` quando suportada pela configuração Marketplace/Split adotada.

### Microetapa 2.1 — Prova de configuração

Confirmar, pela documentação oficial atual e pelas configurações reais do Mercado Pago:

- aplicação correta;
- modelo Marketplace/Split aplicável;
- vendedor elegível;
- conta vendedora diferente da conta integradora;
- escopos OAuth necessários;
- Access Token realmente pertence ao vendedor.

Sem mudança de payload nesta microetapa.

### Microetapa 2.2 — Cobrança mínima controlada

Com vendedor correto:

- valor pequeno controlado;
- `application_fee` calculada pela regra existente da Zuvvi;
- idempotência;
- `payment_method_id = pix`;
- recebedor esperado.

Critério mínimo:

Mercado Pago deve aceitar a criação e devolver pagamento Pix utilizável.

Se `application_fee` falhar com vendedor/configuração corretos, parar e diagnosticar Marketplace antes de alterar código.

### Proibição

Não remover `application_fee` apenas para o QR nascer.

---

## ETAPA 3 — PAYLOAD, CPF E ANTIFRAUDE

### Objetivo

Fazer a criação Pix chegar de forma consistente a `pending`/estado pagável sem rejeições por dados inválidos ou risco artificial de teste.

### Itens

- manter CPF somente nos campos oficialmente suportados;
- validar CPF antes de enviar quando usado;
- evitar CPF inválido/fictício em teste que pretende provar produção;
- nome/e-mail/celular coerentes;
- Device ID ligado ao passageiro correto;
- sessão antifraude vigente;
- sem dados cruzados entre passageiros;
- sem auto pagamento indevido entre contas relacionadas;
- logs sanitizados;
- preservar erro do provedor de forma suficiente para diagnóstico.

### Testes

- sem CPF;
- CPF válido;
- CPF inválido localmente bloqueado antes da API quando aplicável;
- Device ID ausente;
- Device ID expirado;
- Device ID válido;
- retry idempotente;
- rejeição de alto risco com diagnóstico preservado;
- cenário controlado que finalmente resulte em cobrança pagável.

Critério: existir ao menos uma cobrança Pix real/controlada em estado pagável, sem quebrar idempotência.

---

## ETAPA 4 — WEBHOOK AUTENTICADO, DEDUPLICADO E AUDITÁVEL

### Objetivo

Transformar o Webhook em entrada autenticada e idempotente, mantendo a consulta canônica já existente.

### Regras

- validar `x-signature` segundo documentação oficial atual;
- usar `x-request-id`/dados necessários à validação;
- segredo de Webhook nunca no navegador/log/Git;
- assinatura inválida não processa estado financeiro;
- evento aceito gera chave de deduplicação;
- tabela privada de eventos passa a ser utilizada;
- evento duplicado retorna resposta segura sem repetir efeitos;
- status financeiro continua vindo da consulta canônica à API do Mercado Pago, nunca do corpo do Webhook isoladamente.

### Testes

- assinatura válida;
- assinatura inválida;
- assinatura ausente;
- evento sem payment ID;
- mesmo evento duas vezes;
- eventos fora de ordem;
- approved;
- rejected;
- cancelled;
- refund;
- indisponibilidade temporária da API.

Critério: processamento idempotente e auditável com zero confiança financeira no payload bruto.

---

## ETAPA 5 — EXPIRAÇÃO AUTORITATIVA DE 5 MINUTOS

### Objetivo

Fazer o vencimento deixar de ser apenas estado de UI.

### Regra

O servidor é autoridade de deadline.

Ao vencer:

1. consultar estado canônico antes de cancelar;
2. se ainda não pago, fechar a tentativa conforme regra aprovada;
3. marcar agregado/corrida de forma coerente;
4. liberar motorista com segurança;
5. impedir uso do QR antigo para liberar a corrida;
6. qualquer aprovação posterior entra no fluxo de aprovação tardia/reembolso.

### Testes

- expira sem pagamento;
- pagamento ocorre segundos antes do deadline;
- Webhook atrasado;
- passageiro fecha app;
- nenhum polling do passageiro por alguns minutos;
- servidor reinicia;
- tentativa antiga não é reutilizada.

Critério: expiração correta mesmo sem depender do contador do navegador.

---

## ETAPA 6 — REEMBOLSO E APROVAÇÃO TARDIA

### Objetivo

Fechar o ciclo financeiro que hoje está modelado mas não implementado.

### Regras

- refund identificado pelo pagamento Mercado Pago correto;
- idempotência de refund;
- nunca marcar `estornado` antes de confirmação canônica;
- aprovação após corrida cancelada deve ser detectada;
- política de refund deve ser executada e auditada;
- falha de refund não pode ser ocultada;
- estado financeiro e estado da corrida devem permanecer coerentes.

### Testes

- refund completo;
- refund repetido;
- refund já concluído;
- provedor indisponível;
- saldo/condição do vendedor incompatível;
- Webhook de refund duplicado;
- aprovação tardia após expiração;
- aprovação tardia após cancelamento operacional.

Critério: nenhuma aprovação tardia fica sem tratamento financeiro determinístico.

---

## ETAPA 7 — TRAVAS DA CORRIDA E REGRESSÃO DO CORE

### Objetivo

Comprovar que o Pix pago libera e o Pix não pago bloqueia, sem alterar o restante do ciclo.

### Regra

Preservar o trigger de banco atual salvo falha comprovada.

### Testes

- Pix `pendente` não inicia;
- Pix `analisando` não inicia;
- Pix `pago` inicia;
- chamada direta ao servidor tentando burlar UI é bloqueada;
- corrida de outro motorista não pode ser manipulada;
- corrida de outro passageiro não pode ser usada;
- dinheiro mantém fluxo anterior;
- cartão mantém fluxo anterior;
- motorista sem MP não recebe/aceita oferta Pix;
- motorista com MP revogada não recebe/aceita oferta Pix.

---

## ETAPA 8 — EXPERIÊNCIA DO PASSAGEIRO PIX

### Objetivo

Validar a interface apenas depois que o motor financeiro estiver comprovado.

### Estados obrigatórios

- gerando;
- aguardando;
- analisando;
- pago;
- expirado;
- falhou;
- estornado.

### Testes

- QR;
- Copia e Cola;
- botão copiar;
- “Já paguei”;
- atualizar página;
- fechar/abrir app;
- rede lenta;
- offline;
- retorno da conexão;
- QR expirado não permanece utilizável na UI;
- pagamento aprovado navega corretamente;
- nenhuma informação de outro passageiro/motorista aparece.

---

## ETAPA 9 — EXPERIÊNCIA DO MOTORISTA PIX

### Objetivo

Validar conexão, espera e liberação do motorista.

### Testes

- conta desconectada;
- conta pendente de confirmação;
- conta ativa;
- conta revogada;
- oferta Pix somente para conta elegível;
- aceite;
- aguardando pagamento;
- início bloqueado antes do pagamento;
- início liberado depois do pagamento;
- total/comissão/líquido coerentes;
- nenhum motorista vê dados financeiros privados de outro.

---

## ETAPA 10 — HOMOLOGAÇÃO PONTA A PONTA E LIBERAÇÃO

### Objetivo

Provar o ciclo completo antes de chamar o Pix de pronto.

### Matriz mínima

#### Cenário A

- Motorista A conecta MP A;
- Passageiro solicita corrida Pix;
- A aceita;
- cobrança nasce no MP A;
- comissão Zuvvi é aplicada;
- passageiro vê QR;
- Pix é pago;
- Webhook assinado chega;
- API canônica confirma;
- `pagamentos.status = pago`;
- motorista é liberado;
- corrida inicia e conclui;
- valores conferem.

#### Cenário B

Repetir todo o fluxo com Motorista B + MP B.

#### Segurança cruzada

- A tenta MP B;
- B tenta MP A;
- passageiro A tenta corrida de passageiro B;
- motorista A tenta corrida de motorista B;
- Webhook falso;
- Webhook duplicado;
- callback OAuth reaproveitado;
- token revogado;
- autorização pendente vencida.

#### Falhas financeiras

- expiração;
- rejected;
- high risk controlado;
- cancelamento;
- aprovação tardia;
- refund;
- refund duplicado.

### Transação real controlada

Somente depois da matriz técnica aprovada:

- transação de pequeno valor;
- contas reais controladas;
- conferência no Mercado Pago;
- conferência no Supabase;
- conferência da comissão;
- conferência do líquido do motorista;
- comprovante e IDs reconciliados.

---

## 9. CRITÉRIO DE “PIX 100% PRONTO”

O Pix só recebe status `APROVADO PARA PRODUÇÃO` quando todos os itens abaixo estiverem comprovados:

- OAuth por motorista seguro;
- confirmação explícita antes da ativação;
- nenhuma reconexão silenciosa;
- mesma conta MP não pertence a dois motoristas;
- conta da plataforma não pode ser motorista recebedor;
- token renovável e isolado;
- vendedor correto recebe cobrança;
- `application_fee` comprovada;
- QR e Copia e Cola válidos;
- pelo menos um Pix aprovado real/controlado;
- antifraude sem rejeição artificial causada pela implementação;
- idempotência comprovada;
- Webhook com assinatura;
- Webhook deduplicado;
- consulta canônica;
- corrida bloqueada até pagamento;
- expiração autoritativa;
- aprovação tardia tratada;
- refund real comprovado;
- isolamento passageiro/motorista;
- valores centavo por centavo;
- dinheiro e cartão sem regressão;
- branch integrada com `main` e CI integral aprovado;
- migrations GitHub/Supabase reconciliadas;
- transação real controlada aprovada.

---

## 10. PROTOCOLO DE FALHA

Ao primeiro resultado inesperado:

1. parar a microetapa;
2. não avançar;
3. não fazer segunda correção por tentativa;
4. registrar evidência;
5. identificar causa;
6. comparar com último checkpoint aprovado;
7. criar nova allowlist mínima;
8. corrigir somente a causa;
9. repetir todos os testes afetados;
10. repetir regressão acumulada.

Se rollback de banco puder apagar evidência financeira, rollback destrutivo é proibido. Preferir correção aditiva e desativação lógica.

---

## 11. CHECKPOINT DE CADA ETAPA

Ao aprovar cada etapa, registrar neste documento:

- data;
- SHA da `main`;
- SHA da branch;
- commit(s) da microetapa;
- arquivos alterados;
- migration(s) envolvidas;
- objetos Supabase alterados;
- resultado de testes automatizados;
- resultado do teste manual;
- evidência financeira relevante sem segredos;
- classificação final;
- itens congelados para as próximas etapas.

---

## 12. ESTADO INICIAL DO PLANO V2

- Etapa 0: **EM EXECUÇÃO**;
- Etapa 1: BLOQUEADA pela Etapa 0;
- Etapa 2: BLOQUEADA;
- Etapa 3: BLOQUEADA;
- Etapa 4: BLOQUEADA;
- Etapa 5: BLOQUEADA;
- Etapa 6: BLOQUEADA;
- Etapa 7: BLOQUEADA;
- Etapa 8: BLOQUEADA;
- Etapa 9: BLOQUEADA;
- Etapa 10: BLOQUEADA.

### Microetapa atual

**0.1 — Versionar esta Fonte da Verdade V2 sem alterar código ou banco.**

Somente depois da prova de que este commit alterou exclusivamente este arquivo a microetapa 0.1 poderá ser marcada como `APROVADA`.
