/*
  # Fix Cascade Behavior for Partner and Sale Deletion

  ## Summary
  Updates foreign key constraints so that deleting a partner or sale properly
  cleans up all associated data without leaving orphaned records.

  ## Changes

  ### Partner deletion cascades
  1. `sales.partner_id` → SET NULL (keeps sale records but disassociates from partner)
  2. `forms.partner_id` → SET NULL (keeps form records but disassociates from partner)
  3. `users.partner_id` → CASCADE (users belonging to the partner are deleted automatically)

  ### Notes
  - Sales are kept when a partner is deleted (important business records)
  - Users associated with the partner are deleted along with the partner
  - All DB-level related records already cascade correctly (commission_reports, partner_d2d_operator_levels)
*/

-- Fix sales.partner_id: SET NULL instead of NO ACTION so partner can be deleted
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_partner_id_fkey;
ALTER TABLE sales
  ADD CONSTRAINT sales_partner_id_fkey
  FOREIGN KEY (partner_id) REFERENCES partners(id)
  ON DELETE SET NULL;

-- Fix forms.partner_id: SET NULL instead of NO ACTION
ALTER TABLE forms DROP CONSTRAINT IF EXISTS forms_partner_id_fkey;
ALTER TABLE forms
  ADD CONSTRAINT forms_partner_id_fkey
  FOREIGN KEY (partner_id) REFERENCES partners(id)
  ON DELETE SET NULL;

-- Fix users.partner_id: CASCADE so deleting a partner deletes their users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'users'
      AND constraint_name = 'users_partner_id_fkey'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_partner_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_partner_id_fkey
      FOREIGN KEY (partner_id) REFERENCES partners(id)
      ON DELETE CASCADE;
  END IF;
END $$;