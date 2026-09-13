-- Advisors de segurança (anon/authenticated_security_definer_function_executable,
-- WARN): duas funções SECURITY DEFINER tinham EXECUTE concedido a papéis que
-- nunca precisam chamá-las diretamente via /rest/v1/rpc/....
--
-- public.passageiro_tem_corrida_ativa_com_motorista(uuid): usada dentro da
-- policy de RLS "Passenger can see driver location of active ride" (tabela
-- motoristas), só para o papel authenticated — EXECUTE para authenticated
-- precisa continuar concedido, senão a policy quebra e o passageiro deixa de
-- ver a localização do motorista durante a corrida. Já é seguro por
-- construção mesmo se chamada diretamente (usa auth.uid() do próprio
-- chamador, nunca vaza dado de outro usuário), mas anon não tem uso legítimo
-- nenhum dela (auth.uid() é sempre null pra anon, então a função sempre
-- retornaria false) — revogado só de anon.
revoke execute on function public.passageiro_tem_corrida_ativa_com_motorista(uuid) from anon;

-- public.recalcular_nota_media_motorista(): função de TRIGGER (retorna
-- trigger, usa NEW), disparada apenas pelo trigger tr_recalcular_nota_media_motorista
-- em avaliacoes. Trigger nunca depende de EXECUTE do papel que fez o INSERT/UPDATE
-- na tabela — só precisa de privilégio na tabela em si. Chamada direta via RPC
-- já falharia ("trigger functions can only be called as triggers"), então o
-- EXECUTE concedido a anon/authenticated/public nunca teve uso legítimo.
revoke execute on function public.recalcular_nota_media_motorista() from anon, authenticated, public;
