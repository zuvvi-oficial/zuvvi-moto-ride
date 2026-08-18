-- Revogar acesso público e autenticado às funções SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM anon;

-- Garantir que apenas service_role possa executar diretamente se necessário, 
-- ou deixar apenas para uso interno em políticas e server functions via admin client.
-- Para o TanStack Start, o client configurado com service_role poderá usar.
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO service_role;

-- Corrigir search_path para handle_updated_at
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
