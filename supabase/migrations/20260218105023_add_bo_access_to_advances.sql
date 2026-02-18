/*
  # Add BO (Backoffice) access to partner_advances

  ## Changes
  - Adds SELECT policy for BO users to view all advances
  - Adds INSERT policy for BO users to create advances
  - Adds UPDATE policy for BO users to update advances

  ## Security
  - BO users get the same read/write access as admins, but cannot delete advances
  - All policies check the users table for the authenticated user's role
*/

CREATE POLICY "BO can view all advances"
  ON partner_advances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'bo'
    )
  );

CREATE POLICY "BO can insert advances"
  ON partner_advances FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'bo'
    )
  );

CREATE POLICY "BO can update advances"
  ON partner_advances FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'bo'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'bo'
    )
  );
