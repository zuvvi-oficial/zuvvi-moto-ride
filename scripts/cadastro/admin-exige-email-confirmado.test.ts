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
// Não basta checar que um TRECHO do texto da condição existe no arquivo —
// isso inclui capturar a declaração COMPLETA até o fim real da linha/
// condição, não só até onde o trecho conhecido termina. Duas variações que
// um regex mal delimitado deixaria passar despercebido, ambas classificando
// QUALQUER usuário como admin:
//   isAdmin: true || (adminUser?.email === ... && ...)          [prefixo]
//   isAdmin: adminUser?.email === ... && ... || true            [sufixo]
// A expressão inteira (âncora: a própria string do e-mail do admin, sem
// limite de tamanho até o fim da linha/condição) é extraída e de fato
// AVALIADA contra casos de admin confirmado, admin não confirmado e outro
// usuário — só assim o teste prova que a checagem controla a decisão de
// ponta a ponta, não só que um pedaço dela existe.

const authStatusServerSource = readFileSync("src/lib/auth-status.server.ts", "utf8");
const perfilFunctionsSource = readFileSync("src/lib/perfil.functions.ts", "utf8");

type UsuarioTeste = { email: string; email_confirmed_at: string | null } | undefined;

const ADMIN_CONFIRMADO: UsuarioTeste = {
  email: "mokahz@gmail.com",
  email_confirmed_at: "2024-01-01T00:00:00Z",
};
const ADMIN_NAO_CONFIRMADO: UsuarioTeste = {
  email: "mokahz@gmail.com",
  email_confirmed_at: null,
};
const OUTRO_USUARIO_CONFIRMADO: UsuarioTeste = {
  email: "outro@example.com",
  email_confirmed_at: "2024-01-01T00:00:00Z",
};
const SEM_USUARIO: UsuarioTeste = undefined;

function avaliarExpressao(expressao: string, varName: string, usuario: UsuarioTeste): unknown {
  const fn = new Function(varName, `return (${expressao});`);
  return fn(usuario);
}

function assertChecagemRealDeAdmin(expressao: string, varName: string, origem: string): void {
  assert.equal(
    avaliarExpressao(expressao, varName, ADMIN_CONFIRMADO),
    true,
    `${origem}: admin com e-mail confirmado deve ser reconhecido como admin (expressão: ${expressao})`,
  );
  assert.equal(
    avaliarExpressao(expressao, varName, ADMIN_NAO_CONFIRMADO),
    false,
    `${origem}: mesmo e-mail do admin, mas SEM confirmar, não deve ser reconhecido como admin (expressão: ${expressao})`,
  );
  assert.equal(
    avaliarExpressao(expressao, varName, OUTRO_USUARIO_CONFIRMADO),
    false,
    `${origem}: outro e-mail confirmado não deve ser reconhecido como admin (expressão: ${expressao})`,
  );
  assert.equal(
    avaliarExpressao(expressao, varName, SEM_USUARIO),
    false,
    `${origem}: ausência de usuário não deve ser reconhecida como admin (expressão: ${expressao})`,
  );
}

function extrairVarName(expressao: string, origem: string): string {
  const match = expressao.match(/(\w+)\?\.email/);
  assert.ok(
    match,
    `${origem}: não foi possível identificar a variável do usuário na expressão: ${expressao}`,
  );
  return match![1];
}

// auth-status.server.ts: isAdmin: <expressão inteira até o fim da linha> —
// âncora é a própria string do e-mail do admin, sem limite de tamanho até a
// quebra de linha, pra pegar qualquer coisa concatenada depois (ex.: || true).
{
  const pattern = /isAdmin:\s*([^\n]*mokahz@gmail\.com[^\n]*)/g;
  const matches = [...authStatusServerSource.matchAll(pattern)];
  assert.equal(
    matches.length,
    2,
    "auth-status.server.ts deve continuar com as 2 checagens de admin (Authorization header e cookie de sessão)",
  );
  for (const match of matches) {
    const expressao = match[1].trim();
    const varName = extrairVarName(expressao, "auth-status.server.ts");
    assertChecagemRealDeAdmin(expressao, varName, "auth-status.server.ts");
  }
}

// perfil.functions.ts: if (<expressão inteira até o parêntese de fechamento>)
// { ... } — mesma âncora, capturando tudo entre "if (" e o primeiro ")"
// (a expressão não tem parênteses aninhados, então isso pega qualquer coisa
// concatenada antes do fechamento, ex.: || true).
{
  const pattern = /if \(([^)]*mokahz@gmail\.com[^)]*)\)/g;
  const matches = [...perfilFunctionsSource.matchAll(pattern)];
  assert.equal(
    matches.length,
    2,
    "perfil.functions.ts deve continuar bloqueando o admin de virar passageiro/motorista só quando o e-mail estiver confirmado",
  );
  for (const match of matches) {
    const expressao = match[1].trim();
    const varName = extrairVarName(expressao, "perfil.functions.ts");
    assertChecagemRealDeAdmin(expressao, varName, "perfil.functions.ts");
  }
}

console.log(
  "Admin exige e-mail confirmado (avaliado de verdade, expressão inteira, não só um trecho fixo) nas 4 checagens existentes.",
);
