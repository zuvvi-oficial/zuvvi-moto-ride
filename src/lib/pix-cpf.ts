export const CPF_PIX_INVALIDO_ERROR =
  "O CPF do seu cadastro é inválido. Corrija seu CPF no cadastro antes de pagar com Pix.";

export function normalizarCpfBrasileiro(value: string | null | undefined): string {
  return value?.replace(/\D/gu, "") ?? "";
}

function calcularDigitoVerificador(base: string, pesoInicial: number): number {
  let soma = 0;
  for (let index = 0; index < base.length; index += 1) {
    soma += Number(base[index]) * (pesoInicial - index);
  }

  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function validarCpfBrasileiro(value: string | null | undefined): boolean {
  const cpf = normalizarCpfBrasileiro(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/u.test(cpf)) return false;

  const primeiroDigito = calcularDigitoVerificador(cpf.slice(0, 9), 10);
  if (primeiroDigito !== Number(cpf[9])) return false;

  const segundoDigito = calcularDigitoVerificador(cpf.slice(0, 10), 11);
  return segundoDigito === Number(cpf[10]);
}

export function exigirCpfValidoParaPix(value: string | null | undefined): string {
  const cpf = normalizarCpfBrasileiro(value);
  if (!validarCpfBrasileiro(cpf)) throw new Error(CPF_PIX_INVALIDO_ERROR);
  return cpf;
}
