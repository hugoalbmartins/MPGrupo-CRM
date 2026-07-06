/*
# Add multiply_without_vat option to commission configurations

1. Modified Tables
   - `commission_configurations`
     - Added `multiply_without_vat` (boolean, default false) - When true and commission_mode is 'monthly_multiplier', the monthly value will be divided by 1.23 (removing 23% VAT) before applying the multiplier. Default false means all existing configs use the registered value with VAT (C/IVA).

2. Important Notes
   - All existing configurations default to false (C/IVA - with VAT), preserving current behavior.
   - Only applies when commission_mode = 'monthly_multiplier'.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_configurations' AND column_name = 'multiply_without_vat'
  ) THEN
    ALTER TABLE commission_configurations ADD COLUMN multiply_without_vat boolean NOT NULL DEFAULT false;
  END IF;
END $$;
