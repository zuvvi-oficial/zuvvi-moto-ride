# Diagnóstico do Web Push com o app fechado

## Conclusão principal
A publicação atual contém um erro objetivo no service worker gerado, diferente das hipóteses já descartadas sobre VAPID, inscrição e envio pelo servidor.

O arquivo público `/sw.js` responde `200`, com JavaScript e `Cache-Control: no-cache`, e importa corretamente `/sw-push.js`. Porém, seu manifesto de pré-cache contém 167 entradas iniciadas por `client/`, por exemplo:

- `/client/sw-push.js`
- `/client/manifest.webmanifest`
- `/client/favicon.svg`
- `/client/brand/...`

Esses caminhos retornam `404` na produção. O arquivo correto `/sw-push.js` existe na raiz e responde `200`.

Como o Workbox instala o service worker pré-carregando todo esse manifesto, uma entrada obrigatória com `404` rejeita a instalação. O navegador pode mostrar uma *registration*, mas o worker novo não chega necessariamente ao estado `activated`; em uma instalação limpa pode não existir worker ativo. Isso explica o cenário observado: o servidor entrega o push ao FCM sem erro, mas não há um service worker ativo e funcional no aparelho para receber o evento e executar `showNotification()`.

## Evidências verificadas
- `/sw.js` → `200`, JavaScript, sem cache prolongado.
- `/sw-push.js` → `200`, JavaScript, contém o listener `push`.
- `/client/sw-push.js` e demais arquivos `/client/*` do pré-cache → `404`.
- Logs de produção registraram requisições reais repetidas a `/client/sw-push.js` com `404` antes desta auditoria.
- Em um navegador limpo, após abrir a produção e aguardar, `navigator.serviceWorker.getRegistrations()` continuou vazio, compatível com falha de instalação.
- O bundle publicado registra explicitamente `/sw.js` com escopo `/`; não há evidência de escopo incorreto.
- A ausência de `Service-Worker-Allowed` não é problema aqui: `/sw.js` está na raiz e pode controlar `/` por padrão.
- Não há evidência atual de CDN servindo uma versão antiga: `/sw.js` e a página usam revalidação, e o bundle aponta para `/sw.js`.

## Acesso de diagnóstico disponível
Tenho acesso aos logs HTTP e de runtime da publicação na última hora, além dos arquivos e cabeçalhos públicos. Não tenho acesso remoto ao console, permissões, bateria ou estado interno do Chrome no celular específico do motorista.

Os logs de runtime não mostraram exceções de envio. O achado relevante foi no tráfego HTTP do service worker.

## Próximo passo sem alterar código
No aparelho afetado, usar depuração remota do Chrome e confirmar em **Application → Service Workers**:

1. se `/sw.js` aparece como `installing`, `redundant` ou com erro de pré-cache;
2. se existe um worker antigo em `activated` e outro aguardando/falhando;
3. se o erro cita `/client/sw-push.js` ou outra URL `/client/*`;
4. se `PushManager.getSubscription()` pertence ao mesmo registro e escopo `/`.

Esse teste fecha a confirmação no aparelho, mas o erro publicado já é suficiente para explicar a falha.

## Correção proposta para uma etapa posterior
Sem tocar em telas, VAPID ou envio:

- impedir que o gerador do Workbox inclua o diretório intermediário `client/` no pré-cache;
- gerar URLs públicas reais (`/assets/*`, `/sw-push.js`, `/manifest.webmanifest`, `/brand/*`);
- fazer o build falhar se qualquer URL do pré-cache não existir no diretório publicado;
- validar uma instalação limpa até o estado `activated`;
- testar um evento Push no DevTools com a página fechada;
- publicar somente após conferir que não existe nenhuma entrada `/client/*` no `/sw.js` final.

## Hipóteses secundárias
Restrições de bateria do Android, permissão revogada e inscrição rotacionada continuam possíveis em aparelhos específicos, mas devem ser investigadas somente depois de corrigir a falha determinística de instalação acima. Hoje elas não são a melhor explicação primária.
