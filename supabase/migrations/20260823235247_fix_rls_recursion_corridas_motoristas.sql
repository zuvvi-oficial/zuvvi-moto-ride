-- Microetapa 4.9 - CORRIGIR RECURSAO INFINITA NAS POLITICAS DE RLS (corridas x motoristas)

-- 1. Criar a função SECURITY DEFINER para quebrar o ciclo de RLS
CREATE OR REPLACE FUNCTION public.passageiro_tem_corrida_ativa_com_motorista(p_motorista_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM corridas c
    JOIN usuarios u ON c.passageiro_id = u.id
    WHERE c.motorista_id = p_motorista_id
      AND u.auth_user_id = auth.uid()
      AND c.status = ANY (ARRAY['aceita','motorista_a_caminho','motorista_chegou','em_andamento']::corrida_status[])
  );
$$;

-- 2. Revogar acesso público e garantir execução para usuários autenticados
REVOKE ALL ON FUNCTION public.passageiro_tem_corrida_ativa_com_motorista(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.passageiro_tem_corrida_ativa_com_motorista(uuid) TO authenticated;

-- 3. Substituir a política na tabela motoristas para usar a nova função
DROP POLICY IF EXISTS "Passenger can see driver location of active ride" ON public.motoristas;

CREATE POLICY "Passenger can see driver location of active ride"
ON public.motoristas
FOR SELECT
TO authenticated
USING (public.passageiro_tem_corrida_ativa_com_motorista(motoristas.id));

COMMENT ON FUNCTION public.passageiro_tem_corrida_ativa_com_motorista(uuid) IS 'Verifica se o passageiro autenticado tem uma corrida ativa com o motorista informado, quebrando a recursão de RLS.';
