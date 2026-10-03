/*
# Add portability commission fields and M1/Movel activation types

## Summary
This migration adds support for:
1. Portability commissions on operators (fixed, mobile, or both)
2. Portability commission values per tier in commission_configurations
3. M1 and Movel activation types for telecom operators

## Changes to `operators` table
- `pays_fix_portability` (boolean, default false): operator pays for fixed-line portabilities
- `pays_mobile_portability` (boolean, default false): operator pays for mobile portabilities
- `portability_payment_type` (text, default null): 'fix', 'mobile', 'both', or null

## Changes to `commission_configurations` table
- `fix_portability_bonus` (numeric, default 0): bonus per fixed-line portability
- `mobile_portability_bonus` (numeric, default 0): bonus per mobile portability

## Notes
- The save_commission_configs RPC is updated to accept the new portability fields
- Existing data is not affected; new columns default to 0/false
- M1 and Movel are already valid activation_type text values (no constraint change needed)
*/

-- Add portability payment columns to operators
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operators' AND column_name = 'pays_fix_portability') THEN
    ALTER TABLE operators ADD COLUMN pays_fix_portability boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operators' AND column_name = 'pays_mobile_portability') THEN
    ALTER TABLE operators ADD COLUMN pays_mobile_portability boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operators' AND column_name = 'portability_payment_type') THEN
    ALTER TABLE operators ADD COLUMN portability_payment_type text DEFAULT null;
  END IF;
END $$;

-- Add portability commission columns to commission_configurations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commission_configurations' AND column_name = 'fix_portability_bonus') THEN
    ALTER TABLE commission_configurations ADD COLUMN fix_portability_bonus numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commission_configurations' AND column_name = 'mobile_portability_bonus') THEN
    ALTER TABLE commission_configurations ADD COLUMN mobile_portability_bonus numeric DEFAULT 0;
  END IF;
END $$;

-- Update save_commission_configs RPC to include portability fields
CREATE OR REPLACE FUNCTION save_commission_configs(p_operator_id uuid, p_configs jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    config_record jsonb;
    config_id uuid;
    dedup_key text;
    seen_keys text[] := '{}';
    service_types_arr text[];
    has_refid boolean;
    has_ni_mc boolean;
BEGIN
    DELETE FROM commission_configurations WHERE operator_id = p_operator_id;

    FOR config_record IN SELECT * FROM jsonb_array_elements(p_configs)
    LOOP
        service_types_arr := COALESCE(
            CASE
                WHEN jsonb_typeof(config_record->'service_types') = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(config_record->'service_types'))
                ELSE NULL
            END,
            CASE
                WHEN config_record->>'service_type' IS NOT NULL
                THEN ARRAY[config_record->>'service_type']
                ELSE NULL
            END
        );

        has_refid := COALESCE(service_types_arr @> ARRAY['REFID']::text[], false) OR COALESCE(service_types_arr @> ARRAY['Refid']::text[], false);
        has_ni_mc := COALESCE(service_types_arr @> ARRAY['NI']::text[], false) OR COALESCE(service_types_arr @> ARRAY['MC']::text[], false);

        INSERT INTO commission_configurations (
            id,
            operator_id,
            service_type,
            service_types,
            commission_mode,
            commission_value,
            partner_type,
            client_type,
            min_sales,
            has_retention,
            retention_percentage,
            retention_months,
            direct_debit_bonus,
            electronic_invoice_bonus,
            fix_portability_bonus,
            mobile_portability_bonus,
            tier_mode,
            monthly_value_min,
            monthly_value_max,
            refid_operation_type,
            activation_type,
            d2d_level,
            rev_level,
            power_value,
            additional_service_name,
            technology,
            from_email,
            from_smtp_pass,
            multiply_without_vat,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            p_operator_id,
            config_record->>'service_type',
            service_types_arr,
            COALESCE(config_record->>'commission_mode', 'fixed_value'),
            COALESCE((config_record->>'commission_value')::numeric, 0),
            COALESCE(config_record->>'partner_type', 'D2D'),
            config_record->>'client_type',
            COALESCE((config_record->>'min_sales')::integer, 0),
            COALESCE((config_record->>'has_retention')::boolean, false),
            COALESCE((config_record->>'retention_percentage')::numeric, 0),
            COALESCE((config_record->>'retention_months')::integer, 0),
            COALESCE((config_record->>'direct_debit_bonus')::numeric, 0),
            COALESCE((config_record->>'electronic_invoice_bonus')::numeric, 0),
            COALESCE((config_record->>'fix_portability_bonus')::numeric, 0),
            COALESCE((config_record->>'mobile_portability_bonus')::numeric, 0),
            COALESCE(config_record->>'tier_mode', 'by_quantity'),
            COALESCE((config_record->>'monthly_value_min')::numeric, 0),
            COALESCE((config_record->>'monthly_value_max')::numeric, 0),
            CASE WHEN has_refid THEN COALESCE(config_record->>'refid_operation_type', 'both') ELSE NULL END,
            CASE WHEN has_ni_mc THEN config_record->>'activation_type' ELSE NULL END,
            CASE WHEN config_record->>'partner_type' = 'D2D' THEN COALESCE(config_record->>'d2d_level', 'Nv1') ELSE NULL END,
            CASE WHEN config_record->>'partner_type' IN ('REV', 'Rev+') THEN COALESCE((config_record->>'rev_level')::integer, 1) ELSE NULL END,
            CASE WHEN config_record->>'tier_mode' = 'by_power' THEN config_record->>'power_value' ELSE NULL END,
            CASE WHEN config_record->>'service_type' = 'additional_service' THEN config_record->>'additional_service_name' ELSE NULL END,
            NULLIF(config_record->>'technology', '')::text,
            NULLIF(config_record->>'from_email', '')::text,
            NULLIF(config_record->>'from_smtp_pass', '')::text,
            COALESCE((config_record->>'multiply_without_vat')::boolean, false),
            now(),
            now()
        );
    END LOOP;
END;
$$;
