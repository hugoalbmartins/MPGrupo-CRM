-- Add commission_report_id to partner_advances so advances are linked to reports
-- but only settled when the report is marked as paid.
-- ON DELETE SET NULL ensures deleted reports release their advances for re-inclusion.

ALTER TABLE partner_advances 
ADD COLUMN IF NOT EXISTS commission_report_id uuid REFERENCES commission_reports(id) ON DELETE SET NULL;

-- Update validate_commission_report_payment to also settle linked advances
CREATE OR REPLACE FUNCTION validate_commission_report_payment(
  p_report_id uuid,
  p_admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sales_included jsonb;
  sale_uuid uuid;
BEGIN
  -- Get sales_included before update
  SELECT sales_included INTO v_sales_included
  FROM commission_reports
  WHERE id = p_report_id AND paid_validated_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found or already paid';
  END IF;

  -- Mark report as paid
  UPDATE commission_reports
  SET
    paid_validated_at = NOW(),
    paid_validated_by = p_admin_id
  WHERE id = p_report_id
    AND paid_validated_at IS NULL;

  -- Tag all sales included in this report as paid
  IF v_sales_included IS NOT NULL THEN
    FOR sale_uuid IN
      SELECT jsonb_array_elements_text(v_sales_included)::uuid
    LOOP
      UPDATE sales
      SET paid_in_report_id = p_report_id,
          paid_in_report_at = NOW()
      WHERE id = sale_uuid
        AND paid_in_report_id IS NULL;
    END LOOP;
  END IF;

  -- Settle all advances linked to this report
  UPDATE partner_advances
  SET 
    is_settled = true,
    settled_at = NOW(),
    settled_by = p_admin_id
  WHERE commission_report_id = p_report_id
    AND is_settled = false;

END;
$$;