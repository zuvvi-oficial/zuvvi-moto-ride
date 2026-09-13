import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Etapa 5 (última) da adequação à LGPD: direito de portabilidade — a
// pessoa pode baixar um arquivo com os dados que o Zuvvi guarda sobre ela.

const serverFnSource = readFileSync("src/lib/exportacao-dados.functions.ts", "utf8");

assert.match(serverFnSource, /requireSupabaseAuth/, "deve exigir autenticação");
assert.match(
  serverFnSource,
  /\.eq\("auth_user_id", authUserId\)/,
  "deve buscar apenas os dados do próprio usuário autenticado, nunca de outro",
);

// Cobertura mínima: as categorias de dados que a Política de Privacidade
// promete que a pessoa pode pedir uma cópia (item 7) precisam de fato
// aparecer no export, não só ser prometidas no texto.
for (const tabela of [
  "corridas",
  "pagamentos",
  "avaliacoes",
  "gorjetas",
  "contatos_confianca",
  "enderecos_favoritos",
  "documentos_motorista",
  "veiculos",
]) {
  assert.match(
    serverFnSource,
    new RegExp(`\\.from\\("${tabela}"\\)`),
    `export deve incluir dados de ${tabela}`,
  );
}

// O export não pode devolver a linha inteira de usuarios (evita vazar
// colunas internas/futuras sem revisão) — precisa listar os campos.
assert.doesNotMatch(
  serverFnSource,
  /\.from\("usuarios"\)\s*\.select\("\*"\)/,
  "não deve exportar a linha de usuarios inteira sem revisão explícita dos campos",
);

const dialogSource = readFileSync("src/components/perfil/BaixarMeusDadosButton.tsx", "utf8");
assert.match(dialogSource, /exportarMeusDados/, "deve chamar a função de exportação");
assert.match(dialogSource, /new Blob/, "deve gerar o arquivo de download no navegador");
assert.match(dialogSource, /\.json/, "o arquivo baixado deve ser um .json");

const perfilPassageiro = readFileSync("src/routes/perfil.tsx", "utf8");
const perfilMotorista = readFileSync("src/routes/perfil-motorista.tsx", "utf8");
assert.match(
  perfilPassageiro,
  /<BaixarMeusDadosButton \/>/,
  "a opção de baixar dados deve estar no perfil do passageiro",
);
assert.match(
  perfilMotorista,
  /<BaixarMeusDadosButton \/>/,
  "a opção de baixar dados deve estar no perfil do motorista",
);

console.log("LGPD_EXPORTACAO_DADOS_OK");
