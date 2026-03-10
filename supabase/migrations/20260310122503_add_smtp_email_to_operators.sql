/*
  # Add custom SMTP email fields to operators

  ## Summary
  Adds per-operator email sending configuration to the `operators` table.
  Operators can optionally have their own sending email address (must be @mpgrupo.pt)
  and the corresponding email password. When set, sales notifications for that operator
  will be sent from the operator-specific address instead of the global info@mpgrupo.pt.

  ## Changes

  ### Modified Tables
  - `operators`
    - `email_envio` (text, nullable): The prefix part of the sending email (e.g. "endesa" for endesa@mpgrupo.pt).
      Stored as just the prefix; the @mpgrupo.pt domain is appended at send time.
    - `email_envio_password` (text, nullable): The SMTP password for the operator-specific email.
      When null or empty, the global info@mpgrupo.pt credentials are used.

  ## Security
  - No RLS changes needed — existing operator RLS policies apply
  - Passwords stored in DB are used only server-side (edge function has service role access)

  ## Notes
  - Both fields default to NULL meaning the global email is used
  - Existing behaviour is fully preserved when fields are NULL
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'email_envio'
  ) THEN
    ALTER TABLE operators ADD COLUMN email_envio text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'email_envio_password'
  ) THEN
    ALTER TABLE operators ADD COLUMN email_envio_password text DEFAULT NULL;
  END IF;
END $$;
