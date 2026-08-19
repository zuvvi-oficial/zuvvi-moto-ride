# Plano: Revisão e Visualização de Documentos Administrativos

Implementação da visualização segura de documentos e fluxo de revisão documental individual dentro da ficha do motorista no painel administrativo.

## Mudanças Técnicas
- **Server-side (src/lib/admin.functions.ts)**:
  - Criar `updateStatusDocumento`: Função protegida para aprovar/recusar um documento específico, validar vínculo com o motorista e registrar auditoria.
  - Ajustar `getMotoristaDetalheAdmin`: Garantir que retorne todos os metadados dos documentos necessários para a listagem (status, motivo recusa, datas).
- **Frontend (src/routes/admin/motoristas.tsx)**:
  - Adicionar estados para o visualizador de documentos (`activeDoc`, `isViewing`, `justificativaDoc`).
  - Implementar a seção **Documentos Enviados** com a listagem dos 6 tipos obrigatórios e seus status reais.
  - Implementar componente visualizador de documentos que suporte Imagens (com zoom/full size) e PDFs (abertura segura).
  - Integrar ações de aprovação e recusa (com modal de justificativa obrigatória) para cada documento individualmente.
  - Adicionar alertas de prontidão (ex: documentos ausentes ou pendentes) para auxiliar na decisão final do administrador.

## Segurança
- Uso exclusivo de URLs assinadas temporárias geradas no servidor.
- Validação de perfil administrativo em todas as operações de escrita e leitura de documentos.
- Registro detalhado de auditoria na tabela `admin_audit_logs` para cada decisão documental.

## Preservação
- Nenhuma alteração em rotas de usuário, passageiro ou motorista.
- Nenhuma alteração em migrations, policies ou configurações de infraestrutura.
- Preservação integral do layout e funcionalidades atuais de aprovação geral do motorista.
