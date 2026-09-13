-- Etapa 3 da adequação à LGPD: registrar quando e qual versão dos Termos de
-- Uso e da Política de Privacidade a pessoa aceitou, no momento em que
-- completa o cadastro (etapa obrigatória para todo mundo, seja o login por
-- e-mail ou Google — ver isRegistrationComplete em auth-status.functions.ts).

ALTER TABLE public.usuarios
  ADD COLUMN termos_aceitos_em timestamptz NULL,
  ADD COLUMN termos_versao text NULL;

COMMENT ON COLUMN public.usuarios.termos_aceitos_em IS
  'Quando a pessoa aceitou os Termos de Uso e a Política de Privacidade vigentes, ao completar o cadastro.';
COMMENT ON COLUMN public.usuarios.termos_versao IS
  'Versão (data) dos Termos de Uso/Política de Privacidade aceita, correspondente a TERMOS_VERSAO em src/lib/legal-versions.ts.';
