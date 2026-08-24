CREATE POLICY "Usuários podem excluir suas próprias notificações"
ON public.notificacoes
FOR DELETE
TO authenticated
USING (
  usuario_id IN (
    SELECT usuarios.id
    FROM public.usuarios
    WHERE usuarios.auth_user_id = auth.uid()
  )
);
