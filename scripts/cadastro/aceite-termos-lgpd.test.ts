import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

// Etapa 3 da adequação à LGPD: aceite obrigatório dos Termos de Uso e da
// Política de Privacidade ao completar o cadastro (etapa por onde passa
// toda conta nova, seja e-mail ou Google — ver isRegistrationComplete em
// auth-status.functions.ts), com registro de quando e qual versão foi
// aceita.

const serverFnSource = readFileSync("src/lib/auth-google.functions.ts", "utf8");
const formSource = readFileSync("src/routes/auth.completar-cadastro.tsx", "utf8");
const versionSource = readFileSync("src/lib/legal-versions.ts", "utf8");

// O schema de validação do servidor precisa exigir aceiteTermos === true —
// isso é o que impede a checagem de virar decorativa (só no cliente).
assert.match(
  serverFnSource,
  /aceiteTermos:\s*z\s*\.boolean\(\)\s*\.refine\(\s*\(v\)\s*=>\s*v\s*===\s*true/,
  "updateUserInfo deve recusar o cadastro sem aceiteTermos === true",
);

// O aceite precisa ser gravado com data e a versão vigente dos documentos —
// sem isso não há prova de quando/qual versão a pessoa aceitou.
const updateStart = serverFnSource.indexOf(".update({");
const updateEnd = serverFnSource.indexOf("})", updateStart);
assert.ok(updateStart >= 0 && updateEnd > updateStart, "UPDATE de usuarios deve existir");
const updateBody = serverFnSource.slice(updateStart, updateEnd);
assert.match(
  updateBody,
  /termos_aceitos_em:\s*new Date\(\)\.toISOString\(\)/,
  "o momento do aceite deve ser gravado em termos_aceitos_em",
);
assert.match(
  updateBody,
  /termos_versao:\s*TERMOS_VERSAO/,
  "a versão aceita deve ser gravada em termos_versao",
);

// O formulário não pode deixar enviar sem marcar a caixa, e precisa linkar
// as duas páginas legais.
assert.match(
  formSource,
  /if \(!aceiteTermos\) \{/,
  "o formulário deve bloquear o envio sem o aceite marcado",
);
assert.match(
  formSource,
  /disabled=\{isLoading \|\| !aceiteTermos\}/,
  "o botão de enviar deve ficar desabilitado sem o aceite",
);
assert.match(formSource, /href="\/termos"/, "deve linkar para /termos");
assert.match(formSource, /href="\/privacidade"/, "deve linkar para /privacidade");
const executeUpdateStart = formSource.indexOf("executeUpdate({");
const executeUpdateEnd = formSource.indexOf("});", executeUpdateStart);
assert.ok(executeUpdateStart >= 0, "chamada a executeUpdate deve existir");
assert.match(
  formSource.slice(executeUpdateStart, executeUpdateEnd),
  /\baceiteTermos\b/,
  "o aceite marcado precisa ser enviado ao servidor",
);

// A migration que cria as colunas precisa existir e corresponder ao nome
// usado no código.
const migrationName = readdirSync("supabase/migrations").find((name) =>
  name.endsWith("_lgpd_registro_aceite_termos.sql"),
);
assert.ok(migrationName, "migration do registro de aceite deve estar versionada");
const migration = readFileSync(`supabase/migrations/${migrationName}`, "utf8");
assert.match(migration, /ADD COLUMN termos_aceitos_em timestamptz/, "coluna termos_aceitos_em");
assert.match(migration, /ADD COLUMN termos_versao text/, "coluna termos_versao");

// A versão exportada precisa ser uma data (usada tanto no aceite quanto na
// exibição de "última atualização" das páginas legais).
assert.match(versionSource, /export const TERMOS_VERSAO = "\d{4}-\d{2}-\d{2}"/);

console.log("LGPD_ACEITE_TERMOS_CADASTRO_OK");
