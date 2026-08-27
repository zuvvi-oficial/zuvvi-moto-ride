import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const rideSchema = z.object({ rideId: z.string().uuid() });

export const getPixGate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rideSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { getPixGateServer } = await import("./pix-passageiro.server");
    return getPixGateServer(data.rideId, context.userId);
  });

export const consultarStatusPixPassageiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rideSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { consultarStatusPixPassageiroServer } = await import("./pix-passageiro.server");
    return consultarStatusPixPassageiroServer(data.rideId, context.userId);
  });

export const regenerarCobrancaPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rideSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { regenerarCobrancaPixPassageiroServer } = await import("./pix-passageiro.server");
    return regenerarCobrancaPixPassageiroServer(data.rideId, context.userId);
  });

export const cancelarCorridaPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rideSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { cancelarCorridaPixPassageiroServer } = await import("./pix-passageiro.server");
    return cancelarCorridaPixPassageiroServer(data.rideId, context.userId);
  });
