# Resumo da Correção de Comissões

## Problemas Identificados

### 1. Venda PAR00130126 (Energia - Endesa)
- **Problema**: Comissão calculada como €0.00
- **Causa Raiz**: Faltava o campo `energy_sale_type` na venda
- **Solução**: O sistema agora infere automaticamente o `energy_sale_type` como "eletricidade" quando não definido para vendas de energia

### 2. Comissões de REFID não aparecem
- **Problema**: Comissões calculadas para vendas REFID não eram exibidas
- **Causa**: A tabela mostrava corretamente as comissões através do código:
  ```javascript
  const commission = sale.manual_commission || sale.calculated_commission;
  ```
- **Verificação**: O código de exibição está correto em `/src/pages/Sales.jsx:1581-1583`

### 3. Múltiplas vendas sem comissão calculada
- **Problema**: 55 vendas de energia sem `energy_sale_type` definido
- **Impacto**: Sistema não conseguia encontrar configuração de comissão adequada

## Soluções Implementadas

### 1. Sistema de Recálculo Automático

#### Edge Function: `recalculate-commissions`
- **Localização**: `/supabase/functions/recalculate-commissions/index.ts`
- **Funcionalidade**:
  - Processa todas as vendas no sistema
  - Ignora vendas com comissão manual
  - Ignora operadoras com modo manual
  - Infere `energy_sale_type` quando faltante
  - Calcula comissão usando lógica REFID (usa `contracted_monthly_fee`)
  - Atualiza apenas vendas com comissões diferentes

#### Serviço Frontend
- **Localização**: `/src/services/commissionRecalculator.js`
- **Funcionalidade**: Chama a edge function para recálculo

### 2. Interface de Usuário

#### Botão "Recalcular Comissões"
- **Localização**: Página de Vendas (apenas para Admin/Backoffice)
- **Visual**: Botão roxo com ícone ArrowUpDown
- **Funcionalidade**:
  - Exibe confirmação antes de executar
  - Mostra toast com progresso
  - Exibe resumo (atualizadas, ignoradas, falharam)
  - Recarrega a lista de vendas após conclusão

### 3. Lógica de Cálculo Aprimorada

#### Cálculo para REFID
```javascript
if ((saleData.service_type === 'REFID' || saleData.service_type === 'Refid')
    && saleData.contracted_monthly_fee) {
  monthlyValue = parseFloat(saleData.contracted_monthly_fee);
}
```

#### Inferência Automática de energy_sale_type
```javascript
if (sale.scope === 'energia' && !energySaleType) {
  if (operator.energy_type) {
    energySaleType = operator.energy_type;
  } else {
    energySaleType = 'eletricidade';
  }
}
```

## Como Usar

### Para Recalcular Todas as Comissões:

1. Acesse a página de Vendas
2. Clique no botão "Recalcular Comissões" (apenas Admin/Backoffice)
3. Confirme a operação
4. Aguarde o processamento (pode levar alguns minutos)
5. Verifique o resumo exibido

### Resultado Esperado:

O sistema processará todas as vendas e:
- **Atualizadas**: Vendas cuja comissão foi recalculada e alterada
- **Ignoradas**: Vendas com comissão manual ou já com valor correto
- **Falharam**: Vendas que tiveram erro no processamento

## Casos Especiais

### Vendas com Comissão Manual
- Não são alteradas pelo recálculo
- Sistema preserva o valor definido manualmente

### Operadoras com Modo Manual
- Vendas dessas operadoras são ignoradas
- Administradores devem definir comissão manualmente

### Vendas de Energia sem energy_sale_type
- Sistema infere automaticamente como "eletricidade"
- Usa energy_type da operadora se disponível
- Atualiza o campo no banco de dados

## Arquivos Modificados

1. `/src/lib/utils-crm.js` - Lógica de cálculo REFID
2. `/src/services/salesService.js` - Adiciona campos refid ao insert
3. `/src/services/commissionRecalculator.js` - Serviço de recálculo
4. `/src/pages/Sales.jsx` - Botão de recálculo na UI
5. `/supabase/functions/recalculate-commissions/index.ts` - Edge function

## Scripts Disponíveis

### Script Node.js (backup)
- **Localização**: `/recalculate-commissions-now.js`
- **Uso**: `node recalculate-commissions-now.js`
- **Nota**: Script de backup, a edge function é a forma recomendada

## Observações Importantes

- O recálculo é seguro e não altera comissões manuais
- Todas as operações são registradas no console
- O sistema exibe resumo detalhado após conclusão
- Recomenda-se executar o recálculo após importações em massa
- A operação pode ser executada quantas vezes necessário
