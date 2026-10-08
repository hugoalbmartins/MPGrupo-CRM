/*
# Correct normal new-sale email recipient rules

1. Purpose
- Separates normal sale notifications into two independent deliveries.
- Admin/Backoffice users selected on the operator receive the sale without
  attachments and with the partner name visible.
- External operator notification emails receive the sale with attachments and
  without the partner name.

2. Exclusions
- Blocked, pending-validation, and internal-treatment flows keep their own
  dedicated email paths.
- The existing optional partner BCC path is preserved.

3. Data safety
- No tables, columns, or rows are changed or deleted.
- Only the active notification function is replaced.
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
    function_definition := regexp_replace(
      function_definition,
      $pattern$\n-- CALL B: Combined admins/BO.*?\nEND;\n\$function\$$pattern$,
      $replacement$
-- CALL B: selected Admin/Backoffice users, without attachments and with partner name
v_admin_recipients := '[]'::jsonb;
IF v_operator_user_ids IS NOT NULL AND array_length(v_operator_user_ids, 1) > 0 THEN
  FOR v_rec IN
    SELECT email, name FROM users
    WHERE id = ANY(v_operator_user_ids)
      AND role IN ('admin', 'bo')
      AND COALESCE(email_alerts_enabled, true) = true
  LOOP
    v_admin_recipients := v_admin_recipients || jsonb_build_object('email', v_rec.email, 'name', v_rec.name);
  END LOOP;
END IF;

IF jsonb_array_length(v_admin_recipients) > 0 THEN
  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-new-sale-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_supabase_anon_key
      ),
      body := v_base_payload || v_email_extras || jsonb_build_object(
        'to_recipients', v_admin_recipients,
        'show_partner', true,
        'include_attachments', false,
        'attachments', '[]'::jsonb
      )
    );
    RAISE NOTICE 'New sale email (selected admins/BO, no attachments) queued: %', jsonb_array_length(v_admin_recipients);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error sending selected admin/BO email: %', SQLERRM;
  END;
END IF;

-- CALL C: operator notification emails, with attachments and without partner name
v_partner_recipients := '[]'::jsonb;
IF v_operator_emails IS NOT NULL AND array_length(v_operator_emails, 1) > 0 THEN
  FOREACH v_email IN ARRAY v_operator_emails
  LOOP
    IF v_email IS NOT NULL AND v_email != '' THEN
      v_partner_recipients := v_partner_recipients || jsonb_build_object('email', v_email, 'name', p_operator_name);
    END IF;
  END LOOP;
END IF;

IF jsonb_array_length(v_partner_recipients) > 0 THEN
  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-new-sale-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_supabase_anon_key
      ),
      body := v_base_payload || v_email_extras || jsonb_build_object(
        'to_recipients', v_partner_recipients,
        'show_partner', false,
        'include_attachments', true
      )
    );
    RAISE NOTICE 'New sale email (operator notification emails, with attachments) queued: %', jsonb_array_length(v_partner_recipients);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error sending operator notification email: %', SQLERRM;
  END;
END IF;
END;
$function$
$replacement$,
      'n'
    );
    EXECUTE function_definition;
  END IF;
END $migration$;
