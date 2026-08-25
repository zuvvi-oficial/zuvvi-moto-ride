# Homologação Etapa 2 — OAuth Pix (Branch `feature/pix-100-seguro`)

## Tipo de tarefa
Somente análise. Nenhum arquivo do projeto foi alterado, nenhum commit, deploy, publicação ou alteração de banco.

## Resposta direta

**PREVIEW ISOLADO a partir da branch/commit: IMPOSSÍVEL dentro deste projeto Lovable.**

Não é tecnicamente possível abrir um preview isolado de `feature/pix-100-seguro` / commit `80c605cdf2841f76ce89ae42a3ace271b9394ecf` neste projeto sem afetar a main ou o site publicado. Há dois motivos independentes e concomitantes:

### 1. A branch e o commit não existem neste projeto
Verificado por leitura direta do git deste projeto:
- Remote `origin` é o storage privado gerenciado pelo Lovable (`d981bf4e-…`), **não** o GitHub `zuvvi-oficial/zuvvi-moto-ride`. Não há nenhum remote GitHub conectado.
- `git rev-parse feature/pix-100-seguro` → falha (branch inexistente, local e remota).
- `git cat-file 80c605cdf2841f76ce89ae42a3ace271b9394ecf` → falha (commit inexistente).
- Busca em **todas** as branches (`git log --all`) → commit não encontrado.

Portanto o código da Etapa 2 segura simplesmente não está acessível a partir deste projeto hoje.

### 2. Os arquivos da implementação segura não estão na main
Confirmado por `ls`:
- `src/lib/pix-mercadopago-oauth.functions.ts` → **não existe**
- `src/lib/pix-mercadopago-account.server.ts` → **não existe**
- Existe apenas a implementação antiga: `src/components/motorista/MercadoPagoConnect.tsx`, `src/routes/motorista.mercadopago-callback.tsx` e `src/lib/motorista-pagamento.functions.ts`.

E essa implementação atual **depende de `sessionStorage`** para o OAuth state (confirmado por grep):
- `MercadoPagoConnect.tsx:42` → `window.sessionStorage.setItem('zuvvi_mp_oauth_state', state)`
- `motorista.mercadopago-callback.tsx:38` → `window.sessionStorage.getItem('zuvvi_mp_oauth_state')`

Ou seja, a versão "sem sessionStorage" que você quer homologar está apenas na branch, não na main deste projeto.

### 3. A Fonte da Verdade não está neste projeto
`docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI.md` → **não existe** neste checkout. Ela vive no repositório GitHub `zuvvi-oficial/zuvvi-moto-ride`, que não está conectado aqui.

### 4. Lovable não tem ambiente de preview por branch isolado
Consultada a documentação oficial do Lovable: não há recurso de "preview environment por branch" ou "staging efêmero" que dispense merge/publish. O preview do Lovable reflete o estado corrente do projeto; para colocar código de uma branch no ar é preciso:
- trocar a branch ativa no editor (o que muda o que o preview carrega), e/ou
- publicar (o que **substitui** o deploy publicado atual).

Nenhum dos dois é "isolado" — ambos tocam o mesmo projeto/URL publicado (`zuvvi-moto-ride.lovable.app`). Isso viola suas restrições (não substituir produção, não publicar a branch como produção).

---

## Caminho seguro suportado pelo Lovable

A única forma de homologar a branch sem tocar a produção atual é **isolar em um projeto Lovable separado**:

### Recomendação: novo projeto Lovable dedicado (descartável)
1. Criar um **novo** projeto Lovable vazio.
2. Conectá-lo ao GitHub via *Plus → GitHub → Connect project* e selecionar o repo `zuvvi-oficial/zuvvi-moto-ride`.
3. Trocar a branch ativa desse novo projeto para `feature/pix-100-seguro` (o editor do Lovable permite trocar de branch).
4. Publicar esse novo projeto — ele ganha sua **própria** URL `*.lovable.app`, totalmente independente do `zuvvi-moto-ride.lovable.app` atual.
5. Configurar os secrets necessários **nesse novo projeto** (sem revelar valores): `MERCADOPAGO_CLIENT_ID`, `MERCADOPAGO_CLIENT_SECRET`, `PIX_OAUTH_ENCRYPTION_KEY`.
6. Homologar o fluxo OAuth na URL nova.

**O que isso preserva:**
- Produção atual (`zuvvi-moto-ride.lovable.app`): intacta — é outro projeto.
- main: sem merge.
- Banco/migrations: o novo projeto pode apontar para um Supabase separado de homologação, ou reusar o de produção apenas para leitura do estado OAuth. **Não reaplique** a migration `20260825123937_pix_oauth_safe_disconnect.sql` (já aplicada em produção).

### Alternativa B (menos isolada): trocar de branch neste mesmo projeto
Trocar a branch deste projeto para `feature/pix-100-seguro` carregaria o código no preview, **mas**:
- exigiria conectar o GitHub `zuvvi-oficial/zuvvi-moto-ride` a este projeto (que hoje usa storage Lovable privado);
- publicar substituiria o deploy publicado atual → **viola** "não substituir o site publicado".
- Portanto **não recomendada** para homologação isolada.

### Alternativa C: local
Clonar o repo GitHub, dar checkout na branch e rodar localmente. Útil para inspeção de código, mas o fluxo OAuth completo exige secrets e callback HTTPS — mais trabalhoso que a Recomendação.

---

## Relatório

```text
PREVIEW ISOLADO: impossível (neste projeto)
BRANCH: feature/pix-100-seguro — ausente deste projeto
COMMIT: 80c605cdf2841f76ce89ae42a3ace271b9394ecf — ausente deste projeto
URL DO PREVIEW: n/a (não criada)
PRODUÇÃO ALTERADA: não
ARQUIVOS ALTERADOS: 0
BANCO ALTERADO: não
MERGE REALIZADO: não
FONTE DA VERDADE LIDA: não — docs/pix/FONTE_DA_VERDADE_PIX_ZUVVI.md ausente neste projeto
ARQUIVOS OAuth SEGURO NA MAIN: ausentes (pix-mercadopago-oauth.functions.ts, pix-mercadopago-account.server.ts)
DEPENDÊNCIA DE sessionStorage NA MAIN: sim (fluxo atual ainda usa)
SECRETS NECESSÁRIOS CONFIGURADOS NESTE PROJETO: não verificado nesta tarefa (orçamento: só análise)
PRÓXIMO PASSO SEGURA: criar novo projeto Lovable dedicado, conectá-lo ao GitHub zuvvi-oficial/zuvvi-moto-ride, branch feature/pix-100-seguro, publicar em URL própria e configurar secrets lá
```

## Próximo passo para homologar o OAuth (na URL nova)
No app do motorista, estando offline e sem corrida ativa: tela **Home do Motorista** → bloco "Conta Mercado Pago" → botão **"Conectar conta Mercado Pago"** → seguir o redirect OAuth do Mercado Pago → retornar ao callback → validar state/conta duplicada no servidor.
