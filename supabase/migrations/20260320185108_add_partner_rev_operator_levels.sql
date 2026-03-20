/*
  # Add partner_rev_operator_levels table

  ## Summary
  Creates a table to store per-operator REV level assignments for REV and Rev+ partners,
  mirroring the existing partner_d2d_operator_levels table for D2D partners.

  ## New Tables
  - `partner_rev_operator_levels`
    - `id` (uuid, primary key)
    - `partner_id` (uuid, FK to partners) - the REV/Rev+ partner
    - `operator_id` (uuid, FK to operators) - the operator
    - `rev_level` (integer 1-5) - the commission level for this operator
    - `created_at` (timestamp)

  ## Security
  - RLS enabled
  - Admin and BO can read/write all records
  - Partners can read their own records

  ## Notes
  - Unique constraint on (partner_id, operator_id) to prevent duplicate entries per operator
  - The existing `rev_level` field on the `partners` table is kept as a fallback global default
*/

CREATE TABLE IF NOT EXISTS partner_rev_operator_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  rev_level integer NOT NULL DEFAULT 1 CHECK (rev_level >= 1 AND rev_level <= 5),
  created_at timestamptz DEFAULT now(),
  UNIQUE (partner_id, operator_id)
);

ALTER TABLE partner_rev_operator_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and BO can read all rev operator levels"
  ON partner_rev_operator_levels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'bo', 'gestor_nv1', 'gestor_nv2')
    )
  );

CREATE POLICY "Admins and BO can insert rev operator levels"
  ON partner_rev_operator_levels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'bo')
    )
  );

CREATE POLICY "Admins and BO can update rev operator levels"
  ON partner_rev_operator_levels FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'bo')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'bo')
    )
  );

CREATE POLICY "Admins and BO can delete rev operator levels"
  ON partner_rev_operator_levels FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'bo')
    )
  );

CREATE POLICY "Partners can read own rev operator levels"
  ON partner_rev_operator_levels FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE user_id = auth.uid()
    )
  );
