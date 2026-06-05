/*
  # Add payment tracking fields to sales table
  
  Adds fields to track which commission report paid each sale:
  - paid_in_report_id: FK to the commission report that paid this sale
  - paid_in_report_at: timestamp when it was marked as paid
  
  Updates validate_commission_report_payment RPC to also tag sales.
  Backfills existing validated reports.
*/

-- Add tracking columns
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS paid_in_report_id uuid REFERENCES commission_reports(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS paid_in_report_at timestamptz;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_sales_paid_in_report_id ON sales(paid_in_report_id) WHERE paid_in_report_id IS NOT NULL;

-- Backfill existing validated reports
DO $$
DECLARE
  r RECORD;
  sale_uuid uuid;
BEGIN
  FOR r IN
    SELECT id, sales_included, paid_validated_at
    FROM commission_reports
    WHERE paid_validated_at IS NOT NULL
      AND sales_included IS NOT NULL
      AND jsonb_array_length(sales_included) > 0
  LOOP
    FOR sale_uuid IN
      SELECT jsonb_array_elements_text(r.sales_included)::uuid
    LOOP
      UPDATE sales
      SET paid_in_report_id = r.id,
          paid_in_report_at = r.paid_validated_at
      WHERE id = sale_uuid
        AND paid_in_report_id IS NULL;
    END LOOP;
  END LOOP;
END $$;

-- Update the validate payment function to also tag sales
CREATE OR REPLACE FUNCTION validate_commission_report_payment(
  p_report_id uuid,
  p_admin_id uuid
)
RETURNS void AS $$
DECLARE
  is_admin boolean;
  v_sales_included jsonb;
  sale_uuid uuid;
BEGIN
  SELECT role = 'admin' INTO is_admin
  FROM users
  WHERE id = p_admin_id;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem validar pagamentos';
  END IF;

  UPDATE commission_reports
  SET
    paid_validated_at = NOW(),
    paid_validated_by = p_admin_id
  WHERE id = p_report_id
    AND paid_validated_at IS NULL
  RETURNING sales_included INTO v_sales_included;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auto não encontrado ou já validado';
  END IF;

  -- Tag all sales included in this report
  IF v_sales_included IS NOT NULL AND jsonb_array_length(v_sales_included) > 0 THEN
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
