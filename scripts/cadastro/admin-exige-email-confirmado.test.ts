import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Etapa 6 do fechamento ponta a ponta, terceira fatia — atualizado depois de
// um security review encontrar que getAuthContextFromRequest() determinava
// isAdmin só por comparação do e-mail da sessão com uma string fixa
// ('mokahz@gmail.com' confirmado), sem nunca consultar admin_users. Isso não
// chegou a ser explorável (nenhum caminho de autorização real lia esse
// isAdmin — todos re-derivam de admin_users via resolveDestinationInternal/
// getAuthStatus), mas era uma armadilha: qualquer código novo que confiasse
// nele diretamente herdaria a falha. auth-status.server.ts agora usa a mesma
// fonte de verdade do resto do app (tabela admin_users por auth_user_id) —
// travado abaixo.
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
// ponta a ponta, não só que um pedaço dela existe. Isso continua valendo só
// pra perfil.functions.ts (que nunca decidiu autorização, só impede o admin
// de virar passageiro/motorista por engano — baixo risco, não mexido aqui).

const authStatusServerSource = readFileSync("src/lib/auth-status.server.ts", "utf8");
const perfilFunctionsSource = readFileSync("src/lib/perfil.functions.ts", "utf8");
const authFunctionsSource = readFileSync("src/lib/auth.functions.ts", "utf8");

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

// auth-status.server.ts: isAdmin não pode mais vir de comparação de e-mail —
// nenhuma ocorrência do e-mail do admin pode aparecer fora de um comentário.
// Reintroduzir 'mokahz@gmail.com' numa expressão de isAdmin aqui é
// exatamente a regressão que este teste existe pra travar.
{
  const linhasComEmailForaDeComentario = authStatusServerSource
    .split("\n")
    .filter((linha) => linha.includes("mokahz@gmail.com") && !linha.trim().startsWith("//"));
  assert.equal(
    linhasComEmailForaDeComentario.length,
    0,
    "auth-status.server.ts não deve mais decidir isAdmin comparando e-mail — use admin_users",
  );

  // As duas chamadas (Authorization header e cookie de sessão) devem
  // resolver isAdmin pela mesma função, que por sua vez consulta admin_users.
  // (Só casa `isAdmin: await ...` — a declaração de tipo `isAdmin: boolean;`
  // da interface AuthContext não entra aqui, de propósito.)
  const chamadas = [...authStatusServerSource.matchAll(/isAdmin:\s*(await[^\n,]*)/g)];
  assert.equal(chamadas.length, 2, "auth-status.server.ts deve continuar com as 2 checagens de admin");
  for (const chamada of chamadas) {
    assert.match(
      chamada[1].trim(),
      /^await isAdminUser\(/,
      `auth-status.server.ts: isAdmin deve vir de isAdminUser(...), não de comparação de e-mail (encontrado: ${chamada[1].trim()})`,
    );
  }

  assert.match(
    authStatusServerSource,
    /\.from\(["']admin_users["']\)[\s\S]*?\.eq\(["']auth_user_id["'],\s*userId\)[\s\S]*?\.eq\(["']role["'],\s*["']admin["']\)[\s\S]*?\.eq\(["']ativo["'],\s*true\)/,
    "isAdminUser deve consultar admin_users por auth_user_id, role='admin' e ativo=true",
  );
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

// auth.functions.ts: signUp deve rejeitar o e-mail do admin antes de criar a
// conta — o cadastro público confirma na hora (email_confirm: true), então
// sem esse bloqueio bastaria alguém se cadastrar com esse e-mail pra sair
// com uma conta "confirmada" com ele. A condição extraída é avaliada de
// verdade contra maiúsculas/espaços (bypass óbvio de um `=== "mokahz@..."`
// sem normalizar) e contra outro e-mail, pra provar que bloqueia só o
// e-mail certo, não qualquer cadastro.
{
  const match = authFunctionsSource.match(/if \(((?:[^{])*?mokahz@gmail\.com(?:[^{])*?)\)\s*\{\s*throw/);
  assert.ok(match, "auth.functions.ts: signUp deve ter um bloqueio explícito pro e-mail do admin");
  const expressao = match![1].trim();
  const varMatch = expressao.match(/(\w+(?:\.\w+)*)\.trim\(\)\.toLowerCase\(\)/);
  assert.ok(varMatch, `auth.functions.ts: não foi possível identificar a variável normalizada na expressão: ${expressao}`);

  const avaliarComEmail = (email: string): unknown => {
    const data = { email };
    const fn = new Function("data", `return (${expressao});`);
    return fn(data);
  };

  assert.equal(avaliarComEmail("mokahz@gmail.com"), true, "deve bloquear o e-mail exato do admin");
  assert.equal(avaliarComEmail("MOKAHZ@GMAIL.COM"), true, "deve bloquear ignorando maiúsculas/minúsculas");
  assert.equal(avaliarComEmail("  mokahz@gmail.com  "), true, "deve bloquear ignorando espaços nas bordas");
  assert.equal(avaliarComEmail("outro@example.com"), false, "não deve bloquear outro e-mail qualquer");
}

console.log(
  "auth-status.server.ts decide admin só por admin_users; perfil.functions.ts continua exigindo e-mail confirmado (avaliado de verdade) nas 2 checagens restantes; auth.functions.ts bloqueia o cadastro manual do e-mail do admin.",
);
