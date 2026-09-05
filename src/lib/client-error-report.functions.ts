import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const relatorioSchema = z.object({
  message: z.string().max(2000),
  stack: z.string().max(4000).optional(),
  route: z.string().max(300).optional(),
  mechanism: z.enum(["onerror", "unhandledrejection", "react_error_boundary"]),
});

// Sem middleware de auth de propósito: um erro no cliente pode acontecer
// antes mesmo do login (ex.: tela de cadastro). O objetivo aqui é só
// alcançar o mesmo pipeline de log estruturado do servidor — a expansão de
// stack/cause já implementada em src/lib/error-capture.ts — para que uma
// falha no navegador do usuário deixe de ser 100% invisível em produção.
// Nenhuma tabela nova, nenhum dado pessoal persistido: só um console.error.
export const registrarErroCliente = createServerFn({ method: "POST" })
  .validator((data: unknown) => relatorioSchema.parse(data))
  .handler(async ({ data }) => {
    const error = new Error(data.message);
    if (data.stack) error.stack = data.stack;

    console.error(error, {
      origem: "cliente",
      mecanismo: data.mechanism,
      rota: data.route ?? null,
    });

    return { success: true };
  });
