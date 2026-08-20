-- Corrige a causa raiz do erro "no unique or exclusion constraint matching
-- the ON CONFLICT specification" no login social novo (Google).
--
-- O índice antigo era parcial (WHERE auth_user_id IS NOT NULL), o que não
-- é compatível com upsert(..., { onConflict: 'auth_user_id' }) sem predicado.
-- Uma UNIQUE CONSTRAINT normal já permite múltiplos valores NULL no Postgres,
-- então não perdemos nenhuma regra de negócio ao trocar.


DROP INDEX IF EXISTS public.usuarios_auth_user_id_key;


ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_auth_user_id_key UNIQUE (auth_user_id);
