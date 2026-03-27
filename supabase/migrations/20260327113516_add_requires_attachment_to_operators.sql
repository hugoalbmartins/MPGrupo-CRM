/*
  # Add requires_attachment to operators table

  ## Summary
  Adds a `requires_attachment` boolean field to the `operators` table to control
  whether sales for a given operator must include at least one file attachment.

  ## Changes
  ### Modified Tables
  - `operators`
    - New column: `requires_attachment` (boolean, DEFAULT true, NOT NULL)
      All existing operators are set to true (attachment required), matching the
      current system-wide hardcoded behaviour.

  ## Notes
  - Default is TRUE so that all existing and new operators require attachments by default.
  - Admins can disable the requirement per operator in the Operators management page.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'requires_attachment'
  ) THEN
    ALTER TABLE operators ADD COLUMN requires_attachment boolean NOT NULL DEFAULT true;
  END IF;
END $$;
