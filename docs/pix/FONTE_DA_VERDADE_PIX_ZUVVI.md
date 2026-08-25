# FONTE DA VERDADE — PIX ZUVVI

**Versão:** 1.25
**Data-base:** 25/08/2026
**Responsável pela execução:** Codex  
**Repositório:** `zuvvi-oficial/zuvvi-moto-ride`  
**Commit-base auditado:** `0a014dedc56e947601dea756b5d12cc991be3656`
**Supabase:** projeto `qycblinfvijhfjcmdoof`  
**Status:** planejamento fechado; nenhuma alteração de código ou banco autorizada por este documento isoladamente.

---

## 1. Objetivo único

Deixar o Pix da Zuvvi 100% funcional, seguro, rastreável e com experiência premium, cobrando o passageiro, dividindo automaticamente o valor entre motorista e Zuvvi e confirmando o pagamento antes do início da corrida.

Este trabalho não implementa cartão, não modifica a operação financeira do dinheiro e não refatora áreas que não sejam indispensáveis ao Pix.

---

## 2. Estado real verificado antes da implementação

### Código

- O passageiro já pode selecionar `pix`, `cartao` ou `dinheiro`.
- A corrida cria um registro em `pagamentos` com valor total, valor do motorista e comissão.
- A criação da corrida e do pagamento não é atômica: a corrida pode existir mesmo se o pagamento falhar.
- Existe `criarCobrancaPix`, mas ela não é chamada pela interface do passageiro.
- A cobrança existente usa o Access Token geral da plataforma e não o token OAuth do motorista.
- O motorista conecta/desconecta Mercado Pago, mas o sistema armazena apenas o `user_id` do Mercado Pago.
- Access Token, Refresh Token, validade e escopos do vendedor não são persistidos.
- Corridas Pix são ocultadas da lista de motoristas sem conta conectada, mas o aceite precisa de nova validação obrigatória no servidor/banco.
- A finalização da corrida não fecha o pagamento.

### Supabase

- 100 corridas existentes.
- 83 pagamentos existentes: 79 dinheiro, 3 Pix e 1 cartão.
- Todos os 83 pagamentos estão `pendente`.
- Nenhum pagamento possui `id_transacao_mercadopago`.
- Existem 17 corridas históricas sem registro em `pagamentos`.
- Não existem pagamentos duplicados por corrida atualmente.
- Não existe corrida Pix ativa no momento da auditoria.
- 1 de 4 motoristas possui `conta_mercado_pago_id` preenchida.
- Não há Edge Function, trigger ou função de banco que confirme pagamentos Mercado Pago.
- Não existem estruturas de repasse, conciliação, tentativa Pix ou eventos de Webhook.

Os 17 registros históricos sem pagamento serão preservados. Nenhum backfill ou correção histórica será executado sem uma etapa própria e aprovação explícita.

---

## 3. Decisões de arquitetura — não negociar durante a execução

### 3.1 Modelo financeiro

Será usado **Mercado Pago Marketplace com Split de Pagamentos 1:1 e Checkout Transparente**.

- O motorista é o vendedor/recebedor.
- A cobrança é criada com o Access Token OAuth do motorista.
- A Zuvvi recebe sua comissão por `application_fee`.
- O sistema não fará repasse manual posterior.
- O sistema não movimentará valores por transferência interna improvisada.

Motivo: este é o fluxo oficial do Mercado Pago para uma plataforma que cobra em nome de um vendedor e retém comissão.

### 3.2 Momento da cobrança

A cobrança Pix será criada **depois que um motorista elegível aceitar a corrida**.

Motivo: antes do aceite ainda não se sabe qual conta de motorista receberá o pagamento. Criar o Pix antes obrigaria a plataforma a receber e repassar manualmente, contrariando a arquitetura escolhida.

### 3.3 Momento de início da corrida

- Motorista aceita a corrida.
- A cobrança Pix é criada na conta daquele motorista.
- Passageiro recebe QR Code e Pix Copia e Cola.
- Motorista vê “Aguardando pagamento”.
- A corrida somente pode ser iniciada quando `pagamentos.status = pago`.

### 3.4 Prazo de pagamento

O passageiro terá **5 minutos**, configuráveis pelo servidor, para concluir o Pix após o aceite.

Se o pagamento expirar ou falhar:

- a corrida será cancelada com motivo técnico de pagamento;
- o motorista será liberado;
- o passageiro será informado para solicitar novamente;
- o código Pix antigo não poderá ser reutilizado;
- qualquer aprovação tardia será identificada e tratada por reembolso seguro.

### 3.5 Valor cobrado

O valor Pix será o valor oficial cotado e congelado para a corrida. No fluxo atual, `valor_final` é igual a `valor_estimado`. Alterações dinâmicas de tarifa durante a viagem não fazem parte deste escopo.

---

## 4. Invariantes de segurança

Estas regras devem permanecer verdadeiras em todas as etapas:

1. Nenhum segredo Mercado Pago, token OAuth, Service Role ou chave de criptografia chega ao navegador.
2. Nenhuma cobrança Pix é criada sem motorista atribuído e conta Mercado Pago válida.
3. A conta recebedora deve pertencer ao motorista autenticado que aceitou a corrida.
4. O passageiro só cria/consulta pagamento de corrida própria.
5. O motorista só consulta o estado financeiro das próprias corridas.
6. O Webhook nunca confia somente no corpo recebido; valida assinatura e consulta o estado canônico na API Mercado Pago.
7. Todo evento externo é idempotente: o mesmo Webhook pode chegar várias vezes sem duplicar efeitos.
8. Cada corrida possui um registro financeiro agregado; cada nova tentativa Pix possui identidade própria.
9. No máximo uma tentativa Pix pode produzir pagamento aprovado válido para uma corrida.
10. Corrida Pix não inicia sem pagamento aprovado confirmado no servidor.
11. Desconexão Mercado Pago é bloqueada durante corrida Pix ativa ou obrigação financeira pendente.
12. Cartão e dinheiro não mudam de comportamento por causa das alterações do Pix.
13. Nenhuma migration destrutiva, rename, drop, truncate ou reescrita de dados históricos será aceita.
14. Toda alteração de banco nasce versionada em migration no GitHub e é conferida no catálogo real do Supabase após aplicação.
15. Nenhuma etapa é aprovada apenas por build; precisa de teste funcional e prova no banco.

---

## 5. Estrutura técnica isolada do Pix

Os nomes finais serão confirmados contra o schema antes da migration, mas a responsabilidade das estruturas está congelada.

### 5.1 Credenciais do motorista

Criar armazenamento privado, não exposto à Data API, para:

- `motorista_id` único;
- `mercadopago_user_id`;
- Access Token criptografado;
- Refresh Token criptografado;
- validade do token;
- escopos concedidos;
- data da conexão e última renovação;
- estado da conexão.

Os tokens serão criptografados no servidor com chave exclusiva de ambiente. A tabela pública `motoristas` continuará guardando somente o identificador não secreto necessário à interface.

### 5.2 Pagamento agregado

A tabela `pagamentos` continuará sendo a fonte agregada da corrida:

- `pendente`: aguardando ou processando;
- `pago`: aprovação canônica confirmada;
- `falhou`: rejeitado, cancelado ou expirado, detalhado em campo próprio;
- `estornado`: reembolso/chargeback confirmado.

Não será necessário alterar o enum existente. Um campo de estado detalhado do provedor distinguirá `expired`, `rejected`, `cancelled`, `in_process`, `refunded` e outros retornos oficiais.

### 5.3 Tentativas Pix

Criar tabela isolada de tentativas para permitir retry seguro sem perder histórico:

- pagamento/corrida vinculados;
- motorista recebedor;
- ID Mercado Pago único;
- chave de idempotência única;
- valor total e comissão congelados;
- estado e detalhe do provedor;
- Pix Copia e Cola;
- vencimento;
- datas de criação, aprovação, falha e reembolso.

O QR visual será gerado a partir do Pix Copia e Cola; não será necessário armazenar uma imagem base64 pesada no banco.

### 5.4 Eventos de Webhook

Criar tabela técnica de eventos com:

- identificador/hashes únicos;
- tipo e ação;
- ID externo relacionado;
- horário recebido;
- resultado do processamento;
- número de tentativas;
- erro técnico sanitizado.

O payload completo só será armazenado se a revisão de privacidade concluir que não há dados excessivos. Preferência: guardar somente os campos necessários e um hash verificável.

---

## 6. Fluxo funcional oficial

1. Passageiro seleciona Pix e solicita corrida.
2. Corrida e pagamento agregado são criados atomicamente.
3. Somente motorista com OAuth válido recebe a oferta Pix.
4. O aceite repete a validação dentro da fronteira atômica.
5. Após o aceite, o servidor renova o token OAuth se necessário.
6. O servidor cria a cobrança na conta do motorista com `application_fee` da Zuvvi.
7. Passageiro recebe tela premium com QR, Copia e Cola, contador e estado.
8. Motorista permanece bloqueado em “Aguardando pagamento”.
9. Webhook validado consulta a API Mercado Pago e confirma o estado.
10. Em `approved`, o agregado muda para `pago` e ambos são notificados em tempo real.
11. O servidor permite iniciar a corrida.
12. Ao concluir, o sistema mostra comprovante e registra o fechamento financeiro.
13. Cancelamentos antes do início seguem política de reembolso definida na etapa específica.

---

## 7. Experiência premium obrigatória

### Passageiro

- Tela sem redirecionamento externo.
- QR Code grande e legível.
- Botão “Copiar código Pix”.
- Confirmação visual após copiar.
- Contador de validade.
- Atualização automática e também botão “Já paguei”.
- Recuperação da tela após atualizar/reabrir o aplicativo.
- Estados claros: gerando, aguardando, analisando, pago, expirado, falhou e estornado.
- Mensagens humanas sem expor erro interno.
- Acessibilidade, safe area, teclado e larguras 375/390/768/desktop.

### Motorista

- Situação discreta da conta Mercado Pago.
- Oferta Pix somente com conexão realmente válida.
- Tela “Aguardando pagamento do passageiro”.
- Botão de iniciar corrida bloqueado no servidor e na interface.
- Confirmação forte e estática quando o Pix for aprovado.
- Extrato da corrida: total, taxa Zuvvi e líquido previsto/recebido.

### Administrativo

- Consulta de transações Pix por corrida, passageiro, motorista e ID Mercado Pago.
- Estados pendente, pago, falhou e estornado.
- Valor total, comissão Zuvvi e líquido do motorista.
- Eventos e falhas de Webhook.
- Ações financeiras privilegiadas com confirmação, justificativa e auditoria.
- Nenhum botão administrativo altera pagamento diretamente sem consultar o provedor.

---

## 8. Etapas pequenas, com congelamento e teste

### Etapa 0 — Congelamento e ambiente seguro

**Ações:**

