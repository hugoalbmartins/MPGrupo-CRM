/*
  # Remove constraints UNIQUE duplicadas e incorretas da tabela commission_configurations

  1. Problema
    - Existem 3 constraints UNIQUE na tabela commission_configurations
    - `commission_configurations_unique_key_v4` NAO inclui min_sales, tier_mode, monthly_value_min/max
      Isso impede a criacao de multiplos patamares (ex: 0 vendas e 5 vendas) para o mesmo servico
    - `commission_configurations_unique_config` e redundante com a constraint completa

  2. Solucao
    - Remove `commission_configurations_unique_key_v4` (causa do erro 409)
    - Remove `commission_configurations_unique_config` (redundante)
    - Mantém `unique_commission_config_complete` que inclui TODOS os campos necessarios

  3. Resultado
    - Agora e possivel ter multiplos patamares de quantidade para o mesmo servico
    - Exemplo: NI (todos), 0 vendas = 2.5x e NI (todos), 5 vendas = 3x
*/

ALTER TABLE commission_configurations 
  DROP CONSTRAINT IF EXISTS commission_configurations_unique_key_v4;

ALTER TABLE commission_configurations 
  DROP CONSTRAINT IF EXISTS commission_configurations_unique_config;
