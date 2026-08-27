// Compatibilidade da Server Function pública existente.
// Toda a cobrança Pix do passageiro é executada no motor Pix isolado e server-only.
export { criarCobrancaPixPassageiroServer as criarCobrancaPixServer } from "./pix-passageiro.server";
