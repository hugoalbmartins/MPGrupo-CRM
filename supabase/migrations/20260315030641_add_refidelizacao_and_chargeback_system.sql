/*
  # Add Refidelizacao and Chargeback System

  ## Overview
  This migration adds two new features:
  1. **Refidelizacao (Re-fidelization)**: Track when clients can be re-contacted for renewal/renegotiation
  2. **Chargeback**: Allow marking active sales as chargeback, affecting commission reports

  ## Changes

  ### Operators Table
  - `refidelizacao_prazo` (integer, nullable): Number of days/months after activation before client can be re-contacted
  - `refidelizacao_unidade` (text, default 'dias'): Unit for the prazo - 'dias' or 'meses'

  ### Sales Table
  - `refidelizacao_prazo` (integer, nullable): Per-sale override for refidelizacao prazo (set by admin when editing sale)
  - `refidelizacao_unidade` (text, nullable): Unit for the per-sale prazo override
  - `has_chargeback` (boolean, default false): Whether this sale has an active chargeback
  - `chargeback_id` (uuid, nullable): Reference to the latest chargeback for this sale

  ### New Table: chargebacks
  - `id` (uuid, primary key)
  - `sale_id` (uuid, FK to sales): The sale being charged back
  - `partner_id` (uuid, FK to partners): Denormalized for query performance
  - `reason` (text): Reason for the chargeback
  - `reason_date` (date): Date associated with the chargeback reason
  - `percentage` (numeric 5,2, default 100): Percentage of commission to charge back (1-100)
  - `commission_amount` (numeric 10,2): Original commission amount at time of chargeback
  - `chargeback_amount` (numeric 10,2): Computed: commission_amount * percentage / 100
  - `commission_report_id` (uuid, nullable): FK to commission_reports when this chargeback was settled
  - `created_by` (uuid, FK to users): Who registered the chargeback
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on chargebacks table
  - Admins/BO can insert, select, update, delete chargebacks
  - Partners and gestores can only select their own chargebacks (via partner_id)
*/

ALTER TABLE operators ADD COLUMN IF NOT EXISTS refidelizacao_prazo integer;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS refidelizacao_unidade text DEFAULT 'dias';

ALTER TABLE sales ADD COLUMN IF NOT EXISTS refidelizacao_prazo integer;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS refidelizacao_unidade text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS has_chargeback boolean DEFAULT false;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS chargeback_id uuid;

CREATE TABLE IF NOT EXISTS chargebacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  reason text NOT NULL,
  reason_date date NOT NULL,
  percentage numeric(5,2) NOT NULL DEFAULT 100 CHECK (percentage > 0 AND percentage <= 100),
  commission_amount numeric(10,2) NOT NULL DEFAULT 0,
  chargeback_amount numeric(10,2) NOT NULL DEFAULT 0,
  commission_report_id uuid REFERENCES commission_reports(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chargebacks_sale_id ON chargebacks(sale_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_partner_id ON chargebacks(partner_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_commission_report_id ON chargebacks(commission_report_id);

ALTER TABLE chargebacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and BO can select chargebacks"
  ON chargebacks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'bo')
    )
  );

CREATE POLICY "Partners can select own chargebacks"
  ON chargebacks FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT partner_id FROM users WHERE users.id = auth.uid() AND partner_id IS NOT NULL
    )
  );

CREATE POLICY "Gestores can select own partner chargebacks"
  ON chargebacks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('gestor_nv1', 'gestor_nv2', 'partner_commercial')
      AND users.partner_id = chargebacks.partner_id
    )
  );

CREATE POLICY "Admins and BO can insert chargebacks"
  ON chargebacks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'bo')
    )
  );

CREATE POLICY "Admins can update chargebacks"
  ON chargebacks FOR UPDATE
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

CREATE POLICY "Admins can delete chargebacks"
  ON chargebacks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
