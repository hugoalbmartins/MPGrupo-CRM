/*
  # Fix settled sales exclusion - prevent sales from paid reports appearing in new reports

  1. Changes
    - `get_settled_sales_for_partner`: Now returns ALL sales from ANY paid report for the partner,
      not just from reports matching the selected month/year. This prevents a sale that was already
      paid in a previous report from appearing again in a new report for a different month.
    - `get_partners_with_sales_for_month`: Updated the settled_sales CTE to exclude sales from
      ALL paid reports for each partner, not just from reports of the same month/year.

  2. Business Rule
    - Once a sale is included in a paid (validated) commission report, it must NEVER appear
      in any future commission report, regardless of the month/year being generated.
    - If all eligible sales for a partner are already in paid reports, that partner should
      not appear in the emission list at all.
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
    AND paid_validated_at IS NOT NULL;
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
  WHERE cr.paid_validated_at IS NOT NULL
),
eligible_sales AS (
  SELECT
    s.id,
    s.partner_id,
    COALESCE(s.manual_commission, s.calculated_commission, 0)
    + COALESCE(CASE WHEN s.has_direct_debit THEN s.direct_debit_value ELSE 0 END, 0)
    + COALESCE(CASE WHEN s.has_electronic_invoice THEN s.electronic_invoice_value ELSE 0 END, 0) as total_commission
  FROM sales s
  WHERE s.paid_to_operator = true
    AND (
      (EXTRACT(MONTH FROM COALESCE(s.payment_date, s.date)) = p_month
       AND EXTRACT(YEAR FROM COALESCE(s.payment_date, s.date)) = p_year)
    )
    AND NOT EXISTS (
      SELECT 1 FROM settled_sales ss
      WHERE ss.sale_id = s.id
    )
)
SELECT
  es.partner_id,
  p.name as partner_name,
  COUNT(es.id)::bigint as sales_count,
  SUM(es.total_commission)::numeric as total_commission
FROM eligible_sales es
JOIN partners p ON p.id = es.partner_id
GROUP BY es.partner_id, p.name
HAVING COUNT(es.id) > 0
ORDER BY p.name;
END;
$$;
