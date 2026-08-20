# Plan: ZUVVI — MICROETAPA 0.3 — CORRIGIR OWNERSHIP DA POLICY DE INSERT DE CORRIDAS

Objective: Correct the `WITH CHECK` expression for the INSERT policy on `public.corridas` to properly map `passageiro_id` (pointing to `usuarios.id`) to `auth.uid()` (pointing to `usuarios.auth_user_id`).

## Technical Details

- Table: `public.corridas`
- Policy Name: "Passageiros podem criar suas próprias corridas"
- Operation: `INSERT`
- Role: `authenticated`
- Current logic (presumed incorrect): `passageiro_id = auth.uid()`
- Target logic: `EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = passageiro_id AND u.auth_user_id = auth.uid())`

## Steps

1. Create a single migration file: `supabase/migrations/20260820011800_fix_rides_insert_policy.sql`.
2. Add the SQL to drop and recreate the policy with the corrected `WITH CHECK`.
3. Verify the migration succeeds.
4. Verify RLS remains active and no other policies were affected.
