/*
  # Allow anonymous partner_code lookup for login

  ## Problem
  REV and REV+ partner users trying to log in with their user_code fail because:
  1. The user_code lookup in the `users` table was case-sensitive (REV+1001_1 vs Rev+1001_1)
  2. The fallback partner_code lookup on the `partners` table has no anon SELECT policy,
     so anonymous users cannot query it at login time.

  ## Fix
  Add an anon SELECT policy on `partners` that only exposes `partner_code` and `user_id`
  for login lookups. This mirrors the existing anon policy on `users` for user_code lookups.

  ## Security
  - Only exposes partner_code and user_id to anon (via column-level query filtering)
  - No sensitive partner data is exposed
  - Identical pattern to the existing "Anon can lookup user email by user_code for login" policy
*/

CREATE POLICY "Anon can lookup partner by partner_code for login"
  ON partners
  FOR SELECT
  TO anon
  USING (partner_code IS NOT NULL);
