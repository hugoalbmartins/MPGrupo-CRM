/*
  # Fix Cascade Delete for Partner and User Cleanup

  ## Summary
  Ensures all tables referencing users are properly cascaded or nullified
  so that deleting a partner (and its users) leaves no orphaned records
  and does not fail with FK constraint violations.

  ## Changes
  1. `push_subscriptions.user_id` → CASCADE (delete subscriptions with user)
  2. `operator_validations.user_id` → SET NULL (keep validation records, just lose user reference)
  3. `alerts` — alerts reference sales/users via user-defined fields; confirmed no blocking FK
*/

-- push_subscriptions: cascade delete when user is deleted
DO $$
BEGIN
  ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey;
  ALTER TABLE push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE;
END $$;

-- operator_validations: set null when user is deleted (preserve validation history)
DO $$
BEGIN
  ALTER TABLE operator_validations DROP CONSTRAINT IF EXISTS operator_validations_user_id_fkey;
  ALTER TABLE operator_validations
    ADD CONSTRAINT operator_validations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL;
END $$;