- registrar commit-base, schema, migrations e contagens;
- criar branch Git exclusiva;
- verificar custo/disponibilidade de branch de desenvolvimento Supabase;
- preparar contas de teste Mercado Pago para plataforma, motorista e passageiro;
- cadastrar URLs de callback e Webhook de teste;
- definir segredos necessários sem expor seus valores.

**Aprovação:** nenhuma linha de produção alterada; fonte da verdade versionada; ambiente de teste reproduzível.

**Decisão registrada em 24/08/2026:** a criação de branch paga do Supabase não foi autorizada durante o desenvolvimento. Nenhuma branch cloud será criada e nenhum custo será gerado.

Enquanto essa decisão estiver vigente:

- o Supabase principal será somente leitura durante preparação e desenvolvimento;
- migrations serão criadas e revisadas na branch Git do Pix;
- testes de banco usarão ambiente Supabase local isolado, se os requisitos locais estiverem disponíveis;
- se o ambiente local não puder ser estabelecido com segurança, a etapa de banco permanecerá pausada;
- nenhuma migration será aplicada no projeto principal sem autorização explícita do Rafael na microetapa correspondente;
- aprovação local não será apresentada como prova de produção: antes da liberação final haverá uma homologação controlada no ambiente real autorizado.

**Decisão registrada em 24/08/2026:** Rafael autorizou o uso temporário do GitHub Actions para executar testes do Pix em uma stack Supabase local e descartável, sem conexão de escrita com o projeto principal.

Regras dessa autorização:

- execução somente a partir da branch `feature/pix-100-seguro` e de Pull Request em modo rascunho;
- workflow com permissões somente de leitura do conteúdo;
- Supabase CLI fixada em versão explícita;
- nenhum segredo, senha ou token do Supabase principal será fornecido ao workflow;
- a stack local será descartada ao final;
- nenhum deploy, merge ou aplicação de migration no projeto principal será realizado;
- o workflow, a migration e os testes ficam restritos ao Pix;
- qualquer falha nas migrations preexistentes interrompe a microetapa, sem correção lateral automática.

**Lista de permissão da microetapa 1B:**

- criar `.github/workflows/pix-db-foundation.yml`;
- criar `docs/pix/sql/PIX01_CREDENCIAIS_OAUTH_PRIVADAS.sql.template`;
- criar `supabase/tests/pix_01_oauth_credentials.sql`;
- gerar pela Supabase CLI e, após teste inicial, criar exatamente uma migration `supabase/migrations/<timestamp>_pix_oauth_credentials_private.sql`;
- modificar somente este documento para registrar autorização, evidências e resultado;
- abrir Pull Request em modo rascunho, sem merge.

Todo arquivo, tabela, função e comportamento não listado acima permanece bloqueado.

**Resultado do GitHub Actions — execução 1:**

- Pull Request rascunho: `#2`;
- workflow: `PIX DB Foundation`, execução `32788882306`;
- Docker e Supabase CLI `2.115.0`: aprovados;
- nome gerado oficialmente pela CLI: `20260824232036_pix_oauth_credentials_private.sql`;
- stack local: iniciou a aplicação das migrations do repositório;
- bloqueio: a migration preexistente `20260822044703_4c09eb6a-631d-415e-949a-19286faeaccd.sql` exige a corrida real `2251e1de-f717-452b-ae37-297ebc2ab7de` e exatamente 13 registros históricos, portanto falha corretamente em banco vazio;
- a migration PIX-01 não chegou a ser aplicada;
- os 33 testes PIX não chegaram a executar;
- nenhuma migration Pix foi versionada após a falha;
- nenhuma migration foi aplicada no Supabase principal;
- classificação da Etapa 1B: **BLOQUEADA POR MIGRATION PREEXISTENTE NÃO REPRODUZÍVEL**.

Conferência posterior do Supabase principal:

- última migration continua `20260824222419_unicidade_conta_mercado_pago_motorista`;
- schema `private` continua inexistente;
- funções `pix_oauth_credentials_*` continuam inexistentes;
- durante a execução surgiu uma nova corrida com pagamento Pix pendente, criada às `23:19:33 UTC`, e posteriormente cancelada, sem ID Mercado Pago;
- por isso as contagens operacionais passaram de 100/83/3 para 101 corridas, 84 pagamentos e 4 pagamentos Pix;
- essa mudança de dados ocorreu no aplicativo principal antes do início do workflow e não foi causada pelo GitHub Actions, que não recebeu credenciais do projeto principal.

É proibido corrigir, ignorar, retirar ou fornecer dados artificiais à migration preexistente dentro do escopo Pix. Uma estratégia de teste isolado por fixture mínima de schema só poderá ser criada após nova aprovação explícita e nova allowlist.

**Decisão registrada após a execução 1:** Rafael autorizou explicitamente o teste isolado mínimo da PIX-01.

Allowlist adicional da microetapa 1B-T:

- criar `supabase/tests/fixtures/pix_01_prerequisites.sql` com somente as tabelas e colunas indispensáveis para representar as FKs reais `usuarios -> motoristas`;
- modificar `.github/workflows/pix-db-foundation.yml` para retirar temporariamente do runner todas as migrations preexistentes antes da inicialização da stack descartável;
- aplicar no runner, nesta ordem: fixture mínima, SQL da PIX-01 e teste pgTAP;
- não inserir o fixture em migration, produção, seed oficial ou código do aplicativo;
- não classificar o teste mínimo como homologação do schema completo ou de produção;
- somente versionar a migration PIX-01 depois que os 33 testes e o lint forem aprovados;
- repetir os mesmos testes depois da migration real ser adicionada à branch.

Tudo fora desses dois arquivos adicionais permanece bloqueado. A migration antiga que falhou continuará byte a byte intacta.


**Fechamento da microetapa 1B-T — teste isolado e versionamento da PIX-01:**

- execução `32789697459`: fixture e PIX-01 foram aplicadas; a bateria parou após 28 testes por um literal `integer` no teste não corresponder ao parâmetro `smallint` da função; a migration permaneceu intacta;
- correção limitada a `supabase/tests/pix_01_oauth_credentials.sql`: literal alterado de `1` para `1::smallint`, sem mudança de regra, schema ou implementação;
- execução `32789891510`: migration temporária gerada pela CLI, 33 de 33 testes pgTAP aprovados e lint dos schemas `private,public` sem erros;
- nome definitivo gerado pela Supabase CLI `2.115.0`: `20260824233357_pix_oauth_credentials_private.sql`;
- migration versionada em `supabase/migrations/20260824233357_pix_oauth_credentials_private.sql`, com conteúdo idêntico ao template aprovado;
- execução final `32790067558`: arquivo versionado detectado, 33 de 33 testes aprovados e lint sem erros;
- commit de versionamento: `a03178c0914c08a2a3f068871625e1a78ad694f4`;
- conferência do diff contra o commit-base: somente oito arquivos exclusivos de documentação, teste, workflow e migration Pix; nenhum arquivo do aplicativo ou core foi alterado;
- conferência somente leitura do Supabase principal: última migration `20260824222419`, schema `private` inexistente, zero funções `pix_oauth_credentials_*`, 101 corridas, 84 pagamentos e 4 pagamentos Pix;
- nenhuma credencial do Supabase principal foi usada pelo workflow e nenhuma escrita foi feita em produção.

**Classificação da microetapa 1B-T:** **APROVADA NO AMBIENTE LOCAL DESCARTÁVEL**.

Esta aprovação comprova sintaxe, catálogo, RLS, grants, funções operacionais, revogação e lint da PIX-01 em uma stack isolada. Ela não equivale a homologação nem autoriza aplicação no Supabase principal. A migration permanecerá somente na branch e no Pull Request rascunho até uma autorização explícita posterior.

**Autorização e allowlist da microetapa PIX-02 — tentativas e eventos de Webhook:**

Objetivo único: criar e validar somente a fundação de dados para tentativas Pix e deduplicação de eventos Mercado Pago, sem executar cobrança, receber Webhook HTTP ou alterar comportamento do aplicativo.

Baseline revalidado em 24/08/2026:

- PostgreSQL `17.6`;
- última migration do projeto principal: `20260824222419`;
- `pagamentos` não possui unicidade por corrida nem índice de cobertura na FK `corrida_id`;
- `pagamentos` possui 84 registros e quatro pagamentos vinculados a corridas Pix;
- zero migration PIX-01 aplicada no projeto principal;
- PIX-01 aprovada somente no ambiente descartável;
- changelog oficial revisado: novas tabelas públicas não devem depender de exposição automática à Data API; grants e RLS serão explícitos.

Arquivos permitidos:

- modificar somente `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI.md`;
- criar `.github/workflows/pix-db-attempts.yml`;
- criar `docs/pix/sql/PIX02_TENTATIVAS_EVENTOS_WEBHOOK.sql.template`;
- criar `supabase/tests/fixtures/pix_02_prerequisites.sql`;
- criar `supabase/tests/pix_02_attempts_webhook.sql`;
- após a primeira execução integral aprovada, criar exatamente uma migration `supabase/migrations/<timestamp>_pix_attempts_webhook.sql`, usando o nome gerado pela Supabase CLI `2.115.0`.

Objetos SQL permitidos:

- criar `public.pagamentos_pix_tentativas`;
- criar `private.mercadopago_webhook_eventos`;
- criar somente FKs, checks, índices, RLS e grants necessários a essas duas tabelas;
- reutilizar, sem modificar, `supabase/migrations/20260824233357_pix_oauth_credentials_private.sql` como pré-requisito no runner descartável.

Travas:

- não modificar `public.pagamentos`, `public.corridas`, `public.motoristas` ou qualquer objeto existente;
- não criar função SQL, trigger, Edge Function, endpoint, tela ou Server Function;
- não modificar a PIX-01, aplicativo, core, dinheiro ou cartão;
- não aplicar migration no Supabase principal;
- nenhuma credencial do projeto principal no GitHub Actions;
- nenhuma tentativa de corrigir migrations antigas;
- migration PIX-02 somente será versionada depois de todos os testes e lint passarem;
- após o versionamento, toda a bateria será repetida.

Rollback antes da produção: nenhum, pois a migration permanecerá somente na branch. Rollback da branch: remover apenas os cinco arquivos exclusivos da PIX-02. Rollback futuro de produção será lógico, bloqueando novos usos sem apagar histórico.

**Fechamento da microetapa PIX-02 — tentativas e eventos de Webhook:**

