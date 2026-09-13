# Corrigir publicação do Zuvvi na Netlify

## Objetivo
Configurar o build existente do TanStack Start para a Netlify, sem alterar telas, design, dados ou funcionalidades.

## Alterações
- Adicionar o adaptador oficial `@netlify/vite-plugin-tanstack-start` como dependência de desenvolvimento.
- Integrar o adaptador ao `vite.config.ts`, preservando a entrada de servidor personalizada e a configuração PWA atual.
- Criar `netlify.toml` com `bun run build` e publicação de `dist/client`.
- Manter o funcionamento do ambiente Lovable enquanto o build externo usa o alvo da Netlify.

## Validação
- Executar a checagem TypeScript.
- Executar `bun run build`.
- Confirmar que `dist/client/assets` contém os arquivos JavaScript e CSS gerados.
- Conferir o estado Git e deixar a alteração pronta para sincronização com a branch `main` do GitHub.

## Limite operacional
O repositório atualmente conectado é o armazenamento interno do Lovable, não um remote GitHub. A alteração será registrada no projeto; o envio direto à `main` do GitHub só será possível se a integração GitHub estiver disponível durante a execução.
