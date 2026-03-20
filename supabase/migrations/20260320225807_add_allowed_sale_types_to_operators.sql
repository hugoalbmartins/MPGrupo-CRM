/*
  # Add allowed_sale_types to operators

  ## Summary
  Adds a new `allowed_sale_types` column to the `operators` table to control
  which sale types (Normal, Multiponto, Multilocal) are available per energy operator.

  ## Changes

  ### operators table
  - Add `allowed_sale_types` column: text array, defaults to all three types enabled
    (normal, multiponto, multilocal) so existing operators are unaffected

  ## Notes
  - Existing operators get all sale types enabled by default
  - Only relevant for energia-scope operators, but stored for all
  - No RLS changes needed (operators table policies remain unchanged)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'allowed_sale_types'
  ) THEN
    ALTER TABLE operators ADD COLUMN allowed_sale_types text[] DEFAULT ARRAY['normal', 'multiponto', 'multilocal'];
  END IF;
END $$;

UPDATE operators SET allowed_sale_types = ARRAY['normal', 'multiponto', 'multilocal'] WHERE allowed_sale_types IS NULL;
