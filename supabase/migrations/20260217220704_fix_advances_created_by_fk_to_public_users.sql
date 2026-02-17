/*
  # Fix partner_advances FK constraints to point to public.users

  ## Problem
  The created_by and settled_by columns have FK constraints referencing auth.users,
  but PostgREST can only join to public schema tables. This prevents the service
  from fetching creator/settler names via PostgREST joins.

  ## Fix
  Drop the auth.users FK constraints and recreate them pointing to public.users.
  This allows PostgREST to resolve creator:created_by(id,name) joins correctly.
*/

ALTER TABLE partner_advances
  DROP CONSTRAINT IF EXISTS partner_advances_created_by_fkey,
  DROP CONSTRAINT IF EXISTS partner_advances_settled_by_fkey;

ALTER TABLE partner_advances
  ADD CONSTRAINT partner_advances_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT partner_advances_settled_by_fkey
    FOREIGN KEY (settled_by) REFERENCES users(id) ON DELETE SET NULL;
