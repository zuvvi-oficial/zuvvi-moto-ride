import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type MotoristaRow = Database["public"]["Tables"]["motoristas"]["Row"];

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

    // Since it's a 1:1 relation, we aliased it to motorista which might be an array or object depending on PostgREST
    // But since it's defined as isOneToOne: true in types, it should be an object.
    // If it comes as an array, we take the first element.
    const motoristaData = Array.isArray(user.motorista) ? user.motorista[0] : user.motorista;

    return {
      ...user,
      motorista: (motoristaData as MotoristaRow) || null
    } as UserWithMotorista;
  });

