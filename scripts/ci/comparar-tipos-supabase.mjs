// Compara os tipos gerados a partir do schema local (CI) com o arquivo
// versionado, ignorando blocos de metadados que variam conforme o gerador
// usado — não o schema em si:
//
// - `graphql_public`: o Postgres local do CI instala a extensão pg_graphql
//   por padrão (imagem de desenvolvimento do Supabase CLI), mas a produção
//   deste projeto não tem essa extensão instalada. O `supabase gen types
//   --local` inclui esse schema; a API hospedada usada para gerar o arquivo
//   versionado, não.
// - `__InternalSupabase`: metadado de versão do PostgREST que a API
//   hospedada inclui e o `--local` desta versão da CLI não gera.
//
// Nenhum dos dois reflete conteúdo real de tabela/função/tipo — só como
// cada gerador anota o arquivo. O que importa (Tables/Views/Functions/
// Enums/CompositeTypes de "public") não é tocado por esta normalização.
import { readFileSync } from "node:fs";

const CHAVES_IGNORADAS = ["graphql_public", "__InternalSupabase"];

function removerBlocosChave(texto, chave) {
  const linhas = texto.split("\n");
  const regexInicio = new RegExp(`^\\s*${chave}: \\{$`);
  let indice;
  while ((indice = linhas.findIndex((linha) => regexInicio.test(linha))) !== -1) {
    let profundidade = 0;
    let fim = -1;
    for (let i = indice; i < linhas.length; i++) {
      for (const caractere of linhas[i]) {
        if (caractere === "{") profundidade++;
        else if (caractere === "}") profundidade--;
      }
      if (profundidade === 0 && i > indice) {
        fim = i;
        break;
      }
    }
    if (fim === -1) {
      throw new Error(
        `Bloco "${chave}" sem fechamento correspondente encontrado (linha ${indice + 1}).`,
      );
    }
    linhas.splice(indice, fim - indice + 1);
  }
  return linhas.join("\n");
}

function removerComentariosDeLinha(texto) {
  // O gerador da API hospedada (usado no arquivo versionado) inclui um
  // comentário fixo de instrução acima de `__InternalSupabase`; o `--local`
  // não gera nenhum comentário. Como nenhum comentário altera o tipo em si,
  // remover todas as linhas puramente de comentário dos dois lados evita
  // depender do texto exato desse comentário (que pode mudar entre versões
  // da API/CLI sem que o schema real tenha mudado).
  return texto
    .split("\n")
    .filter((linha) => !linha.trim().startsWith("//"))
    .join("\n");
}

function normalizar(texto) {
  return removerComentariosDeLinha(CHAVES_IGNORADAS.reduce(removerBlocosChave, texto));
}

const [caminhoGerado, caminhoVersionado] = process.argv.slice(2);
if (!caminhoGerado || !caminhoVersionado) {
  console.error("Uso: node comparar-tipos-supabase.mjs <gerado.ts> <versionado.ts>");
  process.exit(2);
}

const gerado = normalizar(readFileSync(caminhoGerado, "utf8"));
const versionado = normalizar(readFileSync(caminhoVersionado, "utf8"));

if (gerado !== versionado) {
  console.error(
    "src/integrations/supabase/types.ts está desatualizado em relação ao schema real das migrations.",
  );
  console.error(
    "Rode localmente: npx supabase gen types typescript --local > src/integrations/supabase/types.ts && bunx prettier --write src/integrations/supabase/types.ts",
  );
  process.exit(1);
}
