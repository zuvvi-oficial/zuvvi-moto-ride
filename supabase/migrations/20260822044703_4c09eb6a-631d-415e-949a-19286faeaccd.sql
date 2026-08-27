DO $$
DECLARE
    legacy_count INTEGER;
    updated_count INTEGER;
    active_ride_id UUID := '2251e1de-f717-452b-ae37-297ebc2ab7de';
    active_ride_status_before TEXT;
    active_ride_status_after TEXT;
BEGIN
    -- Contagem preliminar do legado. Em reconstrução de banco do zero não há
    -- dados operacionais; nesse caso esta migration de saneamento é não aplicável.
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

    SELECT status INTO active_ride_status_before
    FROM public.corridas
    WHERE id = active_ride_id;

    IF active_ride_status_before IS NULL AND legacy_count = 0 THEN
        RAISE NOTICE 'Saneamento legado não aplicável: banco sem os dados operacionais históricos.';
    ELSE
        -- Proteção original: fora de um banco vazio, a corrida auditada precisa existir.
        IF active_ride_status_before IS NULL THEN
            RAISE EXCEPTION 'ERRO CRÍTICO: Corrida ativa real % não encontrada.', active_ride_id;
        END IF;

        RAISE NOTICE 'Legacy count found: %', legacy_count;

        -- Validação Fail-Closed original.
        IF legacy_count <> 13 THEN
            RAISE EXCEPTION 'Abortando: Esperados 13 registros, encontrados %. Base divergente da auditoria.', legacy_count;
        END IF;

        -- UPDATE controlado original.
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

        -- Pós-condição original.
        IF updated_count <> 13 THEN
            RAISE EXCEPTION 'Abortando: Esperadas 13 atualizações, realizadas %. Rollback.', updated_count;
        END IF;

        -- Verificação final da corrida protegida original.
        SELECT status INTO active_ride_status_after
        FROM public.corridas
        WHERE id = active_ride_id;

        IF active_ride_status_before <> active_ride_status_after THEN
            RAISE EXCEPTION 'ERRO CRÍTICO: Status da corrida protegida mudou de % para %. Rollback.', active_ride_status_before, active_ride_status_after;
        END IF;

        RAISE NOTICE 'Saneamento concluído com sucesso. 13 registros atualizados.';
    END IF;
END $$;
