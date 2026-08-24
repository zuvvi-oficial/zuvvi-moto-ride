# Plano: Central Administrativa de Suporte Zuvvi (Triagem)

Implementação do módulo administrativo para visualização e triagem de chamados de suporte, utilizando a estrutura de dados existente e seguindo a identidade visual premium.

## Ações Realizadas (Fase Inicial)
- [x] Criado `src/lib/suporte.functions.ts` para leitura segura de chamados via Server Function.
- [x] Criado `src/routes/admin/suporte.tsx` com a estrutura base, indicadores e lista de cards.
- [x] Adicionado botão de acesso à Central de Suporte no Dashboard Administrativo (`/admin`).

## Próximos Passos (Refinamento Premium)
1. **Filtros Avançados**: Implementar a barra de busca e seletores de status/cidade no cabeçalho.
2. **Ficha Detalhada (Mobile Full-screen)**: Criar o componente de visualização do chamado que abre em tela cheia no mobile, exibindo dados do usuário, corrida e descrição.
3. **Destaque SOS**: Aplicar tratamento visual diferenciado (borda pulsante suave ou fundo matizado) para chamados do tipo SOS.
4. **Estado Vazio**: Adicionar ilustração e texto profissional para quando não houver chamados.

## Detalhes Técnicos
- **Segurança**: Acesso restrito via `checkAdmin` (middleware Supabase Auth + Verificação de papel admin).
- **Banco de Dados**: Leitura direta da tabela `chamados_suporte`.
- **UI/UX**: Uso de Tailwind CSS, Lucide Icons e Shadcn UI.
- **Responsividade**: Layout adaptável testado para 375px (iPhone), 768px (iPad) e Desktop.

## Invariantes (Core Mantido)
- Nenhuma alteração em `admin.functions.ts` ou tabelas existentes.
- Sem migrações de banco ou mudanças em RLS.
- Sem ações de escrita nesta etapa (somente leitura e triagem).
