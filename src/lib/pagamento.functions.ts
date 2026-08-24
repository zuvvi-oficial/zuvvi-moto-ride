import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

const criarCobrancaPixSchema = z.object({
  rideId: z.string().uuid(),
});

export const criarCobrancaPix = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarCobrancaPixSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { criarCobrancaPixServer } = await import('./pagamento.server');
    return await criarCobrancaPixServer(data.rideId, context.userId);
  });
