# ZUVVI — DOCUMENTO DA VERDADE — PROFISSIONALIZAÇÃO CONTROLADA

**Projeto:** Zuvvi  
**Escopo desta fase:** Passageiro + Motorista  
**Início:** 06/09/2026  
**Baseline funcional inicial da `main`:** `6d094971c09c266e6ea969751f83d76e411ff8b0`  
**Status geral:** EM EXECUÇÃO CONTROLADA  

> Este arquivo é a fonte operacional da fase de profissionalização. O arquivo `ZUVVI-FECHAMENTO-CONTROLE.md` continua sendo o histórico técnico anterior e não deve ser reescrito ou descartado. Em caso de conflito, parar, auditar a `main` e o banco real e registrar a divergência antes de alterar qualquer coisa.

---

## 1. Regra máxima desta fase

O aplicativo que já funciona é considerado **CORE CONGELADO**.

Nenhuma melhoria visual, de produto ou de conveniência autoriza alterar comportamento funcional já aprovado fora do escopo da microetapa atual.

Fluxo obrigatório de toda microetapa:

**AUDITORIA ANTES → ALTERAÇÃO ISOLADA → AUDITORIA DE DIFF → BUILD/CHECKS DISPONÍVEIS → TESTE MANUAL → CONTRA-PROVA → FECHAMENTO → PRÓXIMA ETAPA**

Se o teste falhar:

**FALHOU → NÃO AVANÇA → CORRIGE A MESMA MICROETAPA → TESTA NOVAMENTE.**

---

## 2. Regras que nunca podem ser puladas

1. Uma microetapa por vez.
2. Antes de qualquer alteração, confirmar o SHA atual da `main`.
3. Toda branch deve nascer da `main` auditada.
4. O escopo deve listar explicitamente os arquivos e comportamentos permitidos.
5. Tudo que não estiver autorizado fica proibido.
6. Se surgir necessidade de mexer fora do escopo, **abortar e reportar** antes de implementar.
7. Nunca misturar correção funcional com limpeza, refactor ou melhoria visual não relacionada.
8. Supabase, migrations, RLS, pagamentos e autenticação só podem ser tocados se a microetapa declarar isso expressamente.
9. Nunca executar migration de produção como efeito colateral de uma etapa visual.
10. Nunca alterar fluxo de corrida ativa para “aproveitar” uma mudança de interface.
11. Antes do merge, comparar `main` × branch e confirmar exatamente os arquivos alterados.
12. Se a `main` mudar enquanto a etapa estiver em andamento, reauditar antes do merge.
13. Merge sempre travado pelo SHA esperado do head quando a ferramenta permitir.
14. Depois do merge, confirmar o novo SHA da `main`.
15. Publicação/preview não equivale a aprovação: o teste manual continua obrigatório.
16. Só marcar uma etapa como **FECHADA** depois do teste aprovado.
17. Branch já mesclada pode ser apagada depois da confirmação da `main`; PR mesclado permanece como histórico.
18. Qualquer defeito descoberto fora do escopo entra na fila; não é corrigido escondido na etapa atual.
19. Em telas de corrida crítica, a navegação deve priorizar segurança do estado da corrida, não conveniência visual.
20. Nunca declarar “funciona” sem distinguir o que foi comprovado em código, banco, build e teste manual.

---

## 3. Estados oficiais de uma microetapa

- `AGUARDANDO` — ainda não iniciada.
- `EM AUDITORIA` — diagnóstico em andamento; nenhuma alteração autorizada ainda.
- `IMPLEMENTADA / TESTE PENDENTE` — código pronto, mas ainda não aprovado pelo teste manual.
- `FALHOU NO TESTE` — permanece na mesma etapa até correção.
- `APROVADA / PRONTA PARA MERGE` — teste aprovado e contra-prova concluída.
- `FECHADA` — merge confirmado na `main`, publicação/teste final aprovado e evidência registrada.
- `BLOQUEADA` — existe dependência externa ou risco que impede avanço seguro.

---

## 4. CORE CONGELADO

Enquanto uma etapa não autorizar expressamente, é proibido alterar:

- máquina de estados da corrida;
- criação/aceite/atribuição de corrida;
- unicidade de corrida ativa;
- ownership/autorização de passageiro e motorista;
- GPS e rastreamento vivo;
- Mapbox e rotas críticas;
- autenticação e roteamento por perfil;
- onboarding e aprovação do motorista;
- RLS, policies, triggers e migrations;
- Pix, Mercado Pago, OAuth, webhook e antifraude;
- liquidação financeira, comissão e valores da corrida;
- chat e notificações críticas;
- suporte/SOS;
- arquivos `.env`, dependências e lockfile;
- workflows/CI, salvo microetapa específica.

---

## 5. Baseline funcional desta fase

Na abertura deste plano, a `main` é considerada funcional em:

