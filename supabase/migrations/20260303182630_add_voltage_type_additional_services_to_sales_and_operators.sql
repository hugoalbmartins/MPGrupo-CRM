/*
  # Add voltage_type, additional_services to sales and operator flags

  ## Changes

  ### sales table
  - `voltage_type` (text, nullable) - Tipo de tensao: "Monofasico" or "Trifasico"
  - `additional_services` (text, nullable) - Free text field for additional contracted services

  ### operators table
  - `requires_voltage_type` (boolean, default false) - Whether this operator requires voltage type selection
  - `requires_additional_services` (boolean, default false) - Whether this operator requires additional services description

  ## Notes
  - New fields are optional at DB level; required at app level per operator config
  - Repsol operator will have both flags set to true via a separate update
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'voltage_type'
  ) THEN
    ALTER TABLE sales ADD COLUMN voltage_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'additional_services'
  ) THEN
    ALTER TABLE sales ADD COLUMN additional_services text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'requires_voltage_type'
  ) THEN
    ALTER TABLE operators ADD COLUMN requires_voltage_type boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'requires_additional_services'
  ) THEN
    ALTER TABLE operators ADD COLUMN requires_additional_services boolean DEFAULT false;
  END IF;
END $$;

UPDATE operators
SET
  requires_voltage_type = true,
  requires_additional_services = true,
  email_fields = '["client_contact","client_email","client_iban","address","installation_address","autoriza_documentos","entry_type","voltage_type","additional_services","energy_sale_type","cpe_power","cui_tier","direct_debit","electronic_invoice","observations"]'::jsonb
WHERE name ILIKE '%repsol%';