- execução `32790864005`: PIX-01 passou 33/33; PIX-02 executou 34 verificações e parou ao criar motoristas fictícios sem os usuários exigidos pela FK preexistente; nenhuma mudança foi feita na migration;
- correção limitada ao teste `supabase/tests/pix_02_attempts_webhook.sql`: criação dos dois usuários fictícios antes dos motoristas, respeitando a FK real;
- execução `32791031502`: PIX-01 33/33, PIX-02 48/48 e lint sem erros;
- nome definitivo gerado pela Supabase CLI `2.115.0`: `20260824234933_pix_attempts_webhook.sql`;
- migration versionada em `supabase/migrations/20260824234933_pix_attempts_webhook.sql`, com conteúdo idêntico ao template aprovado;
- execução `32791212503`: migration versionada detectada, PIX-01 33/33, PIX-02 48/48 e lint sem erros;
- execução final `32791428176`: PIX-01 33/33, PIX-02 48/48, lint sem erros, Advisor de segurança sem issues e Advisor de performance sem issues;
- commit de versionamento da PIX-02: `1541beeedf02bc5e9ac9746e63f9b1b0d0f2d9a0`;
- as tabelas novas possuem RLS habilitada e forçada, grants mínimos, FKs indexadas, unicidade de idempotência/ID externo, uma única tentativa ativa por pagamento e deduplicação por `event_key`;
- nenhum payload bruto de Webhook é armazenado;
- nenhuma função, trigger, endpoint, tela ou objeto existente foi alterado;
- conferência somente leitura do Supabase principal: última migration `20260824222419`, schema `private` inexistente, tabelas `pagamentos_pix_tentativas` e `mercadopago_webhook_eventos` inexistentes, 101 corridas, 84 pagamentos e quatro pagamentos Pix;
- nenhuma credencial do Supabase principal foi usada e nenhuma escrita foi feita em produção.

**Classificação da microetapa PIX-02:** **APROVADA NO AMBIENTE LOCAL DESCARTÁVEL**.

A aprovação comprova a fundação de dados e a regressão acumulada da PIX-01/PIX-02. Não equivale a homologação, não habilita Pix no aplicativo e não autoriza aplicação no Supabase principal.

**Autorização e allowlist da microetapa PIX-03 — integridade agregada de pagamentos:**

Objetivo único: adicionar somente a integridade mínima do agregado financeiro Pix em `public.pagamentos`, sem criar cobrança, alterar status, modificar registros existentes ou mudar o comportamento do aplicativo.

Baseline revalidado em 25/08/2026:

- última migration do projeto principal: `20260824222419`;
- `pagamentos` possui 84 registros, sendo quatro Pix pendentes;
- zero pagamentos com `id_transacao_mercadopago` preenchido;
- zero duplicidades por `corrida_id`, tanto no conjunto total quanto no recorte Pix;
- zero IDs Mercado Pago duplicados;
- `pagamentos` possui somente o índice da chave primária;
- colunas `pago_at` e `estornado_at` inexistentes;
- migrations PIX-01 e PIX-02 continuam inexistentes no projeto principal e aprovadas somente no ambiente descartável.

Arquivos permitidos:

- modificar somente `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI.md`;
- criar `.github/workflows/pix-db-aggregate-integrity.yml`;
- criar `docs/pix/sql/PIX03_INTEGRIDADE_AGREGADA.sql.template`;
- criar `supabase/tests/fixtures/pix_03_prerequisites.sql`;
- criar `supabase/tests/pix_03_integridade_agregada.sql`;
- após a primeira execução integral aprovada, criar exatamente uma migration `supabase/migrations/<timestamp>_pix_aggregate_integrity.sql`, usando o nome gerado pela Supabase CLI `2.115.0`.

Objetos SQL permitidos:

- adicionar `public.pagamentos.pago_at timestamptz null`;
- adicionar `public.pagamentos.estornado_at timestamptz null`;
- criar índice de cobertura em `pagamentos(corrida_id)`;
- criar índice único parcial em `pagamentos(corrida_id) where meio = 'pix'`;
- criar índice único parcial em `pagamentos(id_transacao_mercadopago) where id_transacao_mercadopago is not null`;
- executar pré-condições somente de leitura que abortem a migration se houver duplicidade incompatível com os índices únicos.

Travas:

- não alterar nenhum registro existente e não fazer backfill;
- não alterar tipo, default, nulabilidade ou valor de nenhuma coluna preexistente;
- não modificar enum, RLS, policy, grant, função, trigger ou FK;
- não modificar migrations, fixtures ou testes PIX-01/PIX-02;
- não alterar aplicativo, core, corrida, cotação, comissão, dinheiro ou cartão;
- não aplicar migration no Supabase principal;
- nenhuma credencial do projeto principal no GitHub Actions;
- migration PIX-03 somente será versionada depois da regressão PIX-01/PIX-02, testes PIX-03, testes negativos de pré-condição, lint e advisors passarem;
- após o versionamento, toda a bateria será repetida.

Rollback antes da produção: nenhum, pois a migration permanecerá somente na branch. Rollback da branch: remover apenas os cinco arquivos exclusivos da PIX-03. Rollback futuro de produção será lógico e aditivo; não apagar colunas ou evidências financeiras.

**Fechamento da microetapa PIX-03 — integridade agregada de pagamentos:**

- execução inicial `32792557853`: PIX-01 33/33, PIX-02 48/48, PIX-03 22/22, dois testes negativos de pré-condição aprovados, lint sem erros e advisors de segurança/performance sem issues;
- nome definitivo gerado pela Supabase CLI `2.115.0`: `20260825001055_pix_aggregate_integrity.sql`;
- migration versionada em `supabase/migrations/20260825001055_pix_aggregate_integrity.sql`, com conteúdo byte a byte idêntico ao template aprovado;
- commit de versionamento da PIX-03: `6a0f2d40c72976116d5c0c8f72d9f85d1a973909`;
- execução final `32792737321`: PIX-01 33/33, PIX-02 48/48, PIX-03 22/22, abortagem por corrida Pix duplicada aprovada, abortagem por ID Mercado Pago duplicado aprovada, lint sem erros e advisors sem issues;
- regressões adicionais `PIX DB Foundation` (`32792737309`) e `PIX DB Attempts and Webhook Events` (`32792737341`) concluídas com sucesso;
- build de produção e TypeScript `--noEmit` executados no commit definitivo com código de saída zero; avisos preexistentes não foram corrigidos por estarem fora do escopo;
- nenhuma linha de aplicativo, enum, RLS, policy, grant, função, trigger, FK, dinheiro ou cartão foi alterada;
- conferência somente leitura do Supabase principal: última migration `20260824222419`, 84 pagamentos, quatro Pix, zero duplicidade de corrida Pix, zero ID externo duplicado, colunas PIX-03 inexistentes e migrations PIX-01/02/03 não aplicadas;
- Pull Request `#2` permaneceu rascunho, sem merge, e o projeto principal permaneceu sem escrita.

**Classificação da microetapa PIX-03:** **APROVADA NO AMBIENTE LOCAL DESCARTÁVEL**.

A aprovação comprova que a migration é aditiva, preserva dados existentes, não interfere em dinheiro/cartão e falha fechada antes de qualquer alteração caso o baseline futuro contenha duplicidade. Não equivale a homologação, não habilita Pix no aplicativo e não autoriza aplicação no Supabase principal.

**Autorização e allowlist da microetapa PIX-04 — estado OAuth de uso único e PKCE:**

Objetivo único: criar somente a fundação de banco para que uma futura integração OAuth Mercado Pago valide o `state` no servidor, aceite cada tentativa uma única vez e guarde o `code_verifier` PKCE apenas como envelope cifrado. Esta microetapa não conecta conta, não troca código por token e não altera o fluxo atual do aplicativo.

Baseline revalidado em 25/08/2026:

- última migration do projeto principal: `20260824222419`;
- schema `private` inexistente no projeto principal;
- tabela `private.mercadopago_oauth_tentativas` inexistente;
- funções `public.pix_oauth_state_create` e `public.pix_oauth_state_consume` inexistentes;
- migrations PIX-01, PIX-02 e PIX-03 continuam inexistentes no projeto principal e aprovadas somente no ambiente descartável;
- o fluxo atual valida `state` apenas no navegador, não usa PKCE e descarta tokens/validade/escopos após a troca do código;
- documentação oficial do Mercado Pago revalidada: `state` deve identificar a mesma solicitação, o código de autorização é único e expira em dez minutos, e PKCE com `S256` usa `code_verifier` entre 43 e 128 caracteres;
- documentação atual do Supabase revalidada para funções com grants explícitos, `search_path` fixo e isolamento de objetos privados.

Arquivos permitidos:

- modificar somente `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI.md`;
- criar `.github/workflows/pix-db-oauth-state.yml`;
- criar `docs/pix/sql/PIX04_OAUTH_STATE_PKCE.sql.template`;
- criar `supabase/tests/pix_04_oauth_state_pkce.sql`;
- após a primeira execução integral aprovada, criar exatamente uma migration `supabase/migrations/<timestamp>_pix_oauth_state_pkce.sql`, usando o nome gerado pela Supabase CLI `2.115.0`.

Objetos SQL permitidos:

- criar somente `private.mercadopago_oauth_tentativas`, vinculada a `public.motoristas`, contendo hash SHA-256 hexadecimal do `state`, envelope cifrado do `code_verifier`, versão da cifra, expiração, consumo e criação;
- criar somente um índice parcial para tentativas ainda não consumidas;
- criar somente `public.pix_oauth_state_create`, `SECURITY INVOKER`, para persistir uma tentativa com validade máxima de dez minutos;
- criar somente `public.pix_oauth_state_consume`, `SECURITY INVOKER`, para consumir atomicamente uma tentativa não vencida e devolvê-la uma única vez;
- habilitar e forçar RLS na nova tabela, revogar acesso de `public`, `anon` e `authenticated` e conceder o mínimo necessário exclusivamente a `service_role`;
- revogar execução das duas funções de `public`, `anon` e `authenticated` e conceder execução exclusivamente a `service_role`.

Travas:

- não armazenar `state` bruto nem `code_verifier` bruto;
- não armazenar Access Token, Refresh Token, segredo OAuth ou credencial real nesta tabela;
- não usar `SECURITY DEFINER`;
- não criar policy permissiva nem conceder acesso ao navegador;
- não alterar qualquer objeto existente, inclusive a tabela privada de credenciais da PIX-01;
- não modificar migrations, fixtures ou testes PIX-01/PIX-02/PIX-03;
- não alterar `src/lib/motorista-pagamento.functions.ts`, `src/components/motorista/MercadoPagoConnect.tsx`, `src/routes/motorista.mercadopago-callback.tsx` ou qualquer arquivo do aplicativo;
- não alterar conexão, callback, desconexão, oferta ou aceite de corrida;
- não alterar core, pagamentos existentes, dinheiro, cartão, suporte, cidades, passageiros ou motoristas;
- não aplicar migration no Supabase principal e não usar credenciais do projeto principal no GitHub Actions;
- migration PIX-04 somente será versionada depois da regressão PIX-01/PIX-02/PIX-03, testes PIX-04, testes de replay/expiração/identidade, lint e advisors passarem;
- após o versionamento, toda a bateria será repetida.

Testes obrigatórios:

- catálogo, PK/FK, constraints, RLS, grants e ACLs das funções;
- criação válida e isolamento por motorista;
- consumo correto uma única vez;
- rejeição de replay, tentativa vencida, hash inválido, versão de cifra inválida e janela acima de dez minutos;
- comprovação de que não existem colunas para `state` bruto ou `code_verifier` bruto;
- regressão integral PIX-01/PIX-02/PIX-03, lint e advisors em banco local descartável.

