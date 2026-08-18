-- Update Brasília/DF to 'piloto' status with specific test rates
UPDATE public.cidades
SET 
    status = 'piloto',
    raio_atuacao_km = 15.00,
    bandeirada = 5.50,
    valor_km = 2.80,
    valor_min = 1.20,
    tarifa_minima = 8.00,
    comissao_pct = 15.00,
    updated_at = now()
WHERE nome = 'Brasília' AND estado_uf = 'DF';
