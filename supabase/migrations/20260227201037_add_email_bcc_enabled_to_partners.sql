/*
  # Add email_bcc_enabled to partners

  1. Changes
    - Add `email_bcc_enabled` boolean column to `partners` table
      - Default false (all partners start without BCC email authorization)
      - D2D partners are excluded from BCC emails by default
      - This flag allows admin/BO to explicitly authorize individual D2D partners

  2. Notes
    - Non-D2D partners are already included in BCC emails
    - Only D2D partners with this flag set to true will receive BCC emails
    - The DB trigger function will be updated to check this flag
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'email_bcc_enabled'
  ) THEN
    ALTER TABLE partners ADD COLUMN email_bcc_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;
