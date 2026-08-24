GRANT SELECT, INSERT ON public.mensagens_suporte TO authenticated;
GRANT ALL ON public.mensagens_suporte TO service_role;
GRANT SELECT, INSERT ON public.chamados_suporte TO authenticated;
GRANT ALL ON public.chamados_suporte TO service_role;

CREATE POLICY "Passageiro envia mensagem em chamado em atendimento"
ON public.mensagens_suporte
FOR INSERT
TO authenticated
WITH CHECK (
  autor_admin_id IS NULL
  AND autor_usuario_id IN (
    SELECT u.id FROM public.usuarios u WHERE u.auth_user_id = (SELECT auth.uid())
  )
  AND EXISTS (
    SELECT 1
    FROM public.chamados_suporte c
    JOIN public.usuarios u ON u.id = c.usuario_id
    WHERE c.id = mensagens_suporte.chamado_id
      AND u.auth_user_id = (SELECT auth.uid())
      AND c.status = 'em_atendimento'
  )
);