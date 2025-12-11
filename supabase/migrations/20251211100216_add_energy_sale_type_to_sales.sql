/*
  # Adicionar campo energy_sale_type à tabela sales

  ## Alterações
  1. Adiciona coluna `energy_sale_type` à tabela `sales`
     - Tipo: text
     - Valores permitidos: 'eletricidade', 'gas', 'dual'
     - Usado para indicar o tipo de venda quando a operadora vende múltiplos tipos de energia

  ## Notas
  - Este campo é especialmente importante para operadoras que vendem ambos (eletricidade e gás)
  - Permite diferenciar se uma venda específica é apenas eletricidade, apenas gás, ou dual (ambos)
  - Para contabilização de patamares:
    * Vendas de tipo 'eletricidade' contam para patamares de eletricidade
    * Vendas de tipo 'gas' contam para patamares de gás
    * Vendas de tipo 'dual' contam TANTO para patamares de eletricidade QUANTO para patamares de gás
*/

-- Adicionar coluna energy_sale_type à tabela sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'energy_sale_type'
  ) THEN
    ALTER TABLE sales ADD COLUMN energy_sale_type text CHECK (energy_sale_type IN ('eletricidade', 'gas', 'dual'));
  END IF;
END $$;
