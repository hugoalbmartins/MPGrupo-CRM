# Guia: Implementar Contagem por Unidade para Comissões e Objetivos

## Objetivo
Fazer com que cada CPE/CUI conte como uma unidade separada para fins de comissões e objetivos, em vez de contar a venda inteira como 1 unidade.

## Funções Helper Criadas

Foram adicionadas duas funções em `/src/lib/utils-crm.js`:

### 1. getSaleUnitCount(sale)
Retorna o número de unidades de uma venda:
- Se `is_multipoint === true` e `multipoint_count > 0`: retorna `multipoint_count`
- Caso contrário: retorna `1`

```javascript
// Exemplo de uso
const sale = { id: '123', is_multipoint: true, multipoint_count: 5 };
const units = getSaleUnitCount(sale); // retorna 5

const simpleSale = { id: '456', is_multipoint: false };
const simpleUnits = getSaleUnitCount(simpleSale); // retorna 1
```

### 2. getTotalUnitsFromSales(sales)
Retorna o total de unidades de um array de vendas:

```javascript
// Exemplo de uso
const sales = [
  { id: '1', is_multipoint: true, multipoint_count: 3 },
  { id: '2', is_multipoint: false },
  { id: '3', is_multipoint: true, multipoint_count: 2 },
];
const totalUnits = getTotalUnitsFromSales(sales); // retorna 6 (3 + 1 + 2)
```

## Ficheiros a Modificar

### 1. `/src/services/dashboardService.js`

#### Localização: Linha 278
```javascript
// ANTES
const stats = {
  total_sales: sales?.length || 0,
  // ...
};

// DEPOIS
import { getTotalUnitsFromSales } from '../lib/utils-crm';

const stats = {
  total_sales: getTotalUnitsFromSales(sales),
  // ...
};
```

#### Localizações Adicionais a Atualizar no mesmo ficheiro:
- Linha 400: `total_sales: sales?.length || 0`
- Linha 466: `total_sales: sales?.length || 0`
- Linha 543: `total_sales: sales?.length || 0`
- Linha 701: `total_sales: sales?.length || 0`

#### Contagens Específicas de Energia (Linhas 658-673)
```javascript
// ANTES
const electricityCount = operatorSales.filter(
  s => s.scope === 'energia' && (s.energy_sale_type === 'eletricidade' || s.energy_sale_type === 'dual')
).length;

const gasCount = operatorSales.filter(
  s => s.scope === 'energia' && (s.energy_sale_type === 'gas' || s.energy_sale_type === 'dual')
).length;

// DEPOIS
import { getTotalUnitsFromSales } from '../lib/utils-crm';

const electricitySales = operatorSales.filter(
  s => s.scope === 'energia' && (s.energy_sale_type === 'eletricidade' || s.energy_sale_type === 'dual')
);
const electricityCount = getTotalUnitsFromSales(electricitySales);

const gasSales = operatorSales.filter(
  s => s.scope === 'energia' && (s.energy_sale_type === 'gas' || s.energy_sale_type === 'dual')
);
const gasCount = getTotalUnitsFromSales(gasSales);
```

### 2. `/src/pages/Dashboard.jsx`

Procurar por qualquer uso de `.length` em contagens de vendas e substituir por `getTotalUnitsFromSales()`.

### 3. `/src/pages/CommissionReports.jsx`

Se houver contagens de vendas, atualizar para usar as funções helper.

### 4. `/src/pages/Objectives.jsx`

Atualizar cálculos de progresso de objetivos para considerar unidades multi-ponto.

### 5. Cálculo de Comissões

#### Opção A: Cada Unidade com Comissão Individual (Recomendado)

Se cada CPE/CUI deve ter sua própria comissão calculada separadamente:

1. Modificar `calculateCommission()` em `/src/lib/utils-crm.js` para aceitar um contador de unidades
2. Ao criar venda, calcular comissão multiplicada pelo número de pontos
3. Armazenar comissão total na venda

```javascript
// Exemplo
const unitCommission = await calculateCommission(operator, saleData, supabase);
const totalCommission = unitCommission * (saleData.multipoint_count || 1);
```

#### Opção B: Comissão Total Dividida por Unidade

Se a comissão já está calculada para a venda toda:

1. Manter cálculo como está
2. Apenas atualizar contagens para dashboards e objetivos