- autenticação e separação passageiro/motorista;
- Home do Passageiro;
- busca de origem/destino;
- favoritos e recentes;
- cotação e solicitação de corrida;
- procura de motorista;
- acompanhamento da corrida;
- rastreamento do motorista;
- código de embarque;
- chat;
- avaliação;
- histórico de corridas;
- resumo de carteira;
- perfil do passageiro;
- navegação inferior persistente do passageiro nas abas principais;
- Home do Motorista e estados operacionais já aprovados;
- Perfil do Motorista;
- integração existente com Mercado Pago;
- PWA com atualização controlada para não interromper corrida ativa.

Esta lista significa **preservar o comportamento atual**, não que todas essas áreas estejam perfeitas ou sem pendências de profissionalização.

---

## 6. Plano oficial — ordem obrigatória

### P0 — Documento da Verdade da profissionalização
**Status:** FECHADA

Objetivo:
- criar esta fonte operacional;
- registrar ordem, travas, critérios e protocolo de teste;
- impedir avanço desordenado.

Alteração permitida:
- documentação apenas.

Teste:
- confirmar que nenhum arquivo funcional foi alterado.

---

### P1 — Disponibilidade da cidade pela localização real do passageiro
**Status:** AGUARDANDO — PRÓXIMA ETAPA OFICIAL

Problema auditado:
- a Home envia coordenadas GPS para a verificação de disponibilidade;
- a implementação atual decide a disponibilidade principalmente pela cidade cadastrada do usuário;
- isso pode produzir resposta errada quando o passageiro estiver fisicamente em outra cidade.

Objetivo:
- a disponibilidade operacional deve refletir a localização real usada como origem, preservando as regras de cidade ativa/piloto.

Travas:
- não alterar criação de corrida;
- não alterar tarifa;
- não alterar GPS do motorista;
- não alterar Mapbox de acompanhamento;
- não alterar banco sem auditoria e necessidade comprovada;
- não alterar onboarding/cidade cadastrada do usuário.

Teste manual obrigatório:
1. passageiro em cidade liberada → Home permite escolher destino;
2. passageiro em cidade não liberada → Home bloqueia solicitação e informa indisponibilidade;
3. origem manual em cidade liberada → comportamento coerente com a origem selecionada;
4. origem manual em cidade não liberada → não permitir corrida fora da operação;
5. GPS negado → fluxo de erro atual continua funcional;
6. login, Corridas, Carteira e Perfil continuam abrindo normalmente.

Critério de fechamento:
- todos os testes acima aprovados.

---

### P2 — Forma de pagamento “Cartão”: regra de produto e interface sem ambiguidade
**Status:** AGUARDANDO

Problema auditado:
- a confirmação de corrida oferece Pix, Cartão e Dinheiro;
- existe fluxo específico de Pix;
- deve ficar explícito se “Cartão” significa maquininha do motorista ou pagamento dentro do app.

Objetivo:
- definir uma única regra de produto e refletir essa regra em toda a UI e backend, sem inventar cobrança inexistente.

Primeiro passo obrigatório:
- decisão de produto antes de codar.

Teste manual dependerá da decisão adotada.

---

### P3 — Hardening crítico de criação/cotação sem alterar experiência aprovada
**Status:** AGUARDANDO

Itens já identificados para auditoria individual:
- geração segura do código de embarque;
- eliminar fallback inseguro de segredo da assinatura de cotação;
- revisar qualquer hardening pendente existente em branches/PRs antigos antes de reaproveitar código.

Regra especial:
- PRs antigos e grandes **não podem ser mesclados em bloco** apenas porque contêm uma correção desejada;
- cada correção será extraída/auditada em microetapa própria.

Teste mínimo:
- corrida em dinheiro ponta a ponta;
- corrida Pix até o ponto permitido pelo ambiente de teste;
- código de embarque correto/incorreto;
- tentativa de duplicidade;
- retomada de corrida ativa.

---

### P4 — Detalhes da corrida + recibo
**Status:** AGUARDANDO

Objetivo profissional:
- tocar numa corrida do histórico e abrir detalhes completos.

Conteúdo esperado:
- data e horário;
- origem e destino;
- motorista e veículo quando aplicável;
- forma de pagamento;
- valor;
- status;
- distância/duração quando dados confiáveis existirem;
- recibo/comprovante quando aplicável;
- acesso a suporte relacionado à corrida;
- ação “Chamar novamente” somente se puder reutilizar destino sem criar corrida automaticamente.

Trava:
- histórico é leitura; não alterar corrida passada.

---

### P5 — Carteira do Passageiro profissional
**Status:** AGUARDANDO

Objetivo:
- transformar o resumo atual em uma experiência financeira clara.

Escopo candidato, sujeito a auditoria antes de implementar:
- gastos por mês;
- filtros de período;
- lista de transações/corridas;
- separação por forma de pagamento;
- acesso a recibos;
- estados vazio/erro com “Tentar novamente”.