Rollback antes da produção: nenhum, pois a migration permanecerá somente na branch e no Pull Request rascunho. Rollback da branch: remover apenas os quatro arquivos exclusivos da PIX-04 e a alteração desta fonte da verdade. Rollback futuro de produção será lógico e aditivo; não apagar tentativas nem evidências de segurança.

**Fechamento da microetapa PIX-04 — estado OAuth de uso único e PKCE:**

- execução inicial `32795093870`: PIX-01 33/33, PIX-02 48/48, PIX-03 22/22 e PIX-04 45/45; lint sem erros e advisors de segurança/performance sem issues;
- nome definitivo gerado pela Supabase CLI `2.115.0`: `20260825004851_pix_oauth_state_pkce.sql`;
- migration versionada em `supabase/migrations/20260825004851_pix_oauth_state_pkce.sql`, com conteúdo byte a byte idêntico ao template aprovado;
- commit de versionamento da migration PIX-04: `468a2f655769f2d2f72265740ae38af735a02b71`;
- execução final `32795302534`: migration definitiva detectada, PIX-01 33/33, PIX-02 48/48, PIX-03 22/22 e PIX-04 45/45; lint sem erros e advisors sem issues;
- comprovados isolamento por motorista, consumo atômico único, bloqueio de replay e expiração, rejeição de hash/versão/janela inválidos, RLS forçada, grants mínimos e ausência de colunas de segredo bruto;
- build de produção e TypeScript `--noEmit` executados com código de saída zero; avisos preexistentes não foram corrigidos por estarem fora do escopo;
- nenhum arquivo do aplicativo, callback, conexão, desconexão, corrida, dinheiro, cartão ou core foi alterado;
- conferência final somente leitura do Supabase principal: última migration `20260824222419`, 84 pagamentos, quatro Pix, schema `private` inexistente, objetos PIX-04 inexistentes e migration PIX-04 não aplicada;
- Pull Request `#2` permaneceu rascunho, sem merge, e o projeto principal permaneceu sem escrita.

**Classificação da microetapa PIX-04:** **APROVADA NO AMBIENTE LOCAL DESCARTÁVEL**.

A aprovação comprova somente a fundação de banco para state de uso único e PKCE. O fluxo atual do aplicativo ainda não usa esses objetos; a integração do servidor e do callback será uma microetapa posterior, com allowlist própria e novo ciclo de testes. Esta aprovação não habilita Pix, não aplica migration no Supabase principal e não autoriza merge.

**Autorização e allowlist da microetapa PIX-05 — primitivas criptográficas OAuth no servidor:**

Objetivo único: criar e validar um módulo isolado, exclusivamente de servidor, para gerar `state`, gerar `code_verifier`, calcular `code_challenge` PKCE `S256`, calcular o hash SHA-256 do `state` e cifrar/decifrar envelopes OAuth com AES-256-GCM. Esta microetapa não liga o módulo ao fluxo atual e não altera comportamento do aplicativo.

Baseline revalidado em 25/08/2026:

- commit-base da branch Pix: `0a014dedc56e947601dea756b5d12cc991be3656`;
- Pull Request `#2` permanece rascunho, aberto, sem merge e mesclável;
- build e TypeScript do checkpoint PIX-04 aprovados;
- Supabase principal continua na migration `20260824222419`, sem schema `private` e sem migrations PIX-01/02/03/04;
- implementação atual ainda usa `crypto.randomUUID()` como `state`, valida o estado apenas no navegador, não usa PKCE e não persiste tokens;
- documentação oficial do Mercado Pago revalidada: o processo sensível deve ser gerenciado no servidor; PKCE `S256` é recomendado; o `code_verifier` deve ter 43–128 caracteres; o código de autorização é único e expira em dez minutos;
- changelog atual do Supabase revisado; nenhuma mudança encontrada altera o escopo deste módulo isolado.

Arquivos permitidos:

- modificar somente `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI.md`;
- criar `src/lib/pix-oauth-crypto.server.ts`;
- criar `scripts/pix/pix-oauth-crypto.test.ts`;
- criar `.github/workflows/pix-oauth-crypto.yml`.

Comportamentos permitidos no novo módulo:

- gerar `state` criptograficamente aleatório com 32 bytes e codificação base64url sem padding;
- gerar `code_verifier` criptograficamente aleatório com 64 bytes e codificação base64url sem padding;
- validar `code_verifier` segundo o conjunto de caracteres e comprimento do PKCE;
- calcular `code_challenge` exclusivamente por `BASE64URL(SHA-256(code_verifier))`;
- calcular SHA-256 hexadecimal do `state` sem registrar o valor bruto;
- cifrar segredo com AES-256-GCM, IV aleatório de 96 bits e contexto autenticado versionado;
- decifrar somente envelopes `v1` íntegros e rejeitar chave, versão, formato ou autenticação inválidos com erro sanitizado;
- aceitar a chave de criptografia somente como argumento codificado de exatamente 32 bytes, sem valor padrão e sem persistência.

Travas:

- não ler nem criar segredo real, arquivo `.env`, secret do GitHub, variável no Lovable ou configuração no Supabase;
- não incluir segredo, `state`, verifier ou token em logs, mensagens ou fixtures;
- não usar algoritmo próprio, modo ECB/CBC, IV fixo, chave derivada de texto ou fallback inseguro;
- não importar o módulo no cliente nem remover o sufixo `.server.ts`;
- não modificar `package.json`, `bun.lock`, configuração global, dependências ou Design System;
- não modificar `src/lib/motorista-pagamento.functions.ts`, `src/components/motorista/MercadoPagoConnect.tsx`, `src/routes/motorista.mercadopago-callback.tsx` ou qualquer arquivo existente do aplicativo;
- não modificar banco, migration, RLS, grant, função SQL, Edge Function ou dados;
- não alterar conexão, callback, desconexão, oferta, aceite, cobrança ou estado de corrida;
- não alterar core, dinheiro, cartão, suporte, passageiros, motoristas, cidades ou painel administrativo;
- não aplicar migration no Supabase principal e não fazer merge.

Testes obrigatórios:

- vetor oficial PKCE `S256` do RFC 7636;
- formato, comprimento e não repetição prática de `state` e `code_verifier`;
- hash SHA-256 conhecido e determinístico;
- round-trip AES-256-GCM sem exposição do texto puro;
- IV aleatório produzindo envelopes diferentes para o mesmo texto;
- rejeição de chave incorreta, chave malformada, envelope adulterado, versão desconhecida e verifier inválido;
- TypeScript `--noEmit`, build de produção e diff restrito à allowlist;
- conferência somente leitura de que o Supabase principal permaneceu intacto.

Rollback antes da produção: remover somente os três arquivos novos e reverter esta seção documental. Não existe rollback de banco porque esta microetapa proíbe qualquer escrita no Supabase.

**Fechamento da microetapa PIX-05 — primitivas criptográficas OAuth no servidor:**

- módulo criado em `src/lib/pix-oauth-crypto.server.ts`, sem importação por qualquer arquivo do aplicativo;
- geração de `state` com 32 bytes e `code_verifier` com 64 bytes, ambos aleatórios e em base64url sem padding;
- PKCE implementado exclusivamente com `S256`, comprovado pelo vetor oficial do RFC 7636;
- envelopes `v1` implementados com AES-256-GCM, IV aleatório de 96 bits, tag de 128 bits e contexto autenticado `zuvvi:pix-oauth:v1`;
- nenhuma chave padrão, segredo real, variável de ambiente, log sensível ou dependência foi criada;
- execução local: 11/11 testes criptográficos, ESLint, TypeScript e build aprovados;
- execução GitHub Actions `32796263430`: 11/11 testes, TypeScript integral, build, isolamento do bundle público e `bun.lock` congelado aprovados;
- commit que concluiu os três arquivos novos: `5378254b815d28d8652431ac86766d88e6deb1ea`;
- regressões GitHub Actions aprovadas: PIX-01 `32796263334`, PIX-02 `32796263429`, PIX-03 `32796263342` e PIX-04 `32796263321`;
- nenhum arquivo existente do aplicativo, conexão, callback, banco, migration, dependência, dinheiro, cartão ou core foi alterado;
- conferência final somente leitura do Supabase principal: última migration `20260824222419`, 84 pagamentos, quatro Pix, schema `private` inexistente e migration PIX-04 não aplicada;
- Pull Request `#2` permaneceu rascunho, sem merge e sem escrita no projeto principal.

**Classificação da microetapa PIX-05:** **APROVADA E CONGELADA**.

A aprovação comprova apenas as primitivas criptográficas isoladas. Elas ainda não são chamadas pelo fluxo Mercado Pago, não exigem teste manual no aplicativo e não alteram o comportamento atual. A integração com Server Functions, a migration PIX-04 e o callback permanece bloqueada até uma microetapa posterior com ambiente compatível e allowlist própria.

**Autorização e allowlist da microetapa PIX-06 — cliente OAuth Mercado Pago no servidor:**

Objetivo único: criar e validar um adaptador isolado, exclusivamente de servidor, para montar a URL de autorização com PKCE `S256`, trocar um código de autorização por credenciais OAuth e renovar credenciais pelo `refresh_token`. Esta microetapa não persiste tokens, não usa credencial real, não altera o fluxo atual e não faz requisição ao Mercado Pago durante os testes.

Baseline revalidado em 25/08/2026:

- commit-base da branch Pix: `113479a2f7fc92dabfefcd7a8ce14ebfb12b543e`;
- hashes dos arquivos existentes congelados antes da escrita: `pix-oauth-crypto.server.ts` `ccd9606b...`, `motorista-pagamento.functions.ts` `fcafe924...`, callback `445532b6...`, `package.json` `71b9e8dc...` e `bun.lock` `43a4359a...`;
- documentação oficial do Mercado Pago revalidada: o processo sensível deve permanecer no servidor; a autorização PKCE usa `code_challenge_method=S256`; a troca envia `code_verifier`; o retorno contém Access Token, Refresh Token, `user_id`, `expires_in`, escopo e tipo de token;
- changelog e documentação de segurança atuais do Supabase revisados; nenhuma mudança afeta este adaptador sem banco;
- Supabase principal permanece na migration `20260824222419`, com 84 pagamentos, quatro Pix, sem schema `private` e sem `pix_oauth_state_create`.

Arquivos permitidos:

- modificar somente `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI.md`;
- criar `src/lib/pix-mercadopago-oauth.server.ts`;
- criar `scripts/pix/pix-mercadopago-oauth.test.ts`;
- criar `.github/workflows/pix-mercadopago-oauth.yml`.

Comportamentos permitidos no novo adaptador:

