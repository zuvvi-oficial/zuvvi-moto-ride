# Plano de Trabalho - Microetapa 1.9

O objetivo único desta etapa é remover a função legada `toggleDisponibilidade` de `src/lib/motorista.functions.ts` de forma segura, garantindo que não existam referências externas a ela.

## Auditoria de Segurança
- [x] Busca global por `toggleDisponibilidade` no diretório `src/`.
- [x] Confirmação de que a única ocorrência é a própria declaração em `src/lib/motorista.functions.ts`.
- [x] Verificação de que não há referências em rotas, componentes ou outros arquivos `functions.ts`.

## Alterações Autorizadas
- Remover o export e a implementação da função `toggleDisponibilidade` no arquivo `src/lib/motorista.functions.ts` (linhas 13-66).

## Proteções do Core (Intocáveis)
- `src/lib/motorista-status.functions.ts` não será alterado.
- Nenhuma outra função em `src/lib/motorista.functions.ts` será alterada.
- Nenhuma rota, componente ou banco de dados será modificado.

## Validação
- Executar `npm run build` para garantir integridade.
- Executar `npm run lint` para verificar ausência de erros.
- Confirmar que o Supabase permanece intacto.
