/*
  # Add SMTP override fields to commission_configurations

  1. New Columns
    - `commission_configurations.from_email` (text, nullable)
      - Custom "From" email address for this commission configuration
      - When set, overrides the global SMTP from_email for emails related to this config
    - `commission_configurations.from_smtp_pass` (text, nullable)
      - Custom SMTP password for this commission configuration
      - When set, used alongside from_email for SMTP authentication

  2. Modified Tables
    - `commission_configurations` - added from_email and from_smtp_pass columns

  3. Security
    - No RLS changes needed (existing policies apply)

  4. Important Notes
    - These fields allow per-commission-config email identity override
    - When null, the global SMTP settings (or operator-level settings) are used
    - Priority: commission_config > operator > global
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_configurations' AND column_name = 'from_email'
  ) THEN
    ALTER TABLE commission_configurations ADD COLUMN from_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_configurations' AND column_name = 'from_smtp_pass'
  ) THEN
    ALTER TABLE commission_configurations ADD COLUMN from_smtp_pass text;
  END IF;
END $$;
