-- Corrige três achados do Codex no PR #81 sobre a Etapa 1 do programa de
-- indicação:
--
-- 1. Código de indicação só era gerado no cadastro por e-mail/senha
--    (auth.functions.ts). O cadastro via Google (auth-status.functions.ts,
--    upsert lazy na primeira sincronização) e todo usuário já existente
--    antes desta migration ficavam sem código pra compartilhar. Backfill
--    abaixo cobre quem já existe; o código também passa a ser atribuído no
--    caminho do Google (ajuste em código, nesta mesma PR).
-- 2. authenticated tinha UPDATE de tabela inteira em usuarios (grant já
--    existente, não introduzido aqui) — incluindo codigo_indicacao, que
--    deveria ser imutável uma vez atribuído pelo sistema. Revoga a coluna
--    especificamente; o service_role (que atribui o código) não é afetado.
-- 3. O cupom automático de boas-vindas (criarCupomAutomatico) não tinha
--    como restringir quem pode usá-lo — qualquer pessoa que descobrisse o
--    código conseguiria gastar a única unidade antes do indicado de
--    verdade. Nova coluna cupons.usuario_restrito_id, checada em
--    avaliarCupomParaCorrida (ajuste em código, nesta mesma PR).

REVOKE UPDATE (codigo_indicacao) ON public.usuarios FROM authenticated;

ALTER TABLE public.cupons
    ADD COLUMN usuario_restrito_id uuid NULL REFERENCES public.usuarios(id);

DO $$
DECLARE
    _alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    _usuario record;
    _codigo text;
    _tentativa int;
    _sucesso boolean;
    _i int;
BEGIN
    FOR _usuario IN SELECT id FROM public.usuarios WHERE codigo_indicacao IS NULL LOOP
        _sucesso := false;
        _tentativa := 0;
        WHILE NOT _sucesso AND _tentativa < 10 LOOP
            _codigo := '';
            FOR _i IN 1..6 LOOP
                _codigo := _codigo || substr(_alfabeto, 1 + floor(random() * length(_alfabeto))::int, 1);
            END LOOP;
            BEGIN
                UPDATE public.usuarios SET codigo_indicacao = _codigo WHERE id = _usuario.id;
                _sucesso := true;
            EXCEPTION WHEN unique_violation THEN
                _tentativa := _tentativa + 1;
            END;
        END LOOP;
    END LOOP;
END $$;
