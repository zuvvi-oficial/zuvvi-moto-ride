import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const source = readFileSync("src/lib/user.functions.ts", "utf8");
const start = source.indexOf("export const criarCorrida");
const end = source.indexOf("export const getCorrida", start);

assert.notEqual(start, -1, "criarCorrida deve existir");
assert.notEqual(end, -1, "getCorrida deve existir após criarCorrida");

const criarCorridaSource = source.slice(start, end);

assert.match(
  criarCorridaSource,
  /criar_corrida_financeira_atomica/,
  "criarCorrida deve delegar a atomicidade para a RPC transacional",
);
assert.doesNotMatch(
  criarCorridaSource,
  /\.from\(["']corridas["']\)[\s\S]*?\.insert\(/,
  "criarCorrida não pode inserir corrida separadamente",
);
assert.doesNotMatch(
  criarCorridaSource,
  /\.from\(["']pagamentos["']\)[\s\S]*?\.insert\(/,
  "criarCorrida não pode inserir pagamento separadamente",
);
assert.match(
  criarCorridaSource,
  /const comissaoPct = Number\(cidade\.comissao_pct \|\| 0\);/,
  "regra existente de percentual de comissão deve ser preservada",
);
assert.match(
  criarCorridaSource,
  /Math\.round\(\(data\.valorCotado \* \(comissaoPct \/ 100\)\) \* 100\) \/ 100/,
  "cálculo existente da comissão deve ser preservado",
);
assert.match(
  criarCorridaSource,
  /Math\.round\(\(data\.valorCotado - valorComissao\) \* 100\) \/ 100/,
  "cálculo existente do líquido do motorista deve ser preservado",
);
assert.match(
  criarCorridaSource,
  /formaPagamento: z\.enum\(\["pix", "cartao", "dinheiro"\]\)/,
  "os três meios de pagamento existentes devem permanecer aceitos",
);

const migrationName = readdirSync("supabase/migrations").find((name) =>
  name.endsWith("_criacao_financeira_atomica.sql"),
);
assert.ok(migrationName, "migration da criação financeira atômica deve estar versionada");

const migration = readFileSync(`supabase/migrations/${migrationName}`, "utf8");
assert.match(migration, /security invoker/i, "RPC deve permanecer SECURITY INVOKER");
assert.match(migration, /set search_path = ''/i, "RPC deve fixar search_path");
assert.match(migration, /pg_advisory_xact_lock/i, "RPC deve serializar criação por passageiro");
assert.match(migration, /insert into public\.corridas/i, "RPC deve criar a corrida");
assert.match(migration, /insert into public\.pagamentos/i, "RPC deve criar o pagamento na mesma chamada");
assert.match(
  migration,
  /create unique index pagamentos_corrida_unique_idx/i,
  "um agregado de pagamento por corrida deve ser garantido no banco",
);
assert.match(
  migration,
  /revoke execute[\s\S]*from public, anon, authenticated/i,
  "RPC não pode ser executável diretamente por clientes",
);
assert.match(
  migration,
  /grant execute[\s\S]*to service_role/i,
  "RPC deve ser acessível somente pela camada privilegiada do servidor",
);

console.log("ETAPA3_STATIC_GUARDS_OK");
