INSERT INTO public.cidades (nome, estado_uf, status, raio_atuacao_km, bandeirada, valor_km, valor_min, tarifa_minima, comissao_pct)
VALUES ('Jacarezinho', 'PR', 'piloto', 10.00, 5.00, 2.50, 1.00, 7.00, 15.00)
ON CONFLICT DO NOTHING;