Regra:
- não chamar de saldo/crédito se não existir saldo real no banco.

---

### P6 — Perfil do Passageiro profissional
**Status:** AGUARDANDO

Objetivo candidato:
- nome;
- telefone;
- e-mail;
- cidade;
- CPF confirmado;
- foto/avatar, se houver infraestrutura segura;
- suporte;
- privacidade/termos;
- gerenciamento de sessão;
- exclusão de conta somente após desenho técnico/jurídico específico.

Trava:
- CPF confirmado continua protegido contra troca indevida.

---

### P7 — Ganhos do Motorista
**Status:** AGUARDANDO

Problema auditado:
- a navegação do motorista mostra “Ganhos”, mas a opção está desabilitada.

Objetivo profissional:
- criar a área de ganhos com dados reais e reconciliáveis.

Escopo candidato:
- hoje/semana/mês;
- quantidade de corridas;
- valor bruto;
- comissão Zuvvi;
- líquido do motorista;
- formas de pagamento;
- histórico por corrida;
- situação do recebimento quando houver fonte confiável.

Trava financeira máxima:
- não inventar saldo;
- não somar registros pendentes como recebidos;
- valores devem vir da fonte financeira correta;
- qualquer mudança em Pix/Mercado Pago exige microetapa própria.

---

### P8 — Perfil do Motorista profissional
**Status:** AGUARDANDO

Objetivo candidato:
- nome e status;
- avaliação média e total de corridas;
- veículo atual;
- situação de documentos/CNH;
- recebimentos/Mercado Pago;
- suporte;
- sessão;
- remover redundâncias visuais somente depois de confirmar navegação persistente e segura.

---

### P9 — Consistência visual e arquitetural
**Status:** AGUARDANDO

Objetivo:
- unificar componentes repetidos somente depois dos fluxos estarem aprovados.

Exemplos candidatos:
- navegação compartilhada;
- cabeçalhos;
- loading/error/empty states;
- espaçamento e safe areas;
- acessibilidade;
- feedback de botões;
- consistência de ícones e textos.

Regra:
- nenhuma refatoração ampla antes das etapas funcionais.

---

### P10 — Regressão profissional final Passageiro + Motorista
**Status:** AGUARDANDO

Só iniciar quando P1–P9 estiverem FECHADAS ou formalmente removidas do escopo.

Checklist final mínimo:
- cadastro comum;
- cadastro Google;
- logout/login;
- passageiro Home/Corridas/Carteira/Perfil;
- favoritos/recentes;
- GPS e origem manual;
- cotação;
- dinheiro;
- Pix;
- cartão conforme regra final de P2;
- busca/timeout;
- aceite;
- motorista a caminho;
- chegou;
- código de embarque;
- corrida em andamento;
- finalização;
- avaliação;
- chat;
- notificações;
- cancelamentos permitidos;
- retomada após fechar/reabrir o app;
- motorista online/offline;
- ganhos;
- perfil motorista;
- PWA/update;
- teste em celular real.

---

## 7. Protocolo obrigatório de cada PR

Antes de abrir PR:
- registrar baseline da `main`;
- branch com nome específico da microetapa;
- limitar diff ao escopo.

Antes de merge:
- `main` não pode ter mudado sem reauditoria;
- conferir changed files;
- conferir diff integral;
- conferir que não há migrations/dependências/lockfile fora do escopo;
- rodar checks disponíveis e registrar exatamente o que passou/falhou;
- teste manual aprovado pelo responsável do projeto.

Depois do merge:
- confirmar novo SHA da `main`;
- publicar/sincronizar ambiente aplicável;
- repetir o teste essencial no celular;
- registrar resultado neste documento;
- somente então mudar a etapa para `FECHADA`;
- branch pode ser descartada depois da confirmação.

---

## 8. Registro de evidência por etapa

Para cada microetapa fechada, registrar:

- data;
- baseline `main` antes;
- branch;
- commits;
- PR;
- arquivos alterados;
- banco alterado: SIM/NÃO;
- migrations: lista ou NENHUMA;
- checks executados;
- roteiro de teste manual;
- resultado do teste;
- SHA final da `main`;
- eventuais pendências descobertas que ficaram fora do escopo.

---

## 9. Fila de achados fora do escopo

Quando um problema novo for descoberto:

1. registrar aqui ou no histórico técnico;
2. classificar criticidade;
3. não corrigir na etapa atual;
4. inserir em posição segura da fila;
5. só executar quando a etapa anterior estiver FECHADA.

---

## 10. Estado atual

**Etapa atual:** P1 — Disponibilidade da cidade pela localização real do passageiro.  
**Permissão atual:** AUDITORIA APENAS até ser definido o patch mínimo.  
**Próxima etapa:** P2 somente após P1 ser testada e FECHADA.  

**Regra de parada:** se qualquer teste da P1 falhar, permanecer na P1 até corrigir e aprovar.
