/*
  # Add archive alerts RLS policy

  Allows any authenticated user who is in the alert's user_ids array
  to set archived_at on that alert. This covers all roles that can view
  alerts (including admin, gestor_nv1, gestor_nv2, gestor_comercial, partner).

  The existing "Users mark alerts read" policy already allows UPDATE for
  users in user_ids, but we add an explicit archive policy to be safe and
  to cover cases where admin/gestor_nv1/gestor_nv2 archive alerts that
  they can see via their own SELECT policies (which don't require being
  in user_ids).
*/

CREATE POLICY "Users archive own alerts"
  ON alerts FOR UPDATE
  TO authenticated
  USING (auth.uid() = ANY(user_ids))
  WITH CHECK (auth.uid() = ANY(user_ids));

CREATE POLICY "Admins archive any alert"
  ON alerts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'gestor_nv1', 'gestor_nv2')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'gestor_nv1', 'gestor_nv2')
    )
  );
