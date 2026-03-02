/*
  # Add email_fields to operators table

  ## Summary
  Adds a new JSONB column `email_fields` to the `operators` table to allow configuring
  which sale fields should appear in the new sale notification email for each operator.

  ## Changes
  - `operators` table: new `email_fields` jsonb column (default null = show all available)

  ## Notes
  - `customer_name` and `customer_nif` are always mandatory and not controlled by this column
  - When null or empty, the current behaviour is maintained (show all fields)
  - Field keys follow the naming used in the email template
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'email_fields'
  ) THEN
    ALTER TABLE operators ADD COLUMN email_fields jsonb DEFAULT NULL;
  END IF;
END $$;
