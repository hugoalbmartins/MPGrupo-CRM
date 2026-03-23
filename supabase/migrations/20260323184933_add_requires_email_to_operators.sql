/*
  # Add requires_email to operators table

  ## Summary
  Adds a boolean flag `requires_email` to the `operators` table to control whether
  client email is mandatory when creating a sale for that operator.

  ## Changes
  - New column `requires_email` (boolean, default false) on `operators` table
    - When true: client email is required in the sale form
    - When false: client email is optional

  ## Notes
  - Defaults to false to preserve existing behavior (email was always required before,
    but this migration makes it configurable per operator)
  - No RLS changes needed as the operators table policies already cover this column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'requires_email'
  ) THEN
    ALTER TABLE operators ADD COLUMN requires_email boolean NOT NULL DEFAULT false;
  END IF;
END $$;
