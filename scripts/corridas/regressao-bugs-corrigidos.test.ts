import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Etapa 6 do fechamento ponta a ponta: trava em teste automatizado 3 bugs
// reais já corrigidos nesta sessão, sem cobertura nenhuma até então. Segue o
// mesmo padrão estático de scripts/pix/*.test.ts (checar o código-fonte
// diretamente) por não haver harness de banco local disponível para estes
// testes.

const userFunctionsSource = readFileSync("src/lib/user.functions.ts", "utf8");
const motoristaFunctionsSource = readFileSync("src/lib/motorista.functions.ts", "utf8");

// G1 — cancelarCorrida (passageiro) não filtrava por status: o passageiro
// conseguia "cancelar" uma corrida já em_andamento ou concluida. Corrigido
// para só permitir cancelamento nos estados anteriores ao embarque.
{
  const start = userFunctionsSource.indexOf("export const cancelarCorrida =");
  assert.ok(start >= 0, "cancelarCorrida não encontrada em user.functions.ts");
  const end = userFunctionsSource.indexOf("export const getAcompanhamentoPassageiro", start);
  assert.ok(end > start, "não foi possível isolar o corpo de cancelarCorrida");
  const cancelarCorridaSource = userFunctionsSource.slice(start, end);

  assert.match(
    cancelarCorridaSource,
    /\.in\("status",\s*\[\s*'solicitada',\s*'buscando_motorista',\s*'aceita',\s*'motorista_a_caminho'\s*\]\)/,
    "G1: cancelarCorrida deve continuar restrita aos status anteriores ao embarque",
  );
  assert.doesNotMatch(
    cancelarCorridaSource.replace(/\.in\("status",\s*\[[^\]]*\]\)/, ""),
    /em_andamento|concluida/,
    "G1: cancelarCorrida não deve aceitar corrida já em andamento ou concluída fora do filtro de status",
  );
}

// G5 — reenviar o mesmo veículo (placa/marca/modelo/ano/cor idênticos)
// derrubava a aprovação já concedida, forçando o motorista a passar por
// análise de novo sem necessidade. Corrigido para preservar
// status_aprovacao/ativo quando os dados não mudaram.
{
  const start = motoristaFunctionsSource.indexOf("export const criarVeiculo =");
  assert.ok(start >= 0, "criarVeiculo não encontrada em motorista.functions.ts");
  const end = motoristaFunctionsSource.indexOf("\nexport const", start + 1);
  const criarVeiculoSource = motoristaFunctionsSource.slice(start, end > start ? end : undefined);

  assert.match(
    criarVeiculoSource,
    /const dadosInalterados = !!veiculoExistente &&/,
    "G5: criarVeiculo deve continuar detectando reenvio idêntico do veículo",
  );
  assert.match(
    criarVeiculoSource,
    /const statusAprovacao = dadosInalterados \? veiculoExistente\.status_aprovacao : 'em_preenchimento';/,
    "G5: reenvio idêntico não deve resetar status_aprovacao",
  );
}

// G7 — código de embarque era gerado com Math.random() (não criptográfico),
// previsível. Corrigido para usar crypto.randomInt.
{
  assert.match(
    userFunctionsSource,
    /const codigoEmbarque = crypto\.randomInt\(1000, 10000\)\.toString\(\);/,
    "G7: código de embarque deve continuar gerado via crypto.randomInt, não Math.random",
  );
  assert.doesNotMatch(
    userFunctionsSource,
    /codigoEmbarque\s*=\s*Math\.random/,
    "G7: código de embarque não deve voltar a usar Math.random",
  );
}

console.log(
  "G1 (cancelamento filtrado por status), G5 (reenvio de veículo preserva aprovação) e G7 (código de embarque criptográfico) aprovados.",
);