- validar configuração, callback HTTPS, `state`, challenge/verifier PKCE e códigos OAuth;
- montar a URL oficial de autorização sem incluir segredo ou `code_verifier`;
- enviar a troca de código exclusivamente ao endpoint HTTPS fixo do Mercado Pago;
- enviar `code_verifier` no fluxo `authorization_code`;
- renovar credenciais exclusivamente com `grant_type=refresh_token`;
- validar estritamente a resposta antes de disponibilizá-la ao futuro orquestrador;
- limitar tamanho de resposta e tempo de rede;
- retornar erros sanitizados sem token, segredo, payload do provedor ou dados internos;
- aceitar `fetch` e relógio injetáveis apenas para testes isolados, sem fallback de credencial.

Travas:

- não importar nem modificar o adaptador em qualquer arquivo existente do aplicativo;
- não modificar `pix-oauth-crypto.server.ts`, Server Functions atuais, callback, componente Mercado Pago ou telas;
- não ler/criar segredo real, `.env`, secret GitHub/Lovable/Supabase ou credencial Sandbox;
- não registrar URL sensível, código, state, verifier, Access Token, Refresh Token, client secret ou resposta do provedor;
- não modificar banco, migration, RLS, grant, RPC, Edge Function ou dados;
- não alterar conexão, desconexão, oferta, aceite, cobrança ou estado de corrida;
- não alterar `package.json`, `bun.lock`, dependências, dinheiro, cartão ou core;
- não aplicar migration no Supabase principal e não fazer merge.

Testes obrigatórios:

- URL oficial com `state`, callback e PKCE `S256`, provando ausência de segredo e verifier;
- troca de código com corpo exato e resposta válida;
- renovação com rotação de Access Token e Refresh Token;
- normalização segura de `user_id` numérico;
- rejeição de callback inseguro, challenge/verifier inválido e entrada excessiva;
- rejeição de HTTP não aprovado, timeout, resposta grande, JSON inválido, campos ausentes e validade inválida;
- prova de que mensagem de erro não contém segredo nem payload do provedor;
- testes sem acesso de rede real, TypeScript, ESLint, build e diff limitado à allowlist;
- regressão PIX-05 e conferência somente leitura do Supabase principal.

Rollback antes da produção: remover somente os três arquivos novos e reverter esta seção documental. Não existe rollback de banco porque esta microetapa proíbe qualquer escrita no Supabase.

**Fechamento da microetapa PIX-06 — cliente OAuth Mercado Pago no servidor:**

- adaptador criado em `src/lib/pix-mercadopago-oauth.server.ts`, sem importação por qualquer arquivo existente do aplicativo;
- URL de autorização limitada ao endpoint oficial, callback HTTPS estático, `state`, `code_challenge` e método `S256`, sem segredo ou verifier;
- troca de código e renovação limitadas ao endpoint HTTPS fixo do Mercado Pago, com timeout, limite de resposta, validação estrita e erros sanitizados;
- nenhuma credencial real, variável de ambiente, log sensível, chamada de rede real, persistência ou alteração de comportamento foi criada;
- execução local: PIX-06 `10/10`, regressão criptográfica PIX-05 `11/11`, ESLint, TypeScript integral, formatação dos três arquivos novos e build aprovados;
- hashes de `pix-oauth-crypto.server.ts`, `motorista-pagamento.functions.ts`, callback, `package.json` e `bun.lock` permaneceram idênticos ao baseline;
- commit remoto de implementação: `4c9f2803cd99add6484d04e32e3e9ff4781bbda8`;
- a primeira execução remota PIX-06 `32797792713` aprovou código, 21 testes acumulados, ESLint, TypeScript, build e isolamento, mas falhou exclusivamente porque o checkout raso não continha a referência `origin/main` usada pela prova de dependências;
- a correção determinística alterou somente `.github/workflows/pix-mercadopago-oauth.yml`, substituindo a referência Git ausente pela verificação dos hashes congelados de `package.json` e `bun.lock`, no commit `d0dfb157010ac1a7cc19b575730b3918f78f3da5`;
- execução final PIX-06 `32798102533`: 10/10 testes do cliente, regressão PIX-05 11/11, ESLint, TypeScript integral, build, isolamento do bundle público e hashes das dependências aprovados;
- regressões GitHub Actions aprovadas no mesmo commit: PIX-01 `32798102526`, PIX-02 `32798102540`, PIX-03 `32798102528`, PIX-04 `32798102622` e PIX-05 `32798102537`;
- diff remoto permaneceu limitado aos quatro caminhos autorizados: esta Fonte da Verdade, adaptador, teste e workflow exclusivos da PIX-06;
- a Pull Request `#2` permanece aberta em modo draft, sem merge na `main`;
- conferência somente leitura do Supabase principal permaneceu em 84 pagamentos, quatro Pix, sem schema `private`, sem `pix_oauth_state_create` e última migration `20260824222419`; nenhuma escrita foi realizada.

**Classificação da microetapa PIX-06:** **APROVADA E CONGELADA**.

A aprovação comprova somente o cliente OAuth isolado e exclusivamente de servidor. Ele ainda não é importado pelo aplicativo, não persiste credenciais, não usa segredo real, não chama o Mercado Pago em testes e não modifica o comportamento do motorista. A ligação com estado OAuth, criptografia, persistência e callback continua bloqueada até uma microetapa posterior com allowlist própria.

**Autorização e allowlist da microetapa PIX-07R — reconciliação da unicidade da conta Mercado Pago:**

Objetivo único: reconciliar no GitHub a migration histórica `20260824222419_unicidade_conta_mercado_pago_motorista`, que consta como aplicada no Supabase principal, mas está ausente do diretório versionado. Esta microetapa não cria um objeto novo em produção, não reaplica a migration e não integra o OAuth ao aplicativo.

Baseline revalidado em 25/08/2026:

- commit-base da branch Pix: `fd848c6b1119bb7a5b9b7d5009ffb77294ecfb19`;
- `main` remota em `ae6fb274b8e61e4f0619fc2fbe819f282b2f40cd`, já ancestral da branch Pix;
- Supabase principal registra como última migration `20260824222419_unicidade_conta_mercado_pago_motorista`;
- catálogo real contém `public.motoristas.conta_mercado_pago_id` como `text` nullable e o índice único parcial `idx_motoristas_conta_mercado_pago_unica`, aplicado somente quando o valor não é nulo;
- o arquivo `supabase/migrations/20260824222419_unicidade_conta_mercado_pago_motorista.sql` não existe na `main`, na branch Pix ou no histórico Git local;
- Supabase principal permanece com 84 pagamentos e quatro pagamentos Pix; nenhuma escrita foi realizada durante o diagnóstico.

Arquivos permitidos:

- modificar somente `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI.md`;
- criar `supabase/migrations/20260824222419_unicidade_conta_mercado_pago_motorista.sql`;
- criar `supabase/tests/fixtures/pix_07r_prerequisites.sql`;
- criar `supabase/tests/pix_07r_conta_mercado_pago_unica.sql`;
- criar `.github/workflows/pix-db-mercadopago-account-uniqueness.yml`.

Travas:

- não aplicar ou reparar migration no Supabase principal;
- não alterar migrations PIX-01 a PIX-04 já congeladas;
- não modificar banco, dados, RLS, grants, funções, tabelas ou índices de produção;
- não alterar código do aplicativo, Server Functions, callback, componentes, telas ou fluxo OAuth atual;
- não alterar `package.json`, `bun.lock`, dependências, dinheiro, cartão ou core;
- não usar dados reais nos testes, não criar segredo e não fazer merge.

Testes obrigatórios:

- confirmar que a migration versionada cria exatamente um índice único parcial sobre `conta_mercado_pago_id` não nulo;
- permitir múltiplos motoristas com valor nulo e contas Mercado Pago distintas;
- rejeitar a mesma conta Mercado Pago em dois motoristas e comprovar rollback da tentativa duplicada;
- executar a migration e todos os testes em Supabase local descartável, sem credencial do projeto principal;
- repetir pgTAP PIX-01 a PIX-04, PIX-05, PIX-06, lint do banco, advisors, ESLint, TypeScript e build;
- conferir diff remoto limitado à allowlist e repetir a fotografia somente leitura do Supabase principal.

Rollback antes da produção: remover somente os quatro arquivos novos e reverter esta seção documental. Não existe rollback de produção porque nenhuma escrita remota está autorizada.

**Fechamento da microetapa PIX-07R — reconciliação da unicidade da conta Mercado Pago:**

- allowlist registrada antes da implementação no commit `eae24ec55e281ba363a7389ea4a53259863f9cb3`;
- migration histórica recuperada em `supabase/migrations/20260824222419_unicidade_conta_mercado_pago_motorista.sql`, contendo somente o índice único parcial já presente no catálogo real;
- implementação e testes enviados no commit `659a88a1534739f85efb04319fc3a36419d70a07`;
- execução dedicada `32799187019`: PIX-07R 10/10, PIX-01 33/33, PIX-02 48/48, PIX-03 22/22 e PIX-04 45/45 testes pgTAP aprovados;
- a mesma execução repetiu PIX-05 11/11 e PIX-06 10/10, além de lint do schema sem erros, advisors de segurança/performance sem issues, ESLint, TypeScript integral, build e hashes das dependências aprovados;
- regressões independentes aprovadas no mesmo commit: PIX-01 `32799186896`, PIX-02 `32799186906`, PIX-03 `32799186932`, PIX-04 `32799186892`, PIX-05 `32799186921` e PIX-06 `32799186911`;
- diff de implementação limitado aos quatro arquivos novos autorizados; nenhum arquivo existente do aplicativo foi alterado;
- conferência somente leitura do Supabase principal manteve 84 pagamentos, quatro Pix, schema `private` ainda ausente, migration final `20260824222419` e definição idêntica do índice `idx_motoristas_conta_mercado_pago_unica`;
- nenhuma migration, reparo de histórico, DDL, DML ou dado foi executado no Supabase principal;
- a Pull Request `#2` permanece aberta em modo draft, sem merge na `main`.

**Classificação da microetapa PIX-07R:** **APROVADA E CONGELADA**.

A aprovação reconcilia somente o arquivo ausente no GitHub. Ela não cria nova funcionalidade, não modifica o comportamento visível do aplicativo e, por isso, não possui teste manual de tela. A integração OAuth continua bloqueada até nova microetapa com allowlist própria.

**Autorização e allowlist da microetapa PIX-08A-T — prova da conexão OAuth atômica:**

Objetivo único: desenhar e validar, em Supabase local descartável, uma evolução da função `public.pix_oauth_credentials_upsert` para manter na mesma transação a credencial privada criptografada e a projeção pública `motoristas.conta_mercado_pago_id`. Esta microetapa cria somente template, teste e workflow; não versiona nem aplica a migration definitiva e não integra o aplicativo.

Baseline revalidado em 25/08/2026:

