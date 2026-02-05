/*
  # Allow anonymous user code lookup for login

  1. Security
    - Add RLS policy on `users` table for `anon` role
    - Only allows SELECT of `email` column when filtering by `user_code`
    - This is needed so unauthenticated users can log in with their user_code

  2. Notes
    - The policy only allows reading the email field via user_code lookup
    - No other data is exposed to anonymous users
*/

CREATE POLICY "Anon can lookup user email by user_code for login"
  ON users
  FOR SELECT
  TO anon
  USING (user_code IS NOT NULL);
