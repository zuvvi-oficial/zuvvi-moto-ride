# Plan: Corrigir Controles de Nascimento e Estado na Tela "Quase lá!"

Melhorar a experiência do usuário em dispositivos móveis na tela de conclusão de cadastro, substituindo o seletor de data nativo por um componente customizado e corrigindo a rolagem do seletor de estados.

## Proposed Changes

### 1. Seletor de Data de Nascimento
- Criar um novo componente interno em `src/routes/auth.completar-cadastro.tsx` que gerencia três seletores independentes: **Dia**, **Mês** e **Ano**.
- **Lógica de Dias:** Dinâmica baseada no mês e ano selecionados (tratando 28, 29, 30, 31 e anos bissextos).
- **Lógica de Meses:** Lista estática dos 12 meses em português.
- **Lógica de Anos:** Lista decrescente do ano atual até 100 anos atrás, garantindo que datas futuras não sejam permitidas.
- **UI:** Layout responsivo (grid de 3 colunas) com a identidade visual Zuvvi (Indigo/Volt).
- **Integração:** Concatenar os valores no formato `YYYY-MM-DD` para manter compatibilidade com o banco de dados.

### 2. Seletor de Estado (UF)
- Ajustar a configuração do componente `SelectContent` do Radix UI para garantir rolagem vertical fluida em dispositivos móveis.
- Adicionar `max-h-60` ou similar para limitar a altura e forçar a rolagem interna.
- Garantir que a lógica de carregamento de cidades por UF permaneça intacta.

## Technical Details

### Components & Logic
- **Date Conversion:** `(day, month, year) => `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`.
- **Leap Year Check:** `(year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)`.
- **Validation:** O `completionSchema` (Zod) continuará validando a string resultante.
- **Mobile Scrolling:** O uso de `SelectContent` com `overflow-y-auto` e altura definida resolve o problema de rolagem no celular.

### File Impacts
- `src/routes/auth.completar-cadastro.tsx`: Modificação principal para injetar o novo componente de data e ajustar o CSS do seletor de UF.

## User Review Required

> [!IMPORTANT]
> A data de nascimento será enviada ao banco de dados exatamente no mesmo formato `YYYY-MM-DD` que já era utilizado pelo seletor nativo, garantindo que não haja quebras no backend.
