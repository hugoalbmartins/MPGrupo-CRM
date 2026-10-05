/*
# Enhance chargeback: dual type, activation tracking, one-per-sale constraint

## Summary
Enhances the chargebacks table to support:
1. Individual chargebacks for dual energy sales (electricity, gas, or both)
2. Activation indication and date on the chargeback
3. Enforcing a maximum of one chargeback per sale

## Changes to `chargebacks` table
- `chargeback_type` (text, default 'full'): Type of chargeback — 'full' (entire sale),
  'electricity' (luz only), 'gas' (gas only), 'both' (luz + gas independently tracked)
- `activation_indication` (text, nullable): Whether the sale was activated — 'activated', 'not_activated', or null
- `activation_date` (date, nullable): Date of activation if known at chargeback time

## Unique constraint
- Adds unique constraint on `sale_id` to enforce one chargeback per sale.
  Existing duplicate chargebacks (if any) are collapsed by keeping the most recent.

## Notes
- Existing chargebacks default to 'full' type and null activation fields (unchanged behavior)
- The unique constraint is added after deduplication to avoid constraint violations
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chargebacks' AND column_name = 'chargeback_type') THEN
    ALTER TABLE chargebacks ADD COLUMN chargeback_type text DEFAULT 'full';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chargebacks' AND column_name = 'activation_indication') THEN
    ALTER TABLE chargebacks ADD COLUMN activation_indication text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chargebacks' AND column_name = 'activation_date') THEN
    ALTER TABLE chargebacks ADD COLUMN activation_date date;
  END IF;
END $$;

-- Deduplicate: keep only the most recent chargeback per sale_id
DELETE FROM chargebacks
WHERE id NOT IN (
  SELECT DISTINCT ON (sale_id) id
  FROM chargebacks
  ORDER BY sale_id, created_at DESC
);

-- Add unique constraint: one chargeback per sale
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chargebacks_sale_id_unique'
  ) THEN
    ALTER TABLE chargebacks ADD CONSTRAINT chargebacks_sale_id_unique UNIQUE (sale_id);
  END IF;
END $$;
