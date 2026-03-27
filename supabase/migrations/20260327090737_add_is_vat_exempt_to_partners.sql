/*
  # Add VAT Exemption flag to partners

  ## Summary
  Adds an `is_vat_exempt` boolean column to the `partners` table.

  ## Changes
  - `partners` table: new column `is_vat_exempt` (boolean, default false)
    - When true, commission reports (autos) for this partner will NOT display the IVA (23%)
      and Total com IVA lines — only the base totals, retentions, refunds, and chargebacks are shown.

  ## Notes
  - Safe migration: uses IF NOT EXISTS pattern
  - No existing data is affected (all partners default to NOT exempt)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'is_vat_exempt'
  ) THEN
    ALTER TABLE partners ADD COLUMN is_vat_exempt boolean NOT NULL DEFAULT false;
  END IF;
END $$;
