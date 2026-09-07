import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Etapa 6 do fechamento ponta a ponta, terceira fatia. Trava uma invariante
// de segurança crítica sem cobertura nenhuma até então: o status de admin é
// determinado só por comparação de e-mail (nenhuma tabela/role dedicada).
// Isso é seguro hoje porque o e-mail do admin já existe e é único no projeto
// (Supabase impede duas contas com o mesmo e-mail), mas SÓ SE o
// email_confirmed_at continuar exigido: sem essa condição, uma conta recém-
// criada com esse e-mail sem nunca ter confirmado o cadastro (ex.: chamada
// direta à Admin API, ou um provedor de auth que não confirma na hora) seria
// tratada como admin antes mesmo do dono verificar a posse do e-mail.
//
// Trava as 4 checagens existentes (auth-status.server.ts x2,
// perfil.functions.ts x2) para que nenhuma delas seja "simplificada" no
// futuro removendo a exigência de e-mail confirmado.

const authStatusServerSource = readFileSync("src/lib/auth-status.server.ts", "utf8");
const perfilFunctionsSource = readFileSync("src/lib/perfil.functions.ts", "utf8");

const ADMIN_CHECK_PATTERN = /email === 'mokahz@gmail\.com' && !!\w+\?\.email_confirmed_at/g;

{
  const matches = authStatusServerSource.match(ADMIN_CHECK_PATTERN) ?? [];
  assert.equal(
    matches.length,
    2,
    "auth-status.server.ts deve continuar com as 2 checagens de admin exigindo e-mail confirmado (Authorization header e cookie de sessão)",
  );
}

{
  const matches = perfilFunctionsSource.match(ADMIN_CHECK_PATTERN) ?? [];
  assert.equal(
    matches.length,
    2,
    "perfil.functions.ts deve continuar bloqueando o admin de virar passageiro/motorista só quando o e-mail estiver confirmado",
  );
}

console.log("Admin exige e-mail confirmado (não só e-mail igual) nas 4 checagens existentes.");
