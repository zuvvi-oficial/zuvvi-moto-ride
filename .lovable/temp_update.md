# ZUVVI-FECHAMENTO-CONTROLE (continuação)

### Microetapa 4.4 — Destravar posição do motorista em tempo real — ✅ IMPLEMENTADA
- Criada política de RLS aditiva em `public.motoristas` ("Passenger can see driver location of active ride") permitindo leitura de `ultima_lat`, `ultima_lng` e `ultima_localizacao_at`.
- Restrição da política: apenas para o passageiro autenticado com corrida ativa (`aceita`, `motorista_a_caminho`, `motorista_chegou`, `em_andamento`) vinculada ao motorista.
- Corrigida falha de autenticação no canal Realtime `motorista-posicao` em `src/routes/acompanhamento.tsx`.
- Adicionado `await supabase.realtime.setAuth(session.access_token)` antes do `subscribe` no `useEffect` de posição do motorista.
- Nenhuma política existente foi alterada ou removida.
- Bloqueador B3 marcado como resolvido (rastreamento vivo funcional).
- Arquivos tocados: `src/routes/acompanhamento.tsx`, `ZUVVI-FECHAMENTO-CONTROLE.md`, Supabase RLS (via SQL).
