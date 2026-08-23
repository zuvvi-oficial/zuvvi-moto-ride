-- TRIGGER: recalcular_nota_media_motorista
-- DESCRIÇÃO: Sempre que um motorista é avaliado, a nota média no perfil do motorista é atualizada.

CREATE OR REPLACE FUNCTION public.recalcular_nota_media_motorista()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_motorista boolean;
BEGIN
  -- Verifica se o avaliado é um motorista
  SELECT EXISTS (
    SELECT 1 FROM public.motoristas WHERE id = NEW.avaliado_id
  ) INTO v_is_motorista;

  IF v_is_motorista THEN
    -- Recalcula a média e atualiza
    UPDATE public.motoristas
    SET nota_media = (
      SELECT ROUND(AVG(nota)::numeric, 2)
      FROM public.avaliacoes
      WHERE avaliado_id = NEW.avaliado_id
    )
    WHERE id = NEW.avaliado_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_recalcular_nota_media_motorista
AFTER INSERT ON public.avaliacoes
FOR EACH ROW
EXECUTE FUNCTION public.recalcular_nota_media_motorista();
