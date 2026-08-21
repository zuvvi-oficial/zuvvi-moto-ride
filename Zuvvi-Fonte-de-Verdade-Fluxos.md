# Zuvvi — Fonte de Verdade — Fluxos

> [!CAUTION]
> **AVISO DE CARÁTER HISTÓRICO**  
> Este documento passou a ter caráter **HISTÓRICO**. Ele não representa mais a etapa operacional atual do projeto.  
> A única fonte da verdade operacional oficial agora é o arquivo: `ZUVVI-FECHAMENTO-CONTROLE.md`.  
> Decisões, microetapas e novos planos devem ser registrados exclusivamente no documento oficial.

## Estado da Missão
- **Fase Atual:** Piloto (Brasília/DF e Jacarezinho/PR)
- **Etapa em Execução:** 1 — Padronização da Sessão

## Etapa 1 — Plano de Sessão
O objetivo é garantir que a sessão do Supabase seja compartilhada de forma síncrona entre o navegador (Client-side) e o TanStack Start (Server-side/SSR).

### Mecanismo Oficial: Supabase Auth Cookies (via @supabase/ssr)
A solução será baseada em **Cookies**, pois é o único mecanismo que permite aos loaders SSR acessarem a identidade do usuário no primeiro request sem depender da hidratação do JavaScript no cliente.

### Componentes de Sessão:
1. **Gravação:** O navegador usará o SDK do Supabase que, configurado com `flowType: 'pkce'`, gerencia a troca de tokens. Adicionaremos um `onAuthStateChange` no `__root.tsx` ou `auth-attacher.ts` para sincronizar o token JWT com um cookie HTTP acessível pelo servidor.
2. **Leitura Server-side:** `getAuthContextFromRequest` em `src/lib/auth-status.server.ts` já utiliza `createServerClient` para ler esses cookies.
3. **Persistência:** O cookie terá a mesma validade do token JWT.
4. **Logout:** A função de logout limpará tanto o estado do SDK quanto o cookie.

### Arquivos a Alterar:
- `src/integrations/supabase/client.ts`: Configurar para suportar cookies.
- `src/integrations/supabase/auth-attacher.ts`: Implementar a sincronização ativa de cookies no lado do cliente.
- `src/routes/__root.tsx`: Inserir o listener global de estado de autenticação para garantir a sincronização.
- `src/lib/auth-status.server.ts`: Pequenos ajustes para garantir que a leitura de cookies seja a prioridade absoluta.
- `src/routes/auth.callback.tsx`: Garantir que a troca PKCE ocorra antes da decisão de destino.

---

## Histórico de Auditoria
- **Etapa 0 (Diagnóstico):** Identificada inconsistência entre localStorage e loaders SSR. (18/08/2026)
