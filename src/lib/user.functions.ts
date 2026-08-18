import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type MotoristaRow = Database["public"]["Tables"]["motoristas"]["Row"];
type CidadeRow = Database["public"]["Tables"]["cidades"]["Row"];

export type UserWithMotorista = UserRow & {
  motorista: MotoristaRow | null;
};

export const getSessionUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserWithMotorista> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: user, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("*, motorista:motoristas(*)")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (userError || !user) {
      throw new Error("Usuário não encontrado");
    }

    const motoristaData = Array.isArray(user.motorista) ? user.motorista[0] : user.motorista;

    return {
      ...user,
      motorista: (motoristaData as MotoristaRow) || null
    } as UserWithMotorista;
  });

export const getMapboxToken = createServerFn({ method: "GET" })
  .handler(async () => {
    return process.env.MAPBOX_TOKEN || null;
  });

export const checkCityAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ 
    cidadeId: z.string().uuid().nullable().optional(),
    coords: z.object({
      lat: z.number(),
      lng: z.number()
    }).optional()
  }).parse(data))
  .handler(async ({ input, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    if (input.cidadeId) {
      const { data: cidade } = await supabaseAdmin
        .from("cidades")
        .select("status, nome")
        .eq("id", input.cidadeId)
        .maybeSingle();
      
      if (cidade) {
        return {
          isAvailable: cidade.status === 'piloto' || cidade.status === 'ativa',
          cityName: cidade.nome,
          status: cidade.status
        };
      }
    }

    return { 
      isAvailable: false,
      cityName: null,
      status: null
    };
  });