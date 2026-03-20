/*
  # Fix tier_mode CHECK constraint to allow 'by_power'

  ## Summary
  The commission_configurations table has a CHECK constraint on tier_mode that only
  allows 'by_quantity' and 'by_monthly_value'. The application uses 'by_power' for
  energy operator commissions based on contracted power (kVA). This migration adds
  'by_power' to the allowed values.

  ## Changes
  - `commission_configurations.tier_mode`: adds 'by_power' to the CHECK constraint
*/

ALTER TABLE commission_configurations
  DROP CONSTRAINT IF EXISTS commission_configurations_tier_mode_check;

ALTER TABLE commission_configurations
  ADD CONSTRAINT commission_configurations_tier_mode_check
  CHECK (tier_mode = ANY (ARRAY['by_quantity'::text, 'by_monthly_value'::text, 'by_power'::text]));
