-- Contatos de confiança do passageiro (usados na função "Compartilhar viagem")
CREATE TABLE public.contatos_confianca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passageiro_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  nome text NOT NULL,
  telefone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


ALTER TABLE public.contatos_confianca ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Usuário gerencia seus próprios contatos de confiança"
  ON public.contatos_confianca
  FOR ALL
  USING (passageiro_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()))
  WITH CHECK (passageiro_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()));


-- Links públicos e temporários de acompanhamento de viagem em tempo real
CREATE TABLE public.viagens_compartilhadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corrida_id uuid NOT NULL REFERENCES public.corridas(id) ON DELETE CASCADE,
  link_publico text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  expira_em timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);


ALTER TABLE public.viagens_compartilhadas ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Passageiro ou motorista da corrida gerenciam o compartilhamento"
  ON public.viagens_compartilhadas
  FOR ALL
  USING (
    corrida_id IN (
      SELECT id FROM public.corridas
      WHERE passageiro_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())
         OR motorista_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    corrida_id IN (
      SELECT id FROM public.corridas
      WHERE passageiro_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid())
    )
  );


CREATE POLICY "Leitura pública do link de acompanhamento (somente leitura, sem login)"
  ON public.viagens_compartilhadas
  FOR SELECT
  USING (expira_em > now());


-- Chamados de suporte (dúvida, SOS, reclamação) — módulo Suporte do Painel
CREATE TYPE public.tipo_chamado_suporte AS ENUM ('duvida', 'sos', 'reclamacao');
CREATE TYPE public.status_chamado_suporte AS ENUM ('aberto', 'em_atendimento', 'resolvido', 'fechado');


CREATE TABLE public.chamados_suporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  corrida_id uuid REFERENCES public.corridas(id) ON DELETE SET NULL,
  tipo public.tipo_chamado_suporte NOT NULL,
  status public.status_chamado_suporte NOT NULL DEFAULT 'aberto',
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


ALTER TABLE public.chamados_suporte ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Usuário vê e cria seus próprios chamados"
  ON public.chamados_suporte
  FOR SELECT
  USING (usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()));


CREATE POLICY "Usuário cria seus próprios chamados"
  ON public.chamados_suporte
  FOR INSERT
  WITH CHECK (usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()));
