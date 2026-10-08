/*
# Split new-sale email payload under PostgreSQL argument limit

1. Purpose
- Fixes new-sale creation failures caused by `jsonb_build_object` receiving
  102 arguments in one call.
- PostgreSQL allows at most 100 arguments per function call.

2. Modified database object
- Recreates `create_new_sale_alert_with_email()` by splitting its base email
  payload into two JSON objects and concatenating them.
- All existing email fields and recipients remain unchanged.

3. Data safety
- No tables, columns, or rows are deleted or modified.
- This only changes how the notification payload is assembled.
*/

DO $migration$
DECLARE
  function_definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO function_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'create_new_sale_alert_with_email'
    AND p.prokind = 'f'
  LIMIT 1;

  IF function_definition IS NOT NULL THEN
    function_definition := replace(
      function_definition,
      $old$'observations', p_observations,
'email_fields'$old$,
      $new$'observations', p_observations
) || jsonb_build_object(
'email_fields'$new$
    );
    EXECUTE function_definition;
  END IF;
END $migration$;