## Padrão de Substituição

### Antes (Incorreto para Multi-Ponto)
```javascript
// Conta vendas
const totalSales = sales.length;

// Filtra e conta
const energySales = sales.filter(s => s.scope === 'energia').length;

// Loop para contar
let count = 0;
for (const sale of sales) {
  count++;
}
```

### Depois (Correto para Multi-Ponto)
```javascript
import { getTotalUnitsFromSales, getSaleUnitCount } from '../lib/utils-crm';

// Conta unidades
const totalSales = getTotalUnitsFromSales(sales);

// Filtra e conta unidades
const energySales = getTotalUnitsFromSales(
  sales.filter(s => s.scope === 'energia')
);

// Loop para contar unidades
let count = 0;
for (const sale of sales) {
  count += getSaleUnitCount(sale);
}
```

## Query SQL para Contagem

Se houver queries SQL diretas, usar:

```sql
-- ANTES
SELECT COUNT(*) as total
FROM sales
WHERE ...

-- DEPOIS
SELECT
  SUM(
    CASE
      WHEN is_multipoint THEN multipoint_count
      ELSE 1
    END
  ) as total
FROM sales
WHERE ...
```

## Teste de Validação

Após implementar as mudanças:

1. Criar venda simples de energia (1 CPE)
   - Verificar dashboard mostra 1 unidade
   - Verificar objetivo aumenta em 1

2. Criar venda multi-ponto com 3 CPE
   - Verificar dashboard mostra 3 unidades
   - Verificar objetivo aumenta em 3
   - Verificar comissão calculada corretamente (3x se comissão por unidade)

3. Exportar Excel
   - Verificar 3 linhas criadas (uma por CPE)
   - Verificar comissão distribuída corretamente

## Prioridade de Implementação

1. ✅ **Alta**: Funções helper criadas (já feito)
2. **Alta**: Dashboard - contagens de vendas totais
3. **Alta**: Objetivos - progresso e contagens
4. **Média**: Relatórios de comissões
5. **Média**: Gráficos e métricas secundárias
6. **Baixa**: Filtros e pesquisas (se aplicável)

## Observações Importantes

- As funções helper lidam automaticamente com vendas antigas (sem is_multipoint)
- Vendas de telecomunicações sempre contam como 1 (não são multi-ponto)
- Apenas vendas de energia podem ser multi-ponto
- Campo `multipoint_count` é atualizado automaticamente por trigger na BD

## Exemplo Completo: Atualizar Dashboard Stats

```javascript
// Ficheiro: /src/services/dashboardService.js

// No topo do ficheiro
import { getTotalUnitsFromSales, getSaleUnitCount } from '../lib/utils-crm';

// Na função getPartnerDashboard (linha ~275)
const stats = {
  total_sales: getTotalUnitsFromSales(sales), // ✅ Mudança aqui
  total_partners: partnerCount || 0,
  telecomunicacoes: { count: 0, monthly_total: 0 },
  energia: { count: 0, electricity: 0, gas: 0, dual: 0 },
  solar: { count: 0 },
  // ...
};

// Loop de processamento - manter como está
sales.forEach(sale => {
  const units = getSaleUnitCount(sale); // ✅ Obter unidades

  if (sale.scope === 'telecomunicacoes') {
    stats.telecomunicacoes.count += units; // ✅ Usar units em vez de incrementar
    // ...
  } else if (sale.scope === 'energia') {
    stats.energia.count += units; // ✅ Usar units

    if (sale.energy_sale_type === 'eletricidade') {
      stats.energia.electricity += units; // ✅ Usar units
    } else if (sale.energy_sale_type === 'gas') {
      stats.energia.gas += units; // ✅ Usar units
    } else if (sale.energy_sale_type === 'dual') {
      stats.energia.dual += units; // ✅ Usar units
    }
  }
  // ...
});
```

## Commit Message Sugerida

```
feat: Add multi-point unit counting for commissions and objectives

- Created helper functions getSaleUnitCount() and getTotalUnitsFromSales()
- Updated dashboard statistics to count multi-point units correctly
- Modified objectives progress calculation for multi-point sales
- Updated commission reports to reflect individual unit counts
- Ensures each CPE/CUI in multi-point sales counts as separate unit

Refs: MULTIPOINT-IMPLEMENTATION
```
