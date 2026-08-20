CREATE OR REPLACE FUNCTION public.get_distinct_ufs()
 RETURNS TABLE(estado_uf character)
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT estado_uf 
  FROM public.cidades 
  ORDER BY estado_uf;
$function$;

GRANT EXECUTE ON FUNCTION public.get_distinct_ufs() TO anon, authenticated, service_role;