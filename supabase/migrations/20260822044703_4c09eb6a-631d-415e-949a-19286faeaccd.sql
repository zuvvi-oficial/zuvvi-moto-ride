DO $$
DECLARE
    legacy_count INTEGER;
    updated_count INTEGER;
    active_ride_id UUID := '2251e1de-f717-452b-ae37-297ebc2ab7de';
    active_ride_status_before TEXT;
    active_ride_status_after TEXT;
BEGIN
    -- 1. Verificação da corrida atual (Proteção)
    SELECT status INTO active_ride_status_before
    FROM public.corridas
    WHERE id = active_ride_id;

    IF active_ride_status_before IS NULL THEN
        RAISE EXCEPTION 'ERRO CRÍTICO: Corrida ativa real % não encontrada.', active_ride_id;
    END IF;

    -- 2. Contagem preliminar do legado
    SELECT count(*) INTO legacy_count
    FROM public.corridas
    WHERE status = 'solicitada'
      AND motorista_id IS NULL
      AND data_aceite IS NULL
      AND data_chegada_motorista IS NULL
      AND data_inicio IS NULL
      AND data_finalizacao IS NULL
      AND data_cancelamento IS NULL
      AND created_at < '2026-08-19 00:00:00+00';

    RAISE NOTICE 'Legacy count found: %', legacy_count;

    -- 3. Validação Fail-Closed
    IF legacy_count <> 13 THEN
        RAISE EXCEPTION 'Abortando: Esperados 13 registros, encontrados %. Base divergente da auditoria.', legacy_count;
    END IF;

    -- 4. UPDATE controlado
    UPDATE public.corridas
    SET status = 'sem_motorista',
        updated_at = now()
    WHERE status = 'solicitada'
      AND motorista_id IS NULL
      AND data_aceite IS NULL
      AND data_chegada_motorista IS NULL
      AND data_inicio IS NULL
      AND data_finalizacao IS NULL
      AND data_cancelamento IS NULL
      AND created_at < '2026-08-19 00:00:00+00';

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    -- 5. Pós-condição
    IF updated_count <> 13 THEN
        RAISE EXCEPTION 'Abortando: Esperadas 13 atualizações, realizadas %. Rollback.', updated_count;
    END IF;

    -- 6. Verificação final da corrida protegida
    SELECT status INTO active_ride_status_after
    FROM public.corridas
    WHERE id = active_ride_id;

    IF active_ride_status_before <> active_ride_status_after THEN
        RAISE EXCEPTION 'ERRO CRÍTICO: Status da corrida protegida mudou de % para %. Rollback.', active_ride_status_before, active_ride_status_after;
    END IF;

    RAISE NOTICE 'Saneamento concluído com sucesso. 13 registros atualizados.';
END $$;
