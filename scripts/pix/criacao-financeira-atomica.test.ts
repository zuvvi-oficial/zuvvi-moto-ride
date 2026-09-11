import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const source = readFileSync("src/lib/user.functions.ts", "utf8");
// criarCorrida delega sua lógica de negócio para criarCorridaCore (extraído
// para ser reaproveitado pelo motor de corrida agendada) — por isso a
// fatia analisada começa no núcleo, não no wrapper público, mas ainda
// cobre exatamente o mesmo comportamento que este teste sempre verificou.
const coreStart = source.indexOf("export async function criarCorridaCore");
const wrapperStart = source.indexOf("export const criarCorrida");
const end = source.indexOf("export const getCorrida", wrapperStart);

assert.notEqual(coreStart, -1, "criarCorridaCore deve existir");
assert.notEqual(wrapperStart, -1, "criarCorrida deve existir");
assert.notEqual(end, -1, "getCorrida deve existir após criarCorrida");

const criarCorridaSource = source.slice(coreStart, end);

assert.match(
  criarCorridaSource,
  /criar_corrida_financeira_atomica/,
  "criarCorrida deve delegar a atomicidade para a RPC transacional",
);
assert.doesNotMatch(
  // Ancorado ao .insert( encadeado direto no mesmo .from("corridas") — não
  // ao primeiro .insert( de qualquer tabela que apareça depois no arquivo
  // (ex.: cupom_usos, adicionado na Etapa 2 de cupons de desconto), que o
  // [\s\S]*? antigo (não ganancioso, mas ainda cruzando linhas/tabelas)
  // capturava incorretamente como falso positivo.
  criarCorridaSource,
  /\.from\(["']corridas["']\)\s*\.insert\(/,
  "criarCorrida não pode inserir corrida separadamente",
);
assert.doesNotMatch(
  criarCorridaSource,
  /\.from\(["']pagamentos["']\)\s*\.insert\(/,
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
  // Renomeado para comissaoOriginal na Etapa 2 de cupons de desconto: o
  // líquido do motorista continua saindo da comissão cheia (sem desconto),
  // nunca do valor já reduzido por um cupom — é exatamente essa proteção
  // que este guard verifica, só com o novo nome da variável.
  /Math\.round\(\(data\.valorCotado - comissaoOriginal\) \* 100\) \/ 100/,
  "cálculo existente do líquido do motorista deve ser preservado (protegido de descontos de cupom)",
);
assert.match(
  source,
  /formaPagamento: z\.enum\(\["pix", "cartao", "dinheiro"\]\)/,
  "os três meios de pagamento existentes devem permanecer aceitos",
);

const migrationName = readdirSync("supabase/migrations").find((name) =>
  name.endsWith("_criacao_financeira_atomica.sql"),
);
const migrationPath = migrationName
  ? `supabase/migrations/${migrationName}`
  : "/tmp/etapa3.sql";
assert.ok(
  migrationName || existsSync(migrationPath),
  "migration da criação financeira atômica deve estar versionada ou isolada pelo workflow",
);

const migration = readFileSync(migrationPath, "utf8");
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
