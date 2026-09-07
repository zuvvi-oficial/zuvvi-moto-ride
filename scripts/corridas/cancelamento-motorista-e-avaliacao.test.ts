import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Etapa 6 do fechamento ponta a ponta, segunda fatia: trava mais 2
// invariantes críticas sem cobertura nenhuma até então. Mesmo padrão
// estático de scripts/pix/*.test.ts e
// scripts/corridas/regressao-bugs-corrigidos.test.ts.

const motoristaFunctionsSource = readFileSync("src/lib/motorista.functions.ts", "utf8");
const avaliacoesFunctionsSource = readFileSync("src/lib/avaliacoes.functions.ts", "utf8");

// cancelarCorridaMotorista: bloqueio simétrico ao do passageiro (G1) — uma
// corrida Pix com pagamento já confirmado não pode ser cancelada por aqui, e
// o motorista só pode cancelar ANTES de iniciar a viagem (nunca em_andamento,
// permissão temporária revogada na microetapa 3.7).
{
  const start = motoristaFunctionsSource.indexOf("export const cancelarCorridaMotorista =");
  assert.ok(start >= 0, "cancelarCorridaMotorista não encontrada em motorista.functions.ts");
  const end = motoristaFunctionsSource.indexOf("\nexport const", start + 1);
  const cancelarCorridaMotoristaSource = motoristaFunctionsSource.slice(
    start,
    end > start ? end : undefined,
  );

  assert.match(
    cancelarCorridaMotoristaSource,
    /if \(pagamentoPix\?\.status === "pago"\) \{/,
    "cancelamento pelo motorista deve continuar bloqueado quando o Pix já está pago",
  );
  assert.match(
    cancelarCorridaMotoristaSource,
    /\.in\("status",\s*\[\s*'aceita',\s*'motorista_a_caminho',\s*'motorista_chegou'\s*\]\)/,
    "motorista só pode cancelar nos status anteriores ao embarque — exatamente esses 3, sem em_andamento",
  );
}

// criarAvaliacao: só corrida concluída pode ser avaliada, só quem participou
// da corrida pode avaliar, e a nota fica limitada a 1-5 pelo validador Zod.
{
  assert.match(
    avaliacoesFunctionsSource,
    /nota:\s*z\.number\(\)\.int\(\)\.min\(1\)\.max\(5\)/,
    "nota da avaliação deve continuar limitada a um inteiro entre 1 e 5",
  );
  assert.match(
    avaliacoesFunctionsSource,
    /if \(ride\.status !== 'concluida'\) \{/,
    "só corrida concluída pode ser avaliada",
  );
  assert.match(
    avaliacoesFunctionsSource,
    /throw new Error\("Você não participou desta corrida\."\);/,
    "só quem participou da corrida (passageiro ou motorista) pode avaliá-la",
  );
}

console.log(
  "Cancelamento pelo motorista (Pix pago + status) e invariantes de avaliação (status/ownership/nota) aprovados.",
);
