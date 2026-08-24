import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getHistoricoCorridas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      // 1. Resolver o ID do usuário (tabela public.usuarios) a partir do auth_user_id (context.userId)
      const { data: userData, error: userError } = await context.supabase
        .from("usuarios")
        .select("id")
        .eq("auth_user_id", context.userId)
        .maybeSingle();

      if (userError || !userData) {
        console.error("Erro ao resolver usuário no histórico:", userError);
        return [];
      }

      const passageiroId = userData.id;

      // 2. Buscar corridas usando o ID da tabela usuarios
      const { data: corridas, error } = await context.supabase
        .from("corridas")
        .select(`
          id,
          status,
          origem_nome,
          destino_nome,
          valor_final,
          valor_estimado,
          forma_pagamento,
          created_at,
          data_finalizacao,
          motorista:motorista_id (
            usuario:usuarios (
              nome
            )
          )
        `)
        .eq("passageiro_id", passageiroId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Erro ao buscar histórico:", error);
        return [];
      }

      // Mapear para facilitar o uso no frontend, extraindo o nome do motorista do join
      return (corridas || []).map((c: any) => ({
        ...c,
        nome_motorista: c.motorista?.usuario?.nome || null,
        // Remover o objeto motorista original para limpar o retorno
        motorista: undefined
      }));
    } catch (err) {
      console.error("Falha catastrófica no histórico:", err);
      return [];
    }
  });
