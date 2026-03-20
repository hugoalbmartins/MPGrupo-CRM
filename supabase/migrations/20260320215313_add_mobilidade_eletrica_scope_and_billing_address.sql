/*
  # Add Mobilidade Eletrica scope and billing_address to sales

  1. Changes
    - Add `billing_address` column to `sales` table (optional billing address, separate from installation address)
    - Add `ev_outlet_count` column: number of EV charging outlets installed
    - Add `ev_monthly_fee` column: negotiated monthly fee for EV charging
    - Add `ev_margin` column: negotiated margin percentage (optional)
    - Add `ev_fidelization_months` column: fidelization period in months

  2. Notes
    - The "mobilidade_eletrica" scope reuses the existing `scope` field (type text)
    - `billing_address` is available for all scopes (when empty, email shows "Mesma")
    - EV-specific fields are only filled for mobilidade_eletrica sales
    - All new columns are nullable with sensible defaults
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'billing_address'
  ) THEN
    ALTER TABLE sales ADD COLUMN billing_address text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'ev_outlet_count'
  ) THEN
    ALTER TABLE sales ADD COLUMN ev_outlet_count integer DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'ev_monthly_fee'
  ) THEN
    ALTER TABLE sales ADD COLUMN ev_monthly_fee numeric(10,2) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'ev_margin'
  ) THEN
    ALTER TABLE sales ADD COLUMN ev_margin numeric(5,2) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'ev_fidelization_months'
  ) THEN
    ALTER TABLE sales ADD COLUMN ev_fidelization_months integer DEFAULT NULL;
  END IF;
END $$;
