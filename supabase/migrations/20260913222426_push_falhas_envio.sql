-- Registra falhas reais de envio de Web Push (não a inscrição do navegador,
-- que já é visível via push_subscriptions/toast — isso aqui é o passo
-- seguinte, servidor-para-provedor, que hoje só aparece em console.error
-- do servidor, invisível sem acesso ao painel da Vercel). Sem isso, uma
-- falha no envio (VAPID ausente, chave incompatível, erro HTTP do provedor)
-- nunca deixa rastro consultável, escondendo justamente o caso que mais
-- importa diagnosticar: a notificação foi "criada" mas nunca chegou.
CREATE TABLE IF NOT EXISTS public.push_falhas_envio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    push_subscription_id UUID REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
    tipo_notificacao TEXT NOT NULL,
    motivo TEXT NOT NULL,
    detalhe TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_falhas_envio_usuario_created
    ON public.push_falhas_envio (usuario_id, created_at DESC);

COMMENT ON TABLE public.push_falhas_envio IS
    'Log de diagnóstico: cada falha real ao enviar um Web Push (não a inscrição do navegador). Escrito apenas pelo servidor (service_role); nunca exposto a anon/authenticated.';
COMMENT ON COLUMN public.push_falhas_envio.motivo IS
    'Categoria curta e estável da falha (ex.: vapid_ausente, http_error, excecao) — usada para agrupar/filtrar sem depender do texto livre de "detalhe".';
COMMENT ON COLUMN public.push_falhas_envio.detalhe IS
    'Texto livre com o motivo técnico exato (status HTTP do provedor, mensagem da exceção) — só para diagnóstico manual, nunca interpretado por código.';

-- Somente o servidor escreve e lê este log; nunca exposto ao navegador.
REVOKE ALL ON public.push_falhas_envio FROM public, anon, authenticated;
GRANT ALL ON public.push_falhas_envio TO service_role;

ALTER TABLE public.push_falhas_envio ENABLE ROW LEVEL SECURITY;
