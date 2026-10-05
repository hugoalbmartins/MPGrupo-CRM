/*
# Add dual energy individual activation tracking

## Summary
For dual energy sales (electricity + gas), allows tracking activation status and date
independently for each component (luz and gas).

## Changes to `sales` table
- `electricity_activated` (boolean, default false): Whether the electricity component is activated
- `gas_activated` (boolean, default false): Whether the gas component is activated
- `electricity_activation_date` (date, nullable): Activation date for electricity component
- `gas_activation_date` (date, nullable): Activation date for gas component

## Notes
- These fields are only relevant for dual energy sales (energy_sale_type = 'dual')
- For non-dual sales, the existing `activation_date` field continues to be used
- Existing dual sales with activation_date will have both components marked as activated
  with the same date for backward compatibility
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'electricity_activated') THEN
    ALTER TABLE sales ADD COLUMN electricity_activated boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'gas_activated') THEN
    ALTER TABLE sales ADD COLUMN gas_activated boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'electricity_activation_date') THEN
    ALTER TABLE sales ADD COLUMN electricity_activation_date date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'gas_activation_date') THEN
    ALTER TABLE sales ADD COLUMN gas_activation_date date;
  END IF;
END $$;

-- Backfill: for existing dual sales that are Ativo with an activation_date, set both components
UPDATE sales
SET electricity_activated = true,
    gas_activated = true,
    electricity_activation_date = activation_date,
    gas_activation_date = activation_date
WHERE energy_sale_type = 'dual'
  AND status = 'Ativo'
  AND activation_date IS NOT NULL;
