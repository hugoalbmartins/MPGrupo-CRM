/*
# Partner Retention Management System

## Purpose
Allow administrators to manage retention values per partner:
- View accumulated retention values from sales per partner/month
- Add manual/additional retention entries (even without matching sales)
- Control which month each retention refund will be issued in
- Track retention refunds as single totals (not per-sale)

## New Tables

### `partner_retention_entries`
Manual retention entries that admins can add to a partner:
- `id` (uuid, primary key)
- `partner_id` (uuid, FK to partners)
- `amount` (numeric, the retention amount — positive = retention withheld, negative not allowed)
- `refund_month` (integer 1-12, the month in which this retention should be refunded)
- `refund_year` (integer, the year in which this retention should be refunded)
- `reference_month` (integer 1-12, the month this retention refers to / was generated)
- `reference_year` (integer, the year this retention refers to)
- `description` (text, admin notes about this entry)
- `source` (text, 'manual' for admin-added, 'sales' for auto-calculated from sales)
- `commission_report_id` (uuid, FK to commission_reports — set when refunded in a report)
- `refunded` (boolean, whether this has been refunded)
- `refunded_at` (timestamptz)
- `created_by` (uuid, FK to users)
- `created_at` (timestamptz)

## Security
- RLS enabled
- Only admin and backoffice can manage retention entries
- Uses existing has_role function for role checks
*/

-- Create partner_retention_entries table
CREATE TABLE IF NOT EXISTS partner_retention_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  refund_month integer NOT NULL CHECK (refund_month >= 1 AND refund_month <= 12),
  refund_year integer NOT NULL CHECK (refund_year >= 2020 AND refund_year <= 2050),
  reference_month integer NOT NULL CHECK (reference_month >= 1 AND reference_month <= 12),
  reference_year integer NOT NULL CHECK (reference_year >= 2020 AND reference_year <= 2050),
  description text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'sales')),
  commission_report_id uuid REFERENCES commission_reports(id) ON DELETE SET NULL,
  refunded boolean NOT NULL DEFAULT false,
  refunded_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE partner_retention_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies: admin and backoffice full access
DROP POLICY IF EXISTS "admin_bo_select_retention_entries" ON partner_retention_entries;
CREATE POLICY "admin_bo_select_retention_entries" ON partner_retention_entries
  FOR SELECT TO authenticated
  USING (has_role('admin') OR has_role('backoffice'));

DROP POLICY IF EXISTS "admin_bo_insert_retention_entries" ON partner_retention_entries;
CREATE POLICY "admin_bo_insert_retention_entries" ON partner_retention_entries
  FOR INSERT TO authenticated
  WITH CHECK (has_role('admin') OR has_role('backoffice'));

DROP POLICY IF EXISTS "admin_bo_update_retention_entries" ON partner_retention_entries;
CREATE POLICY "admin_bo_update_retention_entries" ON partner_retention_entries
  FOR UPDATE TO authenticated
  USING (has_role('admin') OR has_role('backoffice'))
  WITH CHECK (has_role('admin') OR has_role('backoffice'));

DROP POLICY IF EXISTS "admin_bo_delete_retention_entries" ON partner_retention_entries;
CREATE POLICY "admin_bo_delete_retention_entries" ON partner_retention_entries
  FOR DELETE TO authenticated
  USING (has_role('admin') OR has_role('backoffice'));

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_retention_entries_partner_id ON partner_retention_entries(partner_id);
CREATE INDEX IF NOT EXISTS idx_retention_entries_refund_period ON partner_retention_entries(refund_year, refund_month);
CREATE INDEX IF NOT EXISTS idx_retention_entries_reference_period ON partner_retention_entries(reference_year, reference_month);
CREATE INDEX IF NOT EXISTS idx_retention_entries_refunded ON partner_retention_entries(refunded);

-- RPC to get retention summary per partner for a given period
CREATE OR REPLACE FUNCTION get_partner_retention_summary(
  p_partner_id uuid,
  p_year integer DEFAULT NULL,
  p_month integer DEFAULT NULL
)
RETURNS TABLE (
  total_retained numeric,
  total_refunded numeric,
  total_pending numeric,
  entries_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN NOT pre.refunded THEN pre.amount ELSE 0 END), 0) AS total_retained,
    COALESCE(SUM(CASE WHEN pre.refunded THEN pre.amount ELSE 0 END), 0) AS total_refunded,
    COALESCE(SUM(CASE WHEN NOT pre.refunded AND (
      (p_year IS NULL AND p_month IS NULL) OR
      (pre.refund_year < p_year OR (pre.refund_year = p_year AND pre.refund_month <= p_month))
    ) THEN pre.amount ELSE 0 END), 0) AS total_pending,
    COUNT(*)::bigint AS entries_count
  FROM partner_retention_entries pre
  WHERE pre.partner_id = p_partner_id;
END;
$$;
