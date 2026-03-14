/*
  # Add Additional Services List and Commission Fields

  ## Summary
  Extends the operators and commission_configurations tables to support
  configurable per-operator additional services with named entries and
  individual commission values.

  ## Changes

  ### operators table
  - `additional_services_list` (jsonb, default []) - Array of service name strings
    defined per operator. When non-empty and requires_additional_services=true,
    a picklist is shown in the sale form.

  ### commission_configurations table
  - `additional_service_name` (text, nullable) - Name of the additional service
    this commission row applies to. Used when service_type = 'additional_service'.
  - Add 'additional_service' as allowed value in service_type check constraint.

  ## Notes
  - Existing data is unaffected (new columns are nullable/have defaults)
  - The Repsol operator's requires_additional_services flag is preserved
  - commission_configurations service_type constraint is extended to allow
    the new 'additional_service' value
*/

-- Add additional_services_list to operators
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'additional_services_list'
  ) THEN
    ALTER TABLE operators ADD COLUMN additional_services_list jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add additional_service_name to commission_configurations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_configurations' AND column_name = 'additional_service_name'
  ) THEN
    ALTER TABLE commission_configurations ADD COLUMN additional_service_name text;
  END IF;
END $$;

-- Update the service_type check constraint to allow 'additional_service'
ALTER TABLE commission_configurations DROP CONSTRAINT IF EXISTS commission_configurations_service_type_check;

ALTER TABLE commission_configurations ADD CONSTRAINT commission_configurations_service_type_check
  CHECK (service_type = ANY (ARRAY[
    'NI'::text, 'MC'::text, 'REFID'::text,
    'M2'::text, 'M3'::text, 'M4'::text,
    'eletricidade'::text, 'gas'::text, 'default'::text,
    'additional_service'::text
  ]));
