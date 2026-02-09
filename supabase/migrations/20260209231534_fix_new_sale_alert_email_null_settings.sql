/*
  # Fix new sale alert email function to handle missing settings

  1. Changes
    - Rewrites `create_new_sale_alert_with_email` to safely check if
      `app.settings.supabase_url` and `app.settings.supabase_anon_key`
      are available before attempting the HTTP call
    - If settings are missing, the in-app alert is still created but
      the email HTTP call is skipped
    - Wraps the net.http_post call in an EXCEPTION block for safety

  2. Impact
    - Prevents NOT NULL constraint violations when creating new sales
    - In-app alerts always work; emails are best-effort
*/

CREATE OR REPLACE FUNCTION create_new_sale_alert_with_email(
  p_sale_id uuid,
  p_sale_code text,
  p_message text,
  p_created_by uuid,
  p_created_by_name text,
  p_partner_id uuid,
  p_created_by_user_id uuid,
  p_customer_name text DEFAULT '',
  p_customer_nif text DEFAULT '',
  p_operator_name text DEFAULT '',
  p_operator_id uuid DEFAULT NULL,
  p_attachments jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_ids uuid[] := '{}';
  v_rec RECORD;
  v_to_recipients jsonb := '[]'::jsonb;
  v_bcc_recipients jsonb := '[]'::jsonb;
  v_supabase_url text;
  v_supabase_anon_key text;
  v_alerts_suspended boolean;
  v_operator_emails text[];
  v_email text;
BEGIN
  FOR v_rec IN
    SELECT user_id FROM get_alert_recipients(p_sale_id, p_partner_id, p_created_by_user_id)
  LOOP
    v_user_ids := array_append(v_user_ids, v_rec.user_id);
  END LOOP;

  INSERT INTO alerts (
    type, sale_id, sale_code, message, user_ids, created_by, created_by_name
  ) VALUES (
    'new_sale', p_sale_id, p_sale_code, p_message, v_user_ids, p_created_by, p_created_by_name
  );

  v_alerts_suspended := are_alerts_suspended();
  IF v_alerts_suspended THEN
    RETURN;
  END IF;

  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);

  IF v_supabase_url IS NULL OR v_supabase_anon_key IS NULL THEN
    RETURN;
  END IF;

  FOR v_rec IN
    SELECT u.email, u.name
    FROM users u
    WHERE u.role IN ('admin', 'bo')
    AND COALESCE(u.email_alerts_enabled, true) = true
  LOOP
    v_to_recipients := v_to_recipients || jsonb_build_object(
      'email', v_rec.email,
      'name', v_rec.name
    );
  END LOOP;

  FOR v_rec IN
    SELECT u.email, u.name
    FROM users u
    LEFT JOIN partners p ON p.user_id = u.id
    WHERE (
      (u.role = 'partner' AND p.id = p_partner_id)
      OR
      (u.id = p_created_by_user_id AND u.role IN ('partner', 'partner_commercial'))
    )
    AND COALESCE(u.email_alerts_enabled, true) = true
  LOOP
    v_bcc_recipients := v_bcc_recipients || jsonb_build_object(
      'email', v_rec.email,
      'name', v_rec.name
    );
  END LOOP;

  SELECT notification_emails INTO v_operator_emails
  FROM operators
  WHERE id = p_operator_id;

  IF v_operator_emails IS NOT NULL THEN
    FOREACH v_email IN ARRAY v_operator_emails
    LOOP
      IF v_email IS NOT NULL AND v_email != '' THEN
        v_bcc_recipients := v_bcc_recipients || jsonb_build_object(
          'email', v_email,
          'name', p_operator_name
        );
      END IF;
    END LOOP;
  END IF;

  IF jsonb_array_length(v_to_recipients) > 0 THEN
    BEGIN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-new-sale-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_supabase_anon_key
        ),
        body := jsonb_build_object(
          'to_recipients', v_to_recipients,
          'bcc_recipients', v_bcc_recipients,
          'sale_code', p_sale_code,
          'customer_name', p_customer_name,
          'customer_nif', COALESCE(p_customer_nif, ''),
          'operator_name', p_operator_name,
          'message', p_message,
          'attachments', p_attachments,
          'sale_id', p_sale_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error sending new sale email: %', SQLERRM;
    END;
  END IF;
END;
$$;
