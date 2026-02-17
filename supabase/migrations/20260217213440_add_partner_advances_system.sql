/*
  # Partner Advances System

  ## Summary
  Creates a system to track financial advances made to partners, with support for
  full or partial settlement during commission report (auto) generation.

  ## New Tables

  ### partner_advances
  Tracks advances given to partners before their commission payments.

  - `id` (uuid) - Primary key
  - `partner_id` (uuid) - FK to partners
  - `amount` (numeric) - Advance amount in EUR
  - `advance_date` (date) - Date the advance was given
  - `notes` (text) - Optional notes
  - `is_settled` (boolean) - Whether fully settled
  - `settled_amount` (numeric) - Amount already settled (for partial settlements)
  - `created_by` (uuid) - FK to users (admin who created it)
  - `created_at` (timestamptz) - Creation timestamp
  - `settled_at` (timestamptz) - When fully settled
  - `settled_by` (uuid) - FK to users (admin who settled it)

  ## Security
  - RLS enabled
  - Admins can do everything
  - Partners can view their own advances (read-only)
*/

CREATE TABLE IF NOT EXISTS partner_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  advance_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  is_settled boolean NOT NULL DEFAULT false,
  settled_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  settled_by uuid REFERENCES auth.users(id)
);

ALTER TABLE partner_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all advances"
  ON partner_advances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert advances"
  ON partner_advances FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update advances"
  ON partner_advances FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete advances"
  ON partner_advances FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Partners can view own advances"
  ON partner_advances FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT id FROM partners WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_partner_advances_partner_id ON partner_advances(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_advances_is_settled ON partner_advances(is_settled);
CREATE INDEX IF NOT EXISTS idx_partner_advances_advance_date ON partner_advances(advance_date);
