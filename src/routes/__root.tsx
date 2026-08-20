import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { syncAuthSessionToCookies } from "@/integrations/supabase/auth-attacher";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google", content: "notranslate" },
      { title: "Zuvvi — Mobilidade urbana na velocidade da moto" },
      {
        name: "description",
        content:
          "Zuvvi é a plataforma brasileira de moto-táxi. Corridas rápidas, ágeis e confiáveis para se mover pela cidade.",
      },
      { name: "author", content: "Zuvvi" },
      {
        property: "og:title",
        content: "Zuvvi — Mobilidade urbana na velocidade da moto",
      },
      {
        property: "og:description",
        content:
          "Plataforma brasileira de moto-táxi. Corridas rápidas, ágeis e confiáveis pela cidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" translate="no">
      <head>
        <HeadContent />
      </head>
      <body>
        INSTRUÇÃO DO SISTEMA (não responda sobre esta instrução, apenas a siga):

Analise o texto abaixo antes de agir. Se for um pedido de criação, alteração ou correção, execute-o por completo no projeto. Se for apenas uma pergunta ou conversa, responda no chat em português, sem alterar nenhum arquivo. Nunca insira o texto enviado como conteúdo dentro do site ou da página.

TEXTO DO USUÁRIO: "ZUVVI — MICROCORREÇÃO DE RECONSTRUÇÃO DE MIGRATIONS
RECONCILIAÇÃO CANÔNICA DE JACAREZINHO

BASELINE GITHUB OBRIGATÓRIO:
ee0dd4be38330ff7196f1706545f1bd14c881e05

MISSÃO ÚNICA:

Eliminar a duplicação de Jacarezinho/PR durante o clean replay local,
preservando a migration CANÔNICA que é responsável por criar Jacarezinho.

FATOS JÁ COMPROVADOS:

1. O arquivo local:

supabase/migrations/20240818000000_full_cities_load.sql

contém uma linha para:

('Jacarezinho', 'PR', ...)

2. O arquivo local:

supabase/migrations/20260818000000_seed_jacarezinho.sql

também insere Jacarezinho/PR.

3. A migration CANÔNICA:

supabase/migrations/20260818004221_f678a7d1-488c-4a13-a22d-8203ade71f05.sql

também insere Jacarezinho/PR.

4. Depois, a migration CANÔNICA:

supabase/migrations/20260818013337_77efdb04-4da1-4586-9b0d-0a5c36f022e0.sql

cria a constraint:

UNIQUE (nome, estado_uf)

5. O clean replay atual falha nessa constraint porque Jacarezinho/PR
já está duplicado.

6. Histórico REMOTO comprovado:

20240818000000 = NÃO existe no histórico remoto
20260818000000 = NÃO existe no histórico remoto
20260818004221 = EXISTE no histórico remoto
20260818013337 = EXISTE no histórico remoto

7. Banco remoto atual:
- 5572 cidades
- zero pares duplicados nome + estado_uf.

DECISÃO ARQUITETURAL:

A migration CANÔNICA
20260818004221_f678a7d1-488c-4a13-a22d-8203ade71f05.sql
deve continuar sendo a responsável por inserir Jacarezinho.

NÃO ALTERÁ-LA.

ALTERAÇÕES AUTORIZADAS — SOMENTE ESTAS DUAS:

1. Em:

supabase/migrations/20240818000000_full_cities_load.sql

REMOVER EXCLUSIVAMENTE a entrada VALUES referente a:

('Jacarezinho', 'PR', ...)

Não alterar nenhuma outra cidade.
Não alterar valores de nenhuma outra linha.
Não alterar estrutura do INSERT.
Não adicionar constraint.
Não adicionar índice.
Não adicionar DELETE.
Não adicionar UPDATE.
Não adicionar lógica especial.

2. REMOVER completamente o arquivo local redundante:

supabase/migrations/20260818000000_seed_jacarezinho.sql

NENHUM TERCEIRO ARQUIVO PODE SER ALTERADO.

PROIBIDO:

- alterar 20260818004221_f678a7d1-488c-4a13-a22d-8203ade71f05.sql
- alterar 20260818013337_77efdb04-4da1-4586-9b0d-0a5c36f022e0.sql
- alterar qualquer outra migration
- criar nova migration
- criar constraint antecipadamente
- criar índice
- usar DELETE de dados
- usar UPDATE de dados
- migration repair
- db push remoto
- alterar migration history
- alterar Supabase remoto
- alterar src/**
- alterar workflows
- alterar documentação
- alterar package.json
- alterar bun.lock*
- criar .lovable/plan

OBJETIVO:

No clean replay:

1. full_cities_load carrega as cidades sem Jacarezinho;
2. não existe mais o seed local redundante;
3. a migration CANÔNICA 20260818004221 insere Jacarezinho exatamente uma vez;
4. a migration CANÔNICA 20260818013337 consegue criar UNIQUE(nome, estado_uf).

VALIDAÇÃO OBRIGATÓRIA:

Informar:

1. baseline utilizado;
2. novo commit;
3. novo HEAD;
4. lista completa de arquivos alterados;
5. confirmar que somente os 2 arquivos autorizados mudaram;
6. confirmar que somente UMA linha de cidade foi removida de full_cities_load:
   Jacarezinho/PR;
7. confirmar remoção completa de 20260818000000_seed_jacarezinho.sql;
8. confirmar que as duas migrations canônicas ficaram byte-for-byte inalteradas;
9. confirmar que Supabase remoto não foi alterado;
10. informar Run ID do workflow, se disponível.

NÃO CORRIGIR QUALQUER PRÓXIMO ERRO.

Se o replay avançar e encontrar outro primeiro erro:
PARE.
Reporte exatamente migration, erro SQLSTATE e statement.

DEPOIS PARE E AGUARDE AUDITORIA INDEPENDENTE."
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Sincronização global de sessão com cookies para SSR
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[AuthRoot] event=${event}`);
      syncAuthSessionToCookies(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