- commit-base da branch Pix: `fd81d62595ddabad997fd747b95b2ad86068d432`;
- `main` remota continua ancestral da branch Pix;
- hashes congelados: migration de unicidade `729eef58...`, migration PIX-01 `8c753499...`, `motorista-pagamento.functions.ts` `fcafe924...`, `package.json` `71b9e8dc...` e `bun.lock` `43a4359a...`;
- Supabase principal permanece na migration `20260824222419_unicidade_conta_mercado_pago_motorista`, com 84 pagamentos, quatro Pix, índice público de conta única, sem schema `private` e sem `pix_oauth_credentials_upsert`;
- changelog e documentação atuais do Supabase revisados; nenhuma alteração recente exige ampliar esta prova isolada;
- a função-base PIX-01 é `SECURITY INVOKER`, possui `search_path` fixo e execução revogada de `public`, `anon` e `authenticated`, concedida somente a `service_role`.

Arquivos permitidos:

- modificar somente `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI.md`;
- criar `docs/pix/sql/PIX08_OAUTH_ATOMIC_CONNECTION.sql.template`;
- criar `supabase/tests/pix_08_oauth_atomic_connection.sql`;
- criar `.github/workflows/pix-db-oauth-atomic-connection.yml`.

Comportamento permitido no template:

- substituir somente o corpo da função existente `public.pix_oauth_credentials_upsert`, preservando assinatura, tipo de retorno, `SECURITY INVOKER`, `search_path` e grants;
- normalizar o identificador Mercado Pago uma única vez;
- persistir os envelopes privados e atualizar `public.motoristas.conta_mercado_pago_id` na mesma chamada transacional;
- preservar reconexão, rotação de token, validade, escopo e tipo de token definidos pela PIX-01;
- falhar fechado se motorista não existir, conta Mercado Pago estiver duplicada ou os envelopes forem inválidos;
- garantir rollback integral quando qualquer uma das duas gravações falhar.

Travas:

- não criar nem versionar migration definitiva nesta microetapa; o workflow deve gerar uma migration temporária exclusivamente pela Supabase CLI;
- não aplicar migration, DDL, DML ou reparo no Supabase principal;
- não alterar migrations PIX-01 a PIX-04 nem a migration reconciliada PIX-07R;
- não modificar Server Functions, callback, componentes, telas, autenticação ou fluxo OAuth atual;
- não usar segredo, token, credencial ou dado real;
- não alterar `package.json`, `bun.lock`, dinheiro, cartão ou core e não fazer merge.

Testes obrigatórios:

- conexão inicial grava projeção pública e credencial privada coerentes;
- reconexão/rotação atualiza ambos sem duplicar a linha privada;
- conta Mercado Pago já vinculada a outro motorista é rejeitada;
- falha na unicidade pública reverte a gravação privada intermediária;
- envelope inválido não altera a projeção pública anterior;
- motorista inexistente não cria credencial órfã;
- `anon` e `authenticated` continuam sem execução, enquanto `service_role` mantém apenas o acesso previsto;
- função continua `SECURITY INVOKER`, com `search_path` fixo;
- repetir pgTAP PIX-01 a PIX-04 e PIX-07R, PIX-05, PIX-06, lint, advisors, ESLint, TypeScript, build, hashes e diff da allowlist.

Rollback: remover somente os três arquivos novos e reverter esta seção documental. Não existe rollback de produção porque escrita remota e migration definitiva estão proibidas.

**Fechamento da microetapa PIX-08A-T — prova da conexão OAuth atômica:**

- autorização documental registrada no commit `21f464394a285b663527c1f8e84674d696b27201`;
- template, teste e workflow registrados no commit `cd4d83f5c65489a49e21843970671e50bc7a48e3`;
- a primeira execução dedicada `32800191125` aplicou o template corretamente, mas falhou antes da primeira conexão porque a fixture mínima não reproduzia os grants `SELECT` e `UPDATE` que `service_role` já possui em `public.motoristas` no Supabase principal;
- a causa foi corrigida somente no ambiente descartável: o workflow passou a conceder esses dois privilégios à fixture e o pgTAP passou a verificá-los explicitamente; nenhuma função foi elevada para `SECURITY DEFINER` e nenhum grant foi executado no Supabase principal;
- correção mínima registrada no commit `f9a9a4b6595087f1350bd1ede37c8c334f8aeef3`;
- execução dedicada final `32800937314`: PIX-08A-T 25/25, PIX-01 33/33, PIX-02 48/48, PIX-03 22/22, PIX-04 45/45 e PIX-07R 10/10 testes pgTAP aprovados;
- PIX-05 11/11 e PIX-06 10/10 testes aprovados dentro da execução dedicada; ESLint, TypeScript, build integral, hashes congelados, lint do banco e advisors também aprovados;
- os outros sete workflows da branch finalizaram aprovados; o PIX-05 apresentou uma falha aleatória preexistente em sua primeira tentativa e foi aprovado sem alteração de código ao repetir apenas o job falho;
- a Supabase CLI `2.115.0` gerou no runner o caminho exato `supabase/migrations/20260825021917_pix_oauth_atomic_connection.sql`; o arquivo foi usado apenas durante o teste e ainda não está versionado;
- conferência somente leitura do Supabase principal manteve migration final `20260824222419`, 84 pagamentos, quatro Pix, índice público de conta única, schema `private` ausente e função `pix_oauth_credentials_upsert` ausente;
- nenhuma migration, DDL, DML, segredo, token ou dado foi aplicado ao Supabase principal; aplicativo, callback, Server Functions, dinheiro, cartão e core não foram alterados;
- a Pull Request `#2` permanece aberta em modo draft, sem merge na `main`.

**Classificação da microetapa PIX-08A-T:** **APROVADA EM AMBIENTE DESCARTÁVEL E CONGELADA**.

A próxima microetapa poderá versionar exatamente o conteúdo aprovado no caminho gerado pela CLI, usando `20260825021917_pix_oauth_atomic_connection.sql`, mas continuará proibida de aplicar a migration no Supabase principal sem autorização posterior específica.

**Autorização e allowlist da microetapa PIX-08A-V — versionamento da conexão OAuth atômica:**

Objetivo único: transformar o template aprovado e testado na migration definitiva de código, usando exatamente o nome gerado pela Supabase CLI na execução aprovada. Esta microetapa apenas versiona o SQL e adapta o workflow para testar o arquivo versionado; não aplica a migration no Supabase principal e não integra o aplicativo.

Baseline revalidado em 25/08/2026:

- commit-base da branch Pix: `de8560d9052e871d72254eaf5325f9baec1fb2bb`;
- `main` remota continua ancestral da branch e a Pull Request `#2` permanece draft, aberta e sem merge;
- conteúdo aprovado do template: SHA-256 `03a20534684b268e2e268cad62e745af73688cbd33ec8160965c1ea909ed1750`;
- teste PIX-08A-T congelado: SHA-256 `903995ab41e7bec7bec4288a1e26357837372fb14df9cad883fd407f454b8ab5`;
- `package.json` e `bun.lock` permanecem nos hashes congelados `71b9e8dc...` e `43a4359a...`;
- Supabase principal permanece na migration `20260824222419`, com 84 pagamentos, quatro Pix, sem schema `private` e sem `pix_oauth_credentials_upsert`.

Arquivos permitidos:

- modificar somente `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI.md`;
- criar `supabase/migrations/20260825021917_pix_oauth_atomic_connection.sql`;
- modificar `.github/workflows/pix-db-oauth-atomic-connection.yml` exclusivamente para usar e conferir a migration versionada.

Regras obrigatórias:

- o arquivo versionado deve ser byte a byte idêntico ao template aprovado;
- o workflow deve falhar se o nome exato estiver ausente, se existir outra migration com o mesmo sufixo ou se o conteúdo divergir do template;
- a migration deve continuar sendo aplicada apenas no Supabase local descartável do CI;
- repetir PIX-08A-T, todas as regressões PIX-01 a PIX-07R, PIX-05, PIX-06, lint, advisors, ESLint, TypeScript, build e hashes congelados;
- não alterar função, assinatura, grants, teste pgTAP, template, migrations anteriores ou dependências.

Travas:

- não aplicar migration, DDL, DML ou reparo no Supabase principal;
- não alterar Server Functions, callback, componentes, telas, autenticação ou fluxo OAuth atual;
- não usar segredo, token, credencial ou dado real;
- não alterar dinheiro, cartão ou core e não fazer merge.

Rollback: remover somente a migration nova, restaurar o workflow ao hash `862e981b2feaa1648a97598f0f377d3bc1b98efa31027b1870249bb52a4c8254` e reverter esta seção documental. Não existe rollback de produção porque escrita remota continua proibida.

**Fechamento da microetapa PIX-08A-V — versionamento da conexão OAuth atômica:**

- autorização documental registrada no commit `f2a694b8bd17803ac7240acf4ff90e57437f2c99`;
- migration e adaptação exclusiva do workflow registradas no commit `4fff73d8e22e46c568f737e9f7d9af93ae7e7ac8`;
- `supabase/migrations/20260825021917_pix_oauth_atomic_connection.sql` foi versionada com SHA-256 `03a20534684b268e2e268cad62e745af73688cbd33ec8160965c1ea909ed1750`, idêntico ao template aprovado;
- o diff técnico contém somente a migration nova e o workflow PIX-08A; teste, template, dependências, migrations anteriores e aplicativo permaneceram intactos;
- execução dedicada `32801883550`: PIX-08A 25/25, PIX-01 33/33, PIX-02 48/48, PIX-03 22/22, PIX-04 45/45 e PIX-07R 10/10 testes pgTAP aprovados;
- PIX-05 11/11 e PIX-06 10/10 testes aprovados dentro da execução dedicada; lint do banco, advisors, ESLint, TypeScript, build integral e hashes congelados também aprovados;
- todos os oito workflows acionados pelo commit finalizaram com sucesso, sem repetição ou correção adicional;
- conferência somente leitura do Supabase principal manteve migration final `20260824222419`, 84 pagamentos, quatro Pix, schema `private` ausente e função `pix_oauth_credentials_upsert` ausente;
- nenhuma migration, DDL, DML, segredo, token ou dado foi aplicado ao Supabase principal; core, aplicativo, dinheiro e cartão permaneceram intactos;
- a Pull Request `#2` permanece aberta em modo draft, sem merge na `main`.

**Classificação da microetapa PIX-08A-V:** **APROVADA E CONGELADA NO GITHUB; NÃO APLICADA EM PRODUÇÃO**.

A próxima microetapa deverá receber nova allowlist antes de conectar o fluxo OAuth do servidor à função atômica. A existência da migration no GitHub não autoriza sua aplicação no Supabase principal.

**Autorização e allowlist da microetapa PIX-08B-T — orquestração OAuth isolada no servidor:**

Objetivo único: criar e testar uma camada nova, exclusivamente de servidor, que componha as primitivas já aprovadas de state, PKCE, cliente Mercado Pago, criptografia e persistência atômica. A camada permanecerá desconectada das Server Functions e da interface atuais; portanto, não altera o comportamento do aplicativo nesta microetapa.

Baseline revalidado em 25/08/2026:

