-- A REVOKE UPDATE (codigo_indicacao) ON public.usuarios FROM authenticated
-- aplicada na migration anterior não teve efeito: authenticated já tinha
-- GRANT UPDATE de tabela inteira (grant pré-existente, não introduzido por
-- nós), e no modelo de privilégios do Postgres um GRANT de tabela inteira
-- cobre todas as colunas independentemente de um REVOKE column-specific
-- feito depois — column-level privileges só importam quando NÃO existe o
-- grant de tabela. Confirmado por teste: UPDATE de codigo_indicacao via
-- role authenticated ainda funcionava depois do REVOKE.
--
-- Fix robusto: trigger que bloqueia qualquer alteração de codigo_indicacao
-- que não venha do service_role (que é quem atribui o código no cadastro).
-- Não depende do modelo de grants e continua protegendo mesmo se alguém
-- conceder UPDATE de tabela inteira de novo no futuro.

CREATE OR REPLACE FUNCTION public.usuarios_bloquear_alteracao_codigo_indicacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.codigo_indicacao IS DISTINCT FROM OLD.codigo_indicacao AND current_user <> 'service_role' THEN
        RAISE EXCEPTION 'codigo_indicacao não pode ser alterado diretamente pelo cliente.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER usuarios_bloquear_alteracao_codigo_indicacao
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.usuarios_bloquear_alteracao_codigo_indicacao();
