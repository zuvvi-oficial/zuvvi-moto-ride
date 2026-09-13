import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

// Etapa 4 da adequação à LGPD: exclusão de conta a pedido da pessoa,
// apagando dados pessoais mas preservando o histórico financeiro
// (corridas/pagamentos) anonimizado, pelo prazo exigido por lei.

const migrationName = readdirSync("supabase/migrations").find((name) =>
  name.endsWith("_lgpd_exclusao_conta.sql"),
);
assert.ok(migrationName, "migration da exclusão de conta deve estar versionada");
const migration = readFileSync(`supabase/migrations/${migrationName}`, "utf8");

assert.match(
  migration,
  /create or replace function public\.excluir_conta_usuario/i,
  "a RPC excluir_conta_usuario deve existir",
);
assert.match(migration, /security definer/i, "a RPC deve ser SECURITY DEFINER");
assert.match(migration, /set search_path = ''/, "a RPC deve fixar search_path vazio");

// Não pode deixar excluir com corrida em andamento (segurança física e
// financeira: sumir com alguém no meio de um trajeto ou cobrança Pix ativa).
assert.match(
  migration,
  /status not in \('concluida', 'cancelada', 'sem_motorista'\)/,
  "deve bloquear exclusão com corrida em status não terminal",
);
assert.match(migration, /raise exception/i, "deve recusar com uma mensagem clara");

// Histórico financeiro não pode ser apagado nem desvinculado de forma que
// quebre a integridade referencial — corridas/pagamentos continuam
// existindo, só a linha de usuarios é que perde os campos de identificação.
assert.doesNotMatch(
  migration,
  /delete from public\.corridas\b/i,
  "corridas não podem ser apagadas na exclusão de conta",
);
assert.doesNotMatch(
  migration,
  /delete from public\.pagamentos\b/i,
  "pagamentos não podem ser apagados na exclusão de conta",
);
const updateUsuariosStart = migration.indexOf("update public.usuarios");
const updateUsuariosEnd = migration.indexOf("where id = p_usuario_id;", updateUsuariosStart);
assert.ok(updateUsuariosStart >= 0, "UPDATE de public.usuarios deve existir");
const updateUsuariosBody = migration.slice(updateUsuariosStart, updateUsuariosEnd);
for (const campo of ["nome", "email", "celular", "cpf", "data_nascimento", "foto_perfil_path"]) {
  assert.match(
    updateUsuariosBody,
    new RegExp(`${campo}\\s*=`),
    `usuarios.${campo} deve ser limpo na exclusão`,
  );
}

// Credenciais Mercado Pago do motorista precisam ser removidas — não faz
// sentido manter tokens de acesso guardados após o encerramento da conta.
assert.match(migration, /delete from private\.motorista_mercadopago_credenciais/);

// veiculos tem placa/marca/modelo/ano/cor NOT NULL — tentar anonimizar com
// UPDATE...NULL nessas colunas viola a constraint e desfaz a transação
// inteira (achado do Codex, PR #140: exclusão ficava quebrada pra qualquer
// motorista com veículo cadastrado). A linha tem que ser apagada.
assert.match(
  migration,
  /delete from public\.veiculos where motorista_id = p_usuario_id/,
  "veiculos deve ser apagado (não anonimizado) por causa das colunas NOT NULL",
);
assert.doesNotMatch(
  migration,
  /update public\.veiculos/,
  "não pode tentar fazer UPDATE em veiculos com colunas NOT NULL",
);

// Agendamentos guardam coordenadas exatas de origem/destino e não são
// histórico financeiro (achado do Codex, PR #140) — precisam ser apagados.
assert.match(
  migration,
  /delete from public\.corridas_agendadas where passageiro_id = p_usuario_id/,
  "corridas_agendadas deve ser apagada (contém localização não-financeira)",
);

// Só o servidor pode chamar — nunca o cliente direto via anon/authenticated.
assert.match(
  migration,
  /revoke all on function public\.excluir_conta_usuario\(uuid\) from public, anon, authenticated/,
);
assert.match(
  migration,
  /grant execute on function public\.excluir_conta_usuario\(uuid\) to service_role/,
);

const serverFnSource = readFileSync("src/lib/exclusao-conta.functions.ts", "utf8");
assert.match(serverFnSource, /requireSupabaseAuth/, "deve exigir autenticação");
assert.match(
  serverFnSource,
  /supabaseAdmin\.rpc\(\s*["']excluir_conta_usuario["']/,
  "deve chamar a RPC de exclusão",
);
assert.match(
  serverFnSource,
  /supabaseAdmin\.auth\.admin\.deleteUser\(authUserId\)/,
  "deve encerrar o login apagando o usuário do Auth",
);
assert.match(
  serverFnSource,
  /storage\s*\.from\("documentos-motorista"\)\s*\.remove/,
  "deve remover os documentos do Storage",
);
assert.match(
  serverFnSource,
  /storage\s*\.from\("fotos-perfil"\)\s*\.remove/,
  "deve remover a foto de perfil do Storage",
);

// .remove() do Storage RESOLVE com { error } num 4xx/5xx normal, não lança
// — um try/catch sozinho não pega isso (achado do Codex, PR #140: falha
// real na remoção de documentos sensíveis ficava invisível, reportando
// sucesso mesmo assim). Cada chamada precisa checar o error explicitamente.
const remocaoDocumentosStart = serverFnSource.indexOf('.from("documentos-motorista")');
const remocaoFotoStart = serverFnSource.indexOf('.from("fotos-perfil")');
assert.ok(remocaoDocumentosStart >= 0 && remocaoFotoStart >= 0);
const JANELA_ANTES = 80;
assert.match(
  serverFnSource.slice(Math.max(0, remocaoDocumentosStart - JANELA_ANTES), remocaoDocumentosStart),
  /const \{ error \} = await/,
  "a remoção dos documentos deve capturar o error retornado",
);
assert.match(
  serverFnSource.slice(Math.max(0, remocaoFotoStart - JANELA_ANTES), remocaoFotoStart),
  /const \{ error \} = await/,
  "a remoção da foto deve capturar o error retornado",
);

const dialogSource = readFileSync("src/components/perfil/ExcluirContaDialog.tsx", "utf8");
assert.match(
  dialogSource,
  /AlertDialog/,
  "deve usar um diálogo de confirmação, não window.confirm",
);
assert.match(
  dialogSource,
  /não pode ser\s+desfeita/,
  "deve avisar claramente que a ação é irreversível",
);
assert.match(dialogSource, /excluirContaUsuario/, "deve chamar a função de exclusão");
assert.match(dialogSource, /to: "\/auth\/login"/, "deve navegar pro login após excluir");

const perfilPassageiro = readFileSync("src/routes/perfil.tsx", "utf8");
const perfilMotorista = readFileSync("src/routes/perfil-motorista.tsx", "utf8");
assert.match(
  perfilPassageiro,
  /<ExcluirContaDialog \/>/,
  "a opção de excluir conta deve estar no perfil do passageiro",
);
assert.match(
  perfilMotorista,
  /<ExcluirContaDialog \/>/,
  "a opção de excluir conta deve estar no perfil do motorista",
);

console.log("LGPD_EXCLUSAO_CONTA_OK");
