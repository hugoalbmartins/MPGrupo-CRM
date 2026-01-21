/*
  # Adicionar campos para REFID (Refidelização)

  1. Alterações
    - Adiciona campo `current_monthly_fee` (numeric) à tabela `sales`
      - Valor da mensalidade atual do cliente antes da refidelização
    - Adiciona campo `contracted_monthly_fee` (numeric) à tabela `sales`
      - Valor da mensalidade contratada após a refidelização
    - Campos opcionais usados apenas para vendas do tipo REFID

  2. Notas
    - Estes campos permitem rastrear downsell/upsell em vendas de refidelização
    - A comissão é calculada com base no contracted_monthly_fee
*/

-- Adicionar campos de mensalidade REFID à tabela sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'current_monthly_fee'
  ) THEN
    ALTER TABLE sales ADD COLUMN current_monthly_fee numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'contracted_monthly_fee'
  ) THEN
    ALTER TABLE sales ADD COLUMN contracted_monthly_fee numeric(10,2);
  END IF;
END $$;

-- Adicionar comentários aos campos
COMMENT ON COLUMN sales.current_monthly_fee IS 'Mensalidade atual do cliente antes da refidelização (REFID)';
COMMENT ON COLUMN sales.contracted_monthly_fee IS 'Mensalidade contratada após refidelização (REFID)';