- commit-base da branch Pix: `e37be5a740adb99e70f8c57d12d88b7fd4dbf547`;
- `main` remota continua ancestral da branch e a Pull Request `#2` permanece draft, aberta e sem merge;
- hashes congelados: criptografia `ccd9606b...`, cliente OAuth `4b2cf519...`, migration atômica `03a20534...`, workflow PIX-08A `321f3a5b...`, `package.json` `71b9e8dc...` e `bun.lock` `43a4359a...`;
- fluxo atualmente ativo congelado: `motorista-pagamento.functions.ts` no hash `fcafe924...` e callback no hash `445532b6...`;
- Supabase principal permanece na migration `20260824222419`, com 84 pagamentos, quatro Pix, sem schema `private` e sem funções OAuth novas aplicadas.

Arquivos permitidos:

- modificar somente `docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI.md`;
- criar `src/lib/pix-mercadopago-oauth-flow.server.ts`;
- criar `src/lib/pix-mercadopago-oauth-supabase.server.ts`;
- criar `scripts/pix/pix-mercadopago-oauth-flow.test.ts`;
- modificar `.github/workflows/pix-db-oauth-atomic-connection.yml` exclusivamente para incluir os arquivos e testes desta microetapa na regressão integral.

Comportamento permitido:

- início: gerar state e verifier imprevisíveis, derivar PKCE S256, guardar somente hash do state e verifier cifrado com validade máxima de cinco minutos e devolver somente a URL oficial;
- conclusão: validar e consumir state uma única vez por motorista, decifrar o verifier, trocar o code, cifrar Access Token e Refresh Token e chamar exatamente `pix_oauth_credentials_upsert` para persistência atômica;
- adaptador Supabase deve chamar exclusivamente `pix_oauth_state_create`, `pix_oauth_state_consume` e `pix_oauth_credentials_upsert` por cliente de servidor;
- retornar somente dados mínimos e nunca expor state separado, verifier, tokens, chave, erro interno ou resposta bruta do provedor;
- falhar fechado diante de state ausente, expirado, reutilizado ou pertencente a outro motorista, versão de envelope desconhecida, RPC malformado, falha de rede, cifra ou persistência.

Travas:

- não modificar `motorista-pagamento.functions.ts`, `motorista.mercadopago-callback.tsx`, componentes ou rotas;
- não ativar o novo fluxo, não mudar redirect URI e não fazer chamada real ao Mercado Pago;
- não criar migration, não alterar schema, RLS, grants ou tipos gerados;
- não aplicar DDL, DML ou migration no Supabase principal;
- não usar segredo, token, credencial ou dado real;
- não alterar dinheiro, cartão, autenticação geral ou core e não fazer merge.

Testes obrigatórios:

- início persiste hash e envelope, monta PKCE e não devolve state/verifier;
- conclusão consome state uma única vez, troca code com o verifier correto, cifra os dois tokens e chama uma única vez a função atômica com todos os campos validados;
- replay, motorista diferente, expiração, versão desconhecida e respostas RPC vazias/malformadas falham antes de persistir credenciais;
- falhas de provedor, cifra e banco não vazam detalhes nem tokens;
- adaptador comprova os três nomes de RPC e seus argumentos exatos;
- repetir PIX-08A, PIX-01 a PIX-07R, PIX-05, PIX-06, lint, advisors, ESLint, TypeScript, build, hashes e diff da allowlist.

Rollback: remover somente os três arquivos novos de servidor/teste, restaurar o workflow ao hash `321f3a5b410277e75c0f712a93e92a83c71be5e39bce13491eac1109e63de086` e reverter esta seção documental. Não existe rollback de produção porque nenhuma ativação ou escrita remota está autorizada.

### Etapa 1 — Integridade mínima do banco

**Ações:**

- criar migrations somente aditivas;
- garantir um agregado `pagamentos` por corrida para novos registros;
- criar tentativas Pix e eventos de Webhook;
- criar armazenamento privado de credenciais;
- criar índices, constraints e RLS/grants mínimos;
- gerar novamente os tipos TypeScript.

**Teste:** catálogo real, RLS, constraints, duplicidade, rollback lógico, advisors de segurança e performance.

### Etapa 2 — OAuth seguro do motorista

**Ações:**

- trocar state apenas do navegador por state de uso único validado no servidor;
- usar PKCE se suportado no fluxo adotado;
- persistir tokens criptografados e validade;
- implementar renovação e rotação do Refresh Token;
- validar vínculo/desvínculo `mp-connect`;
- bloquear desconexão em situação financeira ativa.

**Teste:** conectar, atualizar página, expirar/renovar token, reconectar, conta duplicada, state inválido, motorista errado e desconexão bloqueada.

### Etapa 3 — Criação financeira atômica

**Ações:**

- corrida + pagamento agregado na mesma transação;
- preservar regras atuais de cotação e comissão;
- corrigir apenas o erro de corrida sem pagamento;
- adicionar idempotência.

**Teste:** duplo toque, falha simulada, rollback integral e nenhuma alteração em dinheiro/cartão.

### Etapa 4 — Cobrança Pix após aceite

**Ações:**

- revalidar conta Mercado Pago no aceite;
- renovar token se necessário;
- criar Pix com Access Token do motorista;
- aplicar `application_fee` da Zuvvi;
- gravar tentativa e identificador externo;
- impedir segunda cobrança concorrente.

**Teste:** motorista conectado, desconectado, token expirado, comissão correta, idempotência e falha de API.

### Etapa 5 — Tela Pix do passageiro

**Ações:**

- QR Code, Copia e Cola, contador, carregamento e retomada;
- estados de falha e expiração;
- notificações claras;
- nenhuma alteração visual fora do fluxo Pix.

**Teste:** 375, 390, 768 e desktop; atualizar página; fechar/abrir PWA; rede lenta; offline e retorno de conexão.

### Etapa 6 — Webhook e confirmação canônica

**Ações:**

- endpoint isolado;
- validação HMAC da assinatura;
- busca do pagamento na API oficial;
- processamento idempotente;
- atualização de tentativa e agregado;
- atualização em tempo real para os dois aplicativos.

**Teste:** Webhook verdadeiro de sandbox, assinatura inválida, duplicado, fora de ordem, atraso, pagamento aprovado, rejeitado e expirado.

### Etapa 7 — Travas da corrida

**Ações:**

- impedir início de corrida Pix não paga no servidor;
- bloquear também a interface do motorista;
- liberar imediatamente após confirmação;
- cancelar com segurança após expiração;
- impedir que código antigo aprove uma corrida reassociada.

**Teste:** chamadas diretas, corrida de outro motorista, corrida de outro passageiro, corrida paga, não paga, expirada e Webhook tardio.

### Etapa 8 — Cancelamento e reembolso

**Ações:**

- full refund antes do início quando a regra permitir;
- reembolso por cancelamento do motorista após pagamento;
- aprovação tardia após cancelamento gera tratamento seguro;
- estado `estornado` somente após confirmação Mercado Pago;
- auditoria de todas as ações.

**Teste:** saldo suficiente/insuficiente do vendedor, repetição de reembolso, falha do provedor e Webhook de estorno.

### Etapa 9 — Extratos e operação financeira Pix

**Ações:**

- comprovante do passageiro;
- líquido e comissão para motorista;
- central administrativa exclusiva de Pix;
- conciliação por ID Mercado Pago;
- fila de pendências técnicas.

**Teste:** dados pertencentes ao usuário correto, filtros, valores exatos, arredondamento e nenhuma exposição cruzada.

### Etapa 10 — Homologação e liberação controlada

**Ações:**

- matriz E2E completa em sandbox;
- build, TypeScript, lint e testes;
- advisors Supabase;
- revisão de secrets e logs;
- pequena transação real controlada;
- liberação gradual por cidade/configuração;
- monitoramento e plano de desligamento rápido do Pix.

**Aprovação final:** nenhum Pix real entra em produção antes de pagamento, split, Webhook, trava de início, reembolso e conciliação estarem comprovados ponta a ponta.

---

## 9. Regra de execução de cada etapa

Cada etapa seguirá obrigatoriamente:

1. leitura da Fonte da Verdade;
2. inspeção do commit e schema atuais;
3. plano exato da microetapa;
4. alteração somente nos arquivos/tabelas declarados;
5. revisão do diff;
6. build e TypeScript;
7. teste técnico;
8. teste visual/funcional;
9. conferência no Supabase real;
10. relatório com arquivos, SQL, resultados e evidências;
11. aprovação explícita;
12. congelamento da etapa antes de avançar.

Se qualquer teste falhar, a próxima etapa não começa. Corrige-se apenas a falha da etapa atual e repete-se a validação.

### 9.1 Regra absoluta de testes em todas as etapas

**Todas as etapas, sem exceção, serão testadas antes de serem aprovadas.** Relatório de implementação, build aprovado ou declaração de sucesso não substituem teste real.

Cada microetapa terá quatro níveis obrigatórios de validação:

1. **Teste técnico pelo Codex:** revisão do diff, build, TypeScript, testes automatizados aplicáveis, logs e ausência de alterações fora do escopo.
2. **Teste do Supabase:** conferência do schema, migration, constraints, RLS, dados gravados e efeitos reais da operação, sempre com consultas de validação não destrutivas.
3. **Teste ponta a ponta:** executar o fluxo real entre passageiro, motorista, administrativo e Mercado Pago Sandbox conforme a função construída na etapa.
4. **Teste prático pelo Rafael:** o Rafael receberá instruções detalhadas dizendo exatamente em qual aplicativo entrar, onde tocar, qual resultado esperar e quais imagens ou mensagens enviar.

Ao final de cada etapa, o resultado será classificado como:

- **APROVADA:** todos os testes passaram, as evidências conferem e a etapa pode ser congelada.
- **PARCIALMENTE APROVADA:** uma parte passou, mas existe pendência que impede o avanço.
- **REPROVADA:** houve erro funcional, visual, de segurança, banco ou regressão.

Quando uma etapa for parcialmente aprovada ou reprovada:

- nenhuma etapa seguinte começa;
- a correção fica limitada à causa comprovada;
- o core e as áreas funcionais continuam congelados;
- todos os testes afetados são repetidos;
- a etapa somente muda para APROVADA depois da nova prova.

Também haverá um teste de regressão crescente: a cada etapa nova, serão repetidos os testes essenciais das etapas Pix anteriores, garantindo que uma melhoria nova não quebre o que já havia sido aprovado.

---

## 10. Limites de alteração

### 10.0 Política de trava absoluta — bloqueado por padrão

O projeto inteiro é considerado **congelado por padrão**. Uma microetapa só pode alterar aquilo que estiver nominalmente incluído em uma lista de permissão produzida antes do primeiro comando de escrita.

Antes de cada microetapa, o Codex deverá registrar:

- arquivos que podem ser criados;
- arquivos existentes que podem ser modificados;
- funções e componentes exatos que podem receber alteração;
- tabelas, colunas, índices, políticas ou funções SQL permitidos;
- comportamento Pix que será alterado;
- testes e regressões obrigatórios;
- forma de rollback.

