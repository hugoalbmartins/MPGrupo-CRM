/*
  # Add counting mode and quantity field to scopes

  1. New Columns
    - `scopes.counting_mode` (text, DEFAULT 'per_contract')
      - 'per_contract': one commission per sale (default, existing behavior)
      - 'by_quantity': commission multiplied by a quantity field value
    - `scopes.quantity_field` (text, nullable)
      - The field_key of the scope_field whose numeric value is the quantity multiplier
      - Example: for mobilidade_eletrica, this could be 'ev_outlet_count'
      - For scopes using by_quantity mode, this field must reference an existing scope_field

  2. Modified Tables
    - `scopes` - added counting_mode and quantity_field columns

  3. Security
    - No RLS changes needed (existing policies apply)

  4. Important Notes
    - Default value 'per_contract' ensures backward compatibility
    - All existing scopes continue to work as before
    - quantity_field is only relevant when counting_mode = 'by_quantity'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scopes' AND column_name = 'counting_mode'
  ) THEN
    ALTER TABLE scopes ADD COLUMN counting_mode text DEFAULT 'per_contract';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scopes' AND column_name = 'quantity_field'
  ) THEN
    ALTER TABLE scopes ADD COLUMN quantity_field text;
  END IF;
END $$;
