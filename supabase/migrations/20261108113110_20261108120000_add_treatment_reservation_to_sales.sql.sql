/*
# Add treatment reservation to sales

## Purpose
When an operator requires internal treatment ("tratamento interno"), admin/BO users
can click "Iniciar Tratamento" to reserve the sale. Once reserved:
- The sale is assigned to that specific admin/BO (treatment_reserved_by).
- Alerts for that sale are suppressed (the alert trigger skips sales where
  internal_treatment = true).

## Changes
1. New columns on `sales`:
   - `treatment_reserved_by` (uuid, FK to public.users, nullable) — the admin/BO
     who started treatment.
   - `treatment_reserved_at` (timestamptz, nullable) — when treatment was started.
2. Updated `trigger_new_sale_alert` to skip alert creation when
   `internal_treatment = true` on the new sale row.
3. RLS: the existing sales policies already cover admin/bo UPDATE, so no new
   policies needed. The new columns inherit the table's existing grant set.
*/

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS treatment_reserved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS treatment_reserved_at timestamptz;

-- Update the new-sale alert trigger to skip sales in internal treatment.
-- The trigger function name is trigger_new_sale_alert; we replace it so that
-- when NEW.internal_treatment is true, no alert row is inserted.
CREATE OR REPLACE FUNCTION trigger_new_sale_alert_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_user_id uuid;
  v_created_by uuid;
  v_alert_user_ids uuid[] := ARRAY[]::uuid[];
  v_operator_rec record;
  v_op_requires_treatment boolean := false;
BEGIN
  -- Skip alert creation entirely for sales in internal treatment.
  -- Alerts are handled via the restricted email + reservation flow instead.
  IF NEW.internal_treatment = true THEN
    RETURN NEW;
  END IF;

  -- Look up operator to determine if treatment is required (for email routing).
  SELECT * INTO v_operator_rec FROM operators WHERE id = NEW.operator_id LIMIT 1;
  v_op_requires_treatment := COALESCE(v_operator_rec.requires_internal_treatment, false);

  -- Collect recipient user IDs.
  v_created_by := NEW.created_by_user_id;

  -- Partner's user_id.
  SELECT user_id INTO v_partner_user_id FROM partners WHERE id = NEW.partner_id LIMIT 1;

  -- Admin + BO users.
  SELECT array_agg(id) INTO v_alert_user_ids
  FROM users
  WHERE role IN ('admin', 'bo');

  -- Add partner user and creator.
  IF v_partner_user_id IS NOT NULL THEN
    v_alert_user_ids := array_append(v_alert_user_ids, v_partner_user_id);
  END IF;
  IF v_created_by IS NOT NULL AND NOT (v_created_by = ANY(v_alert_user_ids)) THEN
    v_alert_user_ids := array_append(v_alert_user_ids, v_created_by);
  END IF;

  -- Insert the alert (only for non-treatment sales).
  INSERT INTO alerts (type, sale_id, sale_code, message, user_ids, created_by, created_by_name)
  VALUES (
    'new_sale',
    NEW.id,
    NEW.sale_code,
    'Nova venda: ' || COALESCE(NEW.client_name, NEW.customer_name, 'Sem nome') || ' (' || COALESCE(NEW.sale_code, '') || ')',
    v_alert_user_ids,
    v_created_by,
    NULL
  );

  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger to use the updated function.
DROP TRIGGER IF EXISTS trg_new_sale_alert ON sales;
CREATE TRIGGER trg_new_sale_alert
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION trigger_new_sale_alert_func();
