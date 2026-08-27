alter table public.pagamentos_pix_tentativas
  add column if not exists ticket_url text,
  add column if not exists provider_error_code text,
  add column if not exists provider_error_message text;

comment on column public.pagamentos_pix_tentativas.ticket_url is
  'Link oficial do Mercado Pago para a cobranca Pix, quando fornecido pelo provedor.';
comment on column public.pagamentos_pix_tentativas.provider_error_code is
  'Codigo sanitizado de erro do provedor na criacao da cobranca Pix.';
comment on column public.pagamentos_pix_tentativas.provider_error_message is
  'Mensagem sanitizada de erro do provedor na criacao da cobranca Pix.';
