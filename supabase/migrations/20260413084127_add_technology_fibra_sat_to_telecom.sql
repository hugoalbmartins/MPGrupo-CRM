/*
  # Add Fibra/SAT Technology Support for Telecom Operators

  1. Modified Tables
    - `operators`
      - `allowed_technologies` (text[], default '{Fibra}') - technologies this operator supports
      - `sat_commission_mode` (text, nullable) - 'individual' or 'percentage'
      - `sat_commission_percentage` (numeric, nullable) - percentage of Fibra commission for SAT
    - `sales`
      - `technology` (text, default 'Fibra') - technology used in this sale
    - `commission_configurations`
      - `technology` (text, nullable) - technology this config applies to (NULL = Fibra for backward compat)

  2. Data Migration
    - All existing telecom sales default to 'Fibra'
    - All existing commission configs remain NULL (treated as Fibra)

  3. Notes
    - Backward compatible: NULL technology = Fibra
    - Only telecom operators use this feature
    - SAT can use percentage of Fibra commissions or individual commission configs
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'allowed_technologies'
  ) THEN
    ALTER TABLE operators ADD COLUMN allowed_technologies text[] DEFAULT '{Fibra}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'sat_commission_mode'
  ) THEN
    ALTER TABLE operators ADD COLUMN sat_commission_mode text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'sat_commission_percentage'
  ) THEN
    ALTER TABLE operators ADD COLUMN sat_commission_percentage numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'technology'
  ) THEN
    ALTER TABLE sales ADD COLUMN technology text DEFAULT 'Fibra';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_configurations' AND column_name = 'technology'
  ) THEN
    ALTER TABLE commission_configurations ADD COLUMN technology text;
  END IF;
END $$;

UPDATE sales SET technology = 'Fibra' WHERE technology IS NULL AND scope = 'telecomunicacoes';