Tudo o que não estiver nessa lista estará automaticamente proibido.

Se durante a execução aparecer necessidade de tocar em outro arquivo, função, tabela, política ou comportamento:

1. a execução para imediatamente;
2. nenhuma correção lateral é feita;
3. a necessidade é explicada e tecnicamente comprovada;
4. a Fonte da Verdade recebe uma nova versão;
5. somente depois de aprovação a lista pode ser ampliada.

### 10.1 Trava do core

O core funcional da Zuvvi permanecerá congelado. Isso inclui autenticação, perfis, GPS, mapas, cálculo de rota, cotação, matching, ciclo geral de corrida, suporte, chat, cidades, documentos, aprovação, notificações gerais e os meios dinheiro/cartão.

Quando o Pix precisar obrigatoriamente se conectar a um ponto do core — por exemplo, aceite ou início da corrida — aplica-se a regra de **gancho mínimo**:

- modificar somente a condição exclusiva de `forma_pagamento = 'pix'`;
- preservar byte a byte, sempre que tecnicamente possível, a lógica dos demais meios e estados;
- não reorganizar, renomear ou refatorar o arquivo;
- não aproveitar a etapa para corrigir outro problema;
- não aplicar formatação no arquivo inteiro;
- mostrar no relatório o trecho anterior e o trecho posterior;
- repetir os testes de dinheiro, cartão e corrida normal para provar ausência de regressão.

Se for possível resolver de forma segura por módulo Pix isolado, wrapper ou componente novo, essa opção terá preferência sobre alterar uma função central existente. Não será duplicada lógica crítica apenas para evitar tocar em um ponto de integração necessário.

### 10.2 Trava automática do GitHub

- Toda microetapa usa branch própria ou branch Pix controlada; nenhuma escrita direta silenciosa na `main`.
- Antes da alteração, serão registrados commit-base, `git status` e hashes dos arquivos permitidos.
- Depois da alteração, o diff será conferido por caminho e conteúdo.
- Arquivo alterado fora da lista permitida reprova automaticamente a etapa.
- Mudança gerada automaticamente só será aceita quando inevitável e declarada previamente.
- `package.json` e lockfile ficam congelados; nova dependência exige justificativa e atualização prévia desta Fonte da Verdade.
- Não serão incluídos arquivos temporários, segredos, dumps com dados pessoais ou instruções residuais.
- Merge somente após testes, relatório do diff e aprovação da microetapa.

### 10.3 Trava automática do Supabase

- Produção não receberá DDL manual sem migration correspondente no GitHub.
- Toda migration será aditiva, pequena, nomeada e exclusiva do Pix.
- São proibidos `DROP`, `TRUNCATE`, renomeação destrutiva, alteração em massa e exclusão de dados históricos.
- Tabelas e RLS sem relação direta com Pix ficam intocáveis.
- Enum central não será alterado se o mesmo resultado puder ser obtido por campo detalhado isolado.
- Funções privilegiadas ficam em schema não exposto, com `search_path` fixo, grants mínimos e validação explícita de identidade.
- Nenhuma tabela nova em schema exposto ficará sem RLS e grants revisados.
- A Service Role nunca será enviada ao cliente.
- Após cada migration: catálogo real, policies, grants, constraints, advisors, contagens e rollback lógico serão verificados.
- Divergência entre migration do GitHub e schema real reprova a etapa e bloqueia o avanço.

### 10.4 Proibições expressas

Durante o projeto Pix, fica proibido:

- mexer em tela, texto ou estilo sem ligação direta com a microetapa Pix;
- corrigir erro encontrado fora do escopo;
- refatorar “para melhorar o código”;
- trocar bibliotecas ou arquitetura global;
- alterar autenticação ou autorização geral;
- mudar regra de dinheiro ou cartão;
- alterar comissão, tarifa ou cálculo de corrida;
- executar migration não registrada;
- modificar dados históricos para fazer um teste passar;
- usar dados fictícios como prova de funcionamento real;
- declarar uma etapa pronta apenas com base em build ou resposta textual.

Qualquer uma dessas ocorrências classifica a etapa como **REPROVADA**, mesmo que a funcionalidade Pix aparente funcionar.

### Permitido

- arquivos de pagamento/Pix e Mercado Pago;
- componentes Pix exclusivos;
- pontos mínimos das telas de passageiro e motorista necessários para exibir/bloquear o Pix;
- migrations aditivas exclusivas de Pix;
- Edge Function/endpoint exclusivo de Webhook;
- notificações exclusivas de estado Pix;
- tela administrativa exclusiva de Pix.

### Congelado

- autenticação geral, salvo o callback OAuth Mercado Pago estritamente necessário;
- cotação, GPS, mapa e geolocalização;
- matching e elegibilidade, exceto a condição adicional exclusiva de Pix;
- suporte/chat;
- aprovação e documentos de motorista;
- cidades e tarifas, exceto leitura da comissão existente;
- corridas em dinheiro e cartão;
- identidade visual global;
- RLS e tabelas sem relação direta com Pix;
- painel administrativo fora da área financeira Pix.

Qualquer necessidade fora desta lista interrompe a etapa e exige atualização versionada desta Fonte da Verdade antes de qualquer ação.

---

## 11. Rollback e recuperação

- Código sempre em branch e PR; nunca alteração direta silenciosa na `main`.
- Migration sempre versionada antes de aplicação definitiva.
- Estruturas novas começam sem substituir o fluxo atual.
- Feature flag permite desligar o Pix sem desligar dinheiro/cartão.
- Webhook pode ser colocado em modo “registrar sem executar” durante homologação.
- Mudanças de dados são aditivas; rollback preferencialmente desativa comportamento sem apagar histórico.
- Nenhum token ou segredo aparece em logs, relatórios, commits ou respostas.

### 11.1 Protocolo antierro — parar antes de quebrar

Não existe promessa técnica honesta de risco zero. A garantia operacional deste projeto será **falhar fechado**: diante de risco não controlado, dúvida relevante ou evidência de regressão, nenhuma alteração é promovida e o sistema permanece no último estado aprovado.

Antes de qualquer escrita, toda microetapa passará pelos seguintes portões:

1. **Portão de dependências:** mapear quem chama, quem consome e quais telas/tabelas podem ser afetadas.
2. **Portão de risco:** classificar a mudança como baixa, média ou alta e listar falhas possíveis.
3. **Portão de isolamento:** comprovar que a solução pode ser limitada ao Pix; caso contrário, parar.
4. **Portão de recuperação:** definir previamente como desativar ou reverter sem perder dados.
5. **Portão de baseline:** registrar código, schema, contagens e testes do último estado aprovado.
6. **Portão de escopo:** confirmar que o diff planejado cabe integralmente na allowlist da etapa.
7. **Portão de homologação:** executar primeiro em ambiente/credenciais de teste sempre que houver efeito financeiro.

Se a análise indicar possibilidade concreta de quebrar funcionalidade já operacional e não houver isolamento confiável:

- a mudança não será executada;
- será procurado um contorno por módulo isolado, feature flag, wrapper ou operação aditiva;
- se o contorno ainda trouxer risco relevante, a etapa será pausada;
- o problema e as alternativas serão apresentados ao Rafael antes de ampliar o escopo.

### 11.2 Ponto de restauração obrigatório

Toda etapa começa a partir de um checkpoint aprovado contendo:

- commit/SHA do GitHub;
- lista e hash dos arquivos envolvidos;
- versão das migrations aplicadas;
- fotografia estrutural das tabelas e policies afetadas;
- contagens de controle sem dados pessoais;
- resultado dos testes essenciais;
- estado da feature flag Pix.

Esse checkpoint é o destino de recuperação caso a etapa apresente regressão.

### 11.3 Procedimento quando algo falhar

Ao primeiro sinal de quebra, comportamento inesperado ou divergência:

1. parar imediatamente a execução;
2. não iniciar outra etapa;
3. não fazer correções em cascata;
4. desativar o comportamento novo pela feature flag, quando aplicável;
5. restaurar o código ao último checkpoint aprovado;
6. aplicar rollback lógico da migration somente se necessário e previamente seguro;
7. testar novamente as funcionalidades que já estavam aprovadas;
8. comprovar que GitHub e Supabase voltaram a um estado coerente;
9. registrar causa, impacto e ponto exato da interrupção;
10. desenhar uma solução isolada;
11. retomar **a mesma microetapa**, do ponto seguro, sem pular adiante.

Se a recuperação de banco puder causar perda de dados, o rollback destrutivo é proibido. Nesse caso, mantém-se a estrutura aditiva, desativa-se o comportamento e corrige-se por migration posterior versionada.

### 11.4 Regra de retomada

Após uma falha, o trabalho não recomeça do zero e não avança para outra funcionalidade. A retomada acontece exatamente na etapa interrompida, usando:

- a última evidência aprovada;
- a causa comprovada da falha;
- uma nova allowlist mínima;
- testes específicos da correção;
- repetição de toda a regressão acumulada.

Somente depois de recuperar, corrigir e aprovar a etapa interrompida o cronograma continua.

### 11.5 Mudança mínima por vez

Para facilitar diagnóstico e recuperação:

- cada microetapa terá um único objetivo observável;
- banco, servidor e interface serão separados quando puderem ser testados isoladamente;
- nenhuma PR misturará fundação, tela, Webhook e reembolso;
- nenhuma etapa terá duas mudanças de regra financeira independentes;
- qualquer resultado não previsto será tratado como falha, não como “melhoria adicional”.

---

## 12. Critério de “Pix 100% pronto”

O Pix só será declarado pronto quando todos os itens abaixo forem comprovados:

- motorista conecta conta com OAuth seguro e token renovável;
- motorista desconectado não recebe nem aceita corrida Pix;
- cobrança nasce na conta do motorista correto;
- comissão Zuvvi é aplicada pelo split oficial;
- passageiro vê QR e Copia e Cola e retoma a tela após atualização;
- Webhook assinado confirma o estado canônico;
- duplicidade e eventos fora de ordem não causam efeito duplo;
- corrida não inicia sem pagamento aprovado;
- cancelamento/reembolso funcionam e são auditáveis;
- passageiro, motorista e admin veem apenas os dados permitidos;
- extrato e conciliação batem centavo por centavo;
- testes sandbox e transação real controlada foram aprovados;
- dinheiro, cartão e restante do core continuam funcionando sem regressão.

---

## 13. Referências oficiais

- Mercado Pago — Split 1:1 Marketplace: https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace
- Mercado Pago — Renovar Access Token: https://www.mercadopago.com.br/developers/pt/docs/security/oauth/renewal
- Mercado Pago — Webhooks: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/notifications/webhooks
- Supabase — Segurança da Data API: https://supabase.com/docs/guides/api/securing-your-api
- Supabase — Segurança do produto: https://supabase.com/docs/guides/security/product-security
