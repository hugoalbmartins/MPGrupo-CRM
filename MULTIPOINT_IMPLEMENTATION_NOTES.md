# Sistema de Vendas Multi-Ponto de Energia - Notas de Implementação

## Data: 2026-01-04

## Resumo
Implementado sistema completo para suportar vendas de energia com múltiplos CPE (Código do Ponto de Entrega) e CUI (Código Universal de Instalação).

## Funcionalidades Implementadas

### 1. Base de Dados
- ✅ Nova tabela `sales_energy_points` criada
- ✅ Campos adicionados à tabela `sales`:
  - `is_multipoint` (boolean) - Indica se é venda multi-ponto
  - `multipoint_count` (integer) - Contagem automática de pontos
- ✅ Triggers automáticos para atualizar contadores
- ✅ Políticas RLS completas para segurança
- ✅ Índices para performance

### 2. Interface de Utilizador
- ✅ Novo componente `EnergyPointsManager.jsx`
- ✅ Checkbox para ativar modo multi-ponto
- ✅ Seletor de quantidade de pontos
- ✅ Gestão dinâmica de múltiplos pontos CPE/CUI
- ✅ Cada ponto pode ter:
  - CPE + Potência (para eletricidade)
  - CUI + Escalão (para gás)
  - Estado de ativação independente
  - Data de ativação independente
  - Flag "pago pelo operador" independente
- ✅ Validação completa de campos obrigatórios

### 3. Serviço de Dados
- ✅ Novo serviço `energyPointsService.js`
- ✅ Métodos CRUD completos para pontos de energia
- ✅ Integração com criação/edição de vendas

### 4. Exportação Excel
- ✅ Exportação gera uma linha por CPE/CUI
- ✅ Informação completa de cada ponto incluída
- ✅ Campos específicos:
  - Ponto (ex: "1/3" para ponto 1 de 3)
  - Tipo Ponto (CPE ou CUI)
  - Estado Ativação
  - Data Ativação
  - Pago Operador (por ponto)

### 5. Listagem de Vendas
- ✅ Vendas multi-ponto aparecem como linha única
- ✅ Informação agregada visível
- ✅ Detalhes completos acessíveis na edição

## Comportamento do Sistema

### Criação de Venda
1. Utilizador seleciona operadora de energia
2. Sistema pergunta se é multi-ponto
3. Se sim, utilizador indica quantos pontos (CPE/CUI)
4. Sistema abre formulário dinâmico para cada ponto
5. Dados do primeiro ponto são guardados nos campos legados (retrocompatibilidade)
6. Todos os pontos são guardados na tabela `sales_energy_points`

### Contagem para Comissões e Objetivos
**NOTA IMPORTANTE**: O sistema multi-ponto está funcional mas a contagem para comissões e objetivos ainda usa a venda como unidade única, não conta cada CPE/CUI individualmente.

### Próximos Passos Necessários

#### Comissões e Objetivos
Para que cada CPE/CUI conte como unidade individual, é necessário:

1. **Identificar Pontos de Cálculo**
   - Localizar onde as comissões são calculadas
   - Localizar onde os objetivos são contabilizados
   - Verificar se há queries SQL ou código que faz estas contagens

2. **Modificar Lógica de Contagem**
   - Em vez de contar 1 venda = 1 unidade
   - Contar vendas multi-ponto: quantidade = `multipoint_count` ou número de registos em `sales_energy_points`
   - Para vendas não multi-ponto: quantidade = 1 (comportamento atual)

3. **Áreas Prováveis a Modificar**
   - Dashboard (métricas de vendas)
   - Relatórios de comissões
   - Páginas de objetivos
   - Qualquer query que faça `COUNT(*)` de vendas

4. **Query Exemplo**
   ```sql
   -- Em vez de:
   SELECT COUNT(*) as total_sales FROM sales WHERE ...

   -- Usar:
   SELECT
     SUM(CASE
       WHEN is_multipoint THEN multipoint_count
       ELSE 1
     END) as total_units
   FROM sales WHERE ...
   ```

## Estrutura de Dados

### Tabela: sales_energy_points
```sql
- id (uuid)
- sale_id (uuid, FK -> sales)
- point_type ('cpe' | 'cui')
- point_code (text) - Código CPE ou CUI
- power_kva (numeric) - Potência (apenas CPE)
- tier (text) - Escalão (apenas CUI)
- activation_status ('pending' | 'active' | 'cancelled' | 'rejected')
- activation_date (date)
- operator_paid (boolean)
- created_at, updated_at (timestamptz)
```

## Ficheiros Modificados
- `/src/components/EnergyPointsManager.jsx` (novo)
- `/src/services/energyPointsService.js` (novo)
- `/src/pages/Sales.jsx` (modificado)
- `/supabase/migrations/20260104XXXXXX_add_energy_multipoint_system_v2.sql` (novo)

## Compatibilidade
- ✅ Totalmente retrocompatível
- ✅ Vendas antigas continuam a funcionar normalmente
- ✅ Campos legados (cpe, power, cui, tier) mantidos para retrocompatibilidade
- ✅ Sistema identifica automaticamente vendas multi-ponto pelo campo `is_multipoint`

## Testes Recomendados
1. ✅ Criar venda simples de energia (1 CPE)
2. ⏳ Criar venda multi-ponto (múltiplos CPE)
3. ⏳ Criar venda dual multi-ponto (múltiplos CPE + CUI)
4. ⏳ Exportar vendas multi-ponto para Excel
5. ⏳ Verificar contagem nos dashboards (quando implementado)
6. ⏳ Editar venda multi-ponto existente
7. ⏳ Verificar cálculo de comissões com multi-ponto

## Segurança
- ✅ Políticas RLS aplicadas em `sales_energy_points`
- ✅ Apenas utilizadores autorizados podem ver/editar pontos
- ✅ Validação de permissões baseada na venda associada
- ✅ Cascading delete quando venda é apagada

## Performance
- ✅ Índices criados para queries rápidas
- ✅ Triggers otimizados para atualização automática
- ✅ Queries eficientes na exportação Excel
