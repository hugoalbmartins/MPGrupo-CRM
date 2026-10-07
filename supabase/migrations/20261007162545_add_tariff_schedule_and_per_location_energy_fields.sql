/*
# Energy: tariff schedule, per-location campaign/DD/FE, default campaign

## Summary
Adds hourly tariff schedule (Simples/Bi-horario/Tri-horario) to energy sales
and per-location settings. Adds campaign, direct debit and electronic invoice
per energy point (for multilocal). Adds is_default flag to operator campaigns
so the default campaign is auto-selected in the sales form picklist.

## Changes to `sales` table
- `tariff_schedule` (text, nullable): 'Simples' | 'Bi-horario' | 'Tri-horario'

## Changes to `sales_energy_points` table
- `tariff_schedule` (text, nullable): per-location tariff schedule
- `campaign` (text, nullable): per-location campaign
- `has_direct_debit` (boolean, default false): per-location direct debit
- `has_electronic_invoice` (boolean, default false): per-location electronic invoice

## Changes to `operators` table
- campaigns array objects now support an `is_default` boolean field (stored in
  the existing jsonb `campaigns` column, no schema change needed)

## Email trigger + edge function
- `trigger_new_sale_alert`: passes `NEW.tariff_schedule` to email function
- `create_new_sale_alert_with_email`: accepts and forwards `p_tariff_schedule`
- Edge function template: shows tariff schedule and per-location campaign/DD/FE

## Notes
- All new columns are nullable/default false — no data loss for existing rows
- Tri-horario is auto-selected when power > 20.7kVA (enforced in frontend)
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'tariff_schedule') THEN
    ALTER TABLE sales ADD COLUMN tariff_schedule text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_energy_points' AND column_name = 'tariff_schedule') THEN
    ALTER TABLE sales_energy_points ADD COLUMN tariff_schedule text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_energy_points' AND column_name = 'campaign') THEN
    ALTER TABLE sales_energy_points ADD COLUMN campaign text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_energy_points' AND column_name = 'has_direct_debit') THEN
    ALTER TABLE sales_energy_points ADD COLUMN has_direct_debit boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_energy_points' AND column_name = 'has_electronic_invoice') THEN
    ALTER TABLE sales_energy_points ADD COLUMN has_electronic_invoice boolean DEFAULT false;
  END IF;
END $$;
