# P1B — Resumo da implementação

A P1B adiciona uma verificação complementar de disponibilidade de mototaxistas para a Home do passageiro.

Arquivos funcionais envolvidos:
- `src/lib/passageiro-disponibilidade.functions.ts`
- `src/components/passageiro/PassengerDriverAvailabilityGate.tsx`
- `src/routes/__root.tsx` (somente import e montagem do gate)

Nenhuma migration, RLS, política, tarifa, Pix, Mercado Pago, criação/aceite de corrida ou máquina de estados foi alterada.

O gate só bloqueia a Home quando a cidade já está liberada pela P1 e não há mototaxista operacionalmente elegível disponível. Corridas, Carteira e Perfil permanecem acessíveis pelo menu inferior.
