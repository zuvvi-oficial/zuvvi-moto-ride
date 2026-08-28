CREATE OR REPLACE FUNCTION public.recalcular_nota_media_motorista()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_motorista boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.motoristas WHERE id = NEW.avaliado_id
  ) INTO v_is_motorista;

  IF v_is_motorista THEN
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

DROP TRIGGER IF EXISTS tr_recalcular_nota_media_motorista ON public.avaliacoes;

CREATE TRIGGER tr_recalcular_nota_media_motorista
AFTER INSERT ON public.avaliacoes
FOR EACH ROW
EXECUTE FUNCTION public.recalcular_nota_media_motorista();

COMMENT ON FUNCTION public.recalcular_nota_media_motorista() IS 'Reaplicada em 24/08/2026 - a versão original da Microetapa 4.5 nunca chegou a ser executada no banco real, apesar do arquivo de migration existir no GitHub.';
