-- 1. Efetivamente fechar a RPC para acesso público/autenticado direto
REVOKE ALL ON FUNCTION public.submit_motorista_for_analysis(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_motorista_for_analysis(UUID) TO service_role;

-- 2. Limpeza de políticas de UPDATE duplicadas e inseguras em motoristas
DROP POLICY IF EXISTS "Motoristas podem atualizar o próprio perfil" ON public.motoristas;
DROP POLICY IF EXISTS "Motoristas podem atualizar dados básicos" ON public.motoristas;
DROP POLICY IF EXISTS "Motoristas podem atualizar seus próprios dados" ON public.motoristas;

CREATE POLICY "motoristas_self_update_restricted"
ON public.motoristas
FOR UPDATE
TO authenticated
USING (id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()))
WITH CHECK (
    id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()) AND
    (status_aprovacao = 'em_preenchimento' OR status_aprovacao = 'recusado')
);

-- 3. Limpeza de políticas de UPDATE duplicadas e inseguras em veiculos
DROP POLICY IF EXISTS "Drivers can update their own vehicles" ON public.veiculos;
DROP POLICY IF EXISTS "Motoristas podem atualizar seu próprio veículo" ON public.veiculos;

CREATE POLICY "veiculos_self_update_restricted"
ON public.veiculos
FOR UPDATE
TO authenticated
USING (motorista_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()))
WITH CHECK (
    motorista_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()) AND
    (status_aprovacao = 'em_preenchimento' OR status_aprovacao = 'recusado')
);