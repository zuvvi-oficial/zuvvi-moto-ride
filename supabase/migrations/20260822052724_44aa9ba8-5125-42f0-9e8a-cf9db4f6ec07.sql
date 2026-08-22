DO $$
DECLARE
    duplicate_count INTEGER;
    index_exists INTEGER;
BEGIN
    -- 1. PRÉ-CONDIÇÃO: Verificar se já existe índice com este nome
    SELECT count(*) INTO index_exists
    FROM pg_indexes
    WHERE indexname = 'idx_corridas_passageiro_aberta_unique'
      AND schemaname = 'public';

    IF index_exists > 0 THEN
        RAISE EXCEPTION 'ERRO: O índice idx_corridas_passageiro_aberta_unique já existe. Abortando para evitar conflito de estado.';
    END IF;

    -- 2. PRÉ-CONDIÇÃO FAIL-CLOSED: Verificar duplicidade de passageiros com corridas abertas
    SELECT count(*) INTO duplicate_count
    FROM (
        SELECT passageiro_id
        FROM public.corridas
        WHERE status IN (
            'solicitada',
            'buscando_motorista',
            'aceita',
            'motorista_a_caminho',
            'motorista_chegou',
            'em_andamento'
        )
        GROUP BY passageiro_id
        HAVING count(*) > 1
    ) AS duplicates;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'ERRO FAIL-CLOSED: Encontrados % passageiros com mais de uma corrida aberta. Abortando criação do índice.', duplicate_count;
    END IF;

    -- 3. CRIAÇÃO DO ÍNDICE ÚNICO PARCIAL
    CREATE UNIQUE INDEX idx_corridas_passageiro_aberta_unique
    ON public.corridas (passageiro_id)
    WHERE passageiro_id IS NOT NULL
    AND status IN (
        'solicitada',
        'buscando_motorista',
        'aceita',
        'motorista_a_caminho',
        'motorista_chegou',
        'em_andamento'
    );
END $$;