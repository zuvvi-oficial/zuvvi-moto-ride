# CHECKPOINT INICIAL — PIX ZUVVI — ETAPA 0

**Data:** 24/08/2026  
**Branch de trabalho:** `feature/pix-100-seguro`  
**Commit-base imutável:** `ae6fb274b8e61e4f0619fc2fbe819f282b2f40cd`  
**Supabase:** `qycblinfvijhfjcmdoof`  
**Região:** `ca-central-1`  
**Postgres:** `17.6.1.155`  

## Resultado do pré-voo

- Repositório acessível com permissão administrativa.
- Branch padrão confirmada: `main`.
- Worktree auditado sem alterações locais.
- Nenhuma alteração de aplicação ou banco realizada na Etapa 0.
- Nenhuma migration aplicada.
- Nenhuma Edge Function criada ou modificada.
- Nenhuma RLS, função, trigger, tabela ou dado alterado.

## Baseline financeiro

| Controle | Valor |
| --- | ---: |
| Corridas | 100 |
| Pagamentos | 83 |
| Pagamentos Pix | 3 |
| Pagamentos pendentes | 83 |
| Pagamentos com ID Mercado Pago | 0 |
| Corridas sem pagamento | 17 |
| Corridas com pagamentos duplicados | 0 |
| Corridas Pix ativas | 0 |

Os registros históricos permanecem intocados. Os 17 registros sem pagamento não serão corrigidos ou preenchidos sem microetapa própria e aprovação explícita.

## Baseline de migrations

Última migration aplicada no Supabase no momento do checkpoint:

`20260824222419_unicidade_conta_mercado_pago_motorista`

Qualquer migration Pix futura deverá aparecer simultaneamente no histórico real e no GitHub. Divergência bloqueia o avanço.

## Hashes dos principais pontos congelados

| Arquivo | SHA-256 |
| --- | --- |
| `package.json` | `71b9e8dc6ef0028172aed34993d150a1d5f77adad5c7b5168046c7d0b8cd6f50` |
| `src/lib/user.functions.ts` | `a66dc3b4093328bf64a0a2c80986c52999be5b39eb1839262f946c3896ffdef0` |
| `src/lib/motorista.functions.ts` | `ef202d0097cbd0123f62c9d4655b43f9b859ee7b2e2a667bad0f1a029661f6f3` |
| `src/lib/pagamento.server.ts` | `e034647cde8e8e1eee7d57029b263e210fc2ae703f888b2d2dde8a137d579ad4` |
| `src/lib/motorista-pagamento.functions.ts` | `fcafe924a0b96f999625bbb0e48b961df8ed895bc1b331a3f79fb29501ad81d3` |
| `src/routes/confirmar-corrida.tsx` | `53ded905ef56296a61e8b7a0a54cc89d294fc40e69858616714d7534e94e1be6` |
| `src/routes/home-motorista.tsx` | `60a5bfc56f6a992aceaaf0288fabdddab056e6c3e252c3e9aac03bba64fbd7eb` |

Alteração inesperada em qualquer arquivo congelado deverá ser explicada, isolada e aprovada pela allowlist da microetapa correspondente.

## Mudanças recentes do Supabase consideradas

- Edge Functions hospedadas usam Deno 2.1.
- Tabelas novas no schema público não devem ser presumidas como expostas à Data API; acesso, grants e RLS devem ser verificados explicitamente.
- Se Realtime for usado futuramente no Pix, a compatibilidade da versão do cliente e do runtime será testada antes da adoção.

## Estado da Etapa 0

Este checkpoint é somente documental. O próximo passo possível é preparar um ambiente Supabase de desenvolvimento. A criação de branch Supabase possui custo informado pelo provedor e exige confirmação explícita antes de qualquer criação.

### Decisão do responsável

Em 24/08/2026, Rafael não autorizou a criação da branch paga do Supabase durante o desenvolvimento. A branch não foi criada e nenhum custo foi gerado.

O desenvolvimento seguirá, quando tecnicamente possível, em ambiente Supabase local isolado. O projeto Supabase principal permanecerá somente leitura até uma autorização explícita para uma migration específica.
