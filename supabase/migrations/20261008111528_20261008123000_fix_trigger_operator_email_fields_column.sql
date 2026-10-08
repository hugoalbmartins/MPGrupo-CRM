/*
# Fix operator email fields reference in new-sale trigger

1. Purpose
- Fixes partner sale creation failures caused by the trigger reading the
  nonexistent `sales.email_fields` field through `NEW.email_fields`.
- Reads `email_fields` from the related `operators` row, where the column exists.

2. Modified database object
- Recreates `trigger_new_sale_alert()` after replacing only the invalid
  `NEW.email_fields` assignment.

3. Data safety
- No tables, columns, or rows are deleted or modified.
- Existing sale email and blocked-partner behaviour remains unchanged.
*/

DO $$
DECLARE
  function_definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO function_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'trigger_new_sale_alert'
    AND p.prokind = 'f'
  LIMIT 1;

  IF function_definition IS NOT NULL THEN
    function_definition := replace(
      function_definition,
      'v_email_fields := NEW.email_fields;',
      'SELECT email_fields INTO v_email_fields FROM operators WHERE id = NEW.operator_id;'
    );
    EXECUTE function_definition;
  END IF;
END $$;
