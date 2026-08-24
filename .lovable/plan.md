# Plano: Perfil do Passageiro Premium e Gestão de Carteira (Fase 1)

Este plano foca na implementação da tela de **Perfil do Passageiro** com design Asphalt & Amber e na estruturação visual da **Carteira**, preparando o terreno para as funcionalidades financeiras.

## Alterações Funcionais

### Perfil do Passageiro
- Criar a rota `/perfil` (passageiro) com visual premium.
- Exibir dados do usuário: nome, CPF (mascarado), celular e e-mail.
- Permitir edição de nome e celular (com validação e máscara).
- Implementar botão de logout e link para exclusão de conta (LGPD).
- Adicionar selo de fidelidade baseado na data de cadastro.

### Carteira (Wallet)
- Criar a rota `/carteira` com interface de saldo e histórico.
- Exibir saldo virtual do usuário (Mock inicial, preparando para integração real).
- Listar transações recentes vinculadas ao histórico de corridas.
- Adicionar botões de ação: "Adicionar Saldo" e "Métodos de Pagamento".

## Detalhes Técnicos

### Backend & Segurança
- **Server Functions**:
  - `getPerfilPassageiro`: Busca dados higienizados do usuário logado.
  - `updatePerfilPassageiro`: Atualiza nome e celular com validação Zod.
  - `getSaldoCarteira`: Consulta o saldo atual na tabela `usuarios`.
- **Zod Schemas**: Validação rigorosa para formatos de celular e comprimentos de nome.

### UI/UX (Asphalt & Amber)
- Uso de `ZuvviLogo` com acabamento `surface="dark"`.
- Cartões com `backdrop-blur-xl` e bordas `white/10`.
- Tipografia Poppins com pesos variados para hierarquia.
- Componentes Shadcn UI customizados para o tema Indigo/Volt.

### Estrutura de Arquivos
- `src/routes/perfil.tsx`: Nova rota de perfil.
- `src/routes/carteira.tsx`: Nova rota de carteira.
- `src/lib/perfil-user.functions.ts`: Funções de servidor para gestão de usuário.
- `src/components/perfil/EditProfileDialog.tsx`: Modal premium para edição.
