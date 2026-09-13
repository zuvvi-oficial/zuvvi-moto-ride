-- Corrida agendada — Etapa 4: lembrete push antes do horário agendado.
-- Precisa de uma marca de "já avisei" pra não mandar o mesmo lembrete duas
-- vezes quando o cron (a cada 5 min) roda de novo antes do agendamento
-- vencer de fato.
ALTER TABLE public.corridas_agendadas
    ADD COLUMN lembrete_enviado_at timestamptz NULL;
