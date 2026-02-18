/*
  # Add power-based commission mode to commission_configurations

  ## Changes

  ### 1. New Column
  - `commission_configurations.power_value` (text) - The electricity power value
    (e.g. "1.15kVA", "3.45kVA") used when tier_mode = 'by_power'. Each power tier
    is stored as a separate row with the matching power_value.

  ### 2. Updated Unique Constraint
  - Drop the existing unique index and recreate it including power_value, so that
    different power values for the same operator/partner/client/service combination
    can coexist as distinct rows.

  ## How by_power works
  - When tier_mode = 'by_power', the system looks for a commission_configurations row
    whose power_value matches the sale's `power` field.
  - All partner types (D2D, REV, Rev+) and levels are supported normally.
  - direct_debit_bonus and electronic_invoice_bonus still apply.
  - min_sales / monthly_value_min / monthly_value_max are ignored for by_power rows
    (each power value is a flat commission).

  ## Notes
  - Existing rows are unaffected (power_value defaults to NULL).
  - No RLS changes needed.
*/

-- 1. Add the new column
ALTER TABLE commission_configurations
  ADD COLUMN IF NOT EXISTS power_value text DEFAULT NULL;

-- 2. Drop the current unique index
DROP INDEX IF EXISTS unique_commission_config_complete;

-- 3. Recreate including power_value
CREATE UNIQUE INDEX unique_commission_config_complete ON commission_configurations (
  operator_id,
  partner_type,
  COALESCE(d2d_level, ''),
  COALESCE(rev_level::text, ''),
  client_type,
  service_type,
  tier_mode,
  min_sales,
  COALESCE(monthly_value_min, 0),
  COALESCE(monthly_value_max, 0),
  COALESCE(activation_type, ''),
  COALESCE(refid_operation_type, ''),
  COALESCE(power_value, '')
);
