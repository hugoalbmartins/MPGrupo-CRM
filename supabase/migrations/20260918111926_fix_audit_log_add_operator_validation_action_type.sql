-- Add 'operator_validation' to the allowed action_type values
-- The sales_audit_trigger sets v_action_type := 'operator_validation' when
-- operator_validated changes to true, but the CHECK constraint didn't include it,
-- causing INSERT failures: "violates check constraint sales_audit_log_action_type_check"

ALTER TABLE sales_audit_log
  DROP CONSTRAINT IF EXISTS sales_audit_log_action_type_check;

ALTER TABLE sales_audit_log
  ADD CONSTRAINT sales_audit_log_action_type_check
  CHECK (action_type = ANY (ARRAY[
    'create'::text,
    'update'::text,
    'status_change'::text,
    'note_added'::text,
    'payment_update'::text,
    'operator_validation'::text
  ]));
