CREATE OR REPLACE FUNCTION public.get_distinct_ufs()
RETURNS TABLE (estado_uf CHAR(2)) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT estado_uf 
  FROM public.cidades 
  ORDER BY estado_uf;
$$;

GRANT EXECUTE ON FUNCTION public.get_distinct_ufs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_ufs() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_distinct_ufs() TO anon;