/*
# Block commission report re-emission for sales in any existing report

## Purpose
Previously, `get_settled_sales_for_partner` only excluded sales from validated (paid) reports.
This allowed the same sale to appear in a new report even if it was already emitted in a pending
(unvalidated) report. The rule should be: once a sale is included in ANY existing commission
report, it cannot be included in another one until the previous report is deleted.

## Changes
- `get_settled_sales_for_partner`: now returns sale IDs from ALL existing reports for the partner,
  regardless of whether they are validated as paid.
- `get_partners_with_sales_for_month`: excludes sales from ALL existing reports (paid or pending)
  when computing which partners have new sales to emit.

## Business Rule
- Once a sale is included in a commission report (whether paid or not), it will not appear in
  any subsequent report until the original report is deleted.
- Deleting a report frees the sales it contained, so they can appear in a fresh emission.
*/

CREATE OR REPLACE FUNCTION get_settled_sales_for_partner(
  p_partner_id uuid,
  p_month integer DEFAULT NULL,
  p_year integer DEFAULT NULL
)
RETURNS TABLE(sale_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT jsonb_array_elements_text(sales_included)::uuid as sale_id
  FROM commission_reports
  WHERE partner_id = p_partner_id
    AND sales_included IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION get_partners_with_sales_for_month(
  p_month integer,
  p_year integer
)
RETURNS TABLE(
  partner_id uuid,
  partner_name text,
  sales_count bigint,
  total_commission numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
RETURN QUERY
WITH settled_sales AS (
  SELECT DISTINCT jsonb_array_elements_text(cr.sales_included)::uuid as sale_id
  FROM commission_reports cr
  WHERE cr.sales_included IS NOT NULL
),
eligible_sales AS (
  SELECT
    s.partner_id,
    s.id as sale_id,
    COALESCE(s.calculated_commission, 0) as commission
  FROM sales s
  WHERE s.status = 'Ativo'
    AND s.paid_to_operator = true
    AND EXTRACT(MONTH FROM s.activation_date) = p_month
    AND EXTRACT(YEAR FROM s.activation_date) = p_year
    AND s.id NOT IN (SELECT sale_id FROM settled_sales)
)
SELECT
  es.partner_id,
  p.name as partner_name,
  COUNT(es.sale_id)::bigint as sales_count,
  SUM(es.commission) as total_commission
FROM eligible_sales es
JOIN partners p ON p.id = es.partner_id
GROUP BY es.partner_id, p.name
ORDER BY p.name;
END;
$$;
