/*
  # Fix new sale email - always send to admins/BO regardless of partner type

  ## Problem
  The current create_new_sale_alert_with_email function wraps the admin/BO recipient
  building inside a "IF v_partner_type IS DISTINCT FROM 'D2D'" block. This means for
  D2D partner sales, no TO recipients are ever built, and no email is ever sent.

  ## Correct Logic
  - TO recipients: always include admins and BO users (regardless of partner type)
  - BCC recipients: exclude D2D partners (don't BCC the D2D partner themselves)
  - Operator notification emails: always included (regardless of partner type)

  ## Fix
  Move admin/BO recipient building outside the D2D check, keeping only partner/commercial
  BCC exclusion inside the D2D check.
*/

CREATE OR REPLACE FUNCTION create_new_sale_alert_with_email(
  p_sale_id uuid,
  p_sale_code text,
  p_message text,
  p_created_by uuid,
  p_created_by_name text,
  p_partner_id uuid,
  p_created_by_user_id uuid,
  p_customer_name text,
  p_customer_nif text,
  p_operator_name text,
  p_operator_id uuid,
  p_attachments jsonb DEFAULT '[]'::jsonb,
  p_scope text DEFAULT NULL,
  p_entry_type text DEFAULT NULL,
  p_cpe text DEFAULT NULL,
  p_power text DEFAULT NULL,
  p_cui text DEFAULT NULL,
  p_tier text DEFAULT NULL,
  p_autoriza_documentos text DEFAULT NULL
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
  v_operator_user_ids uuid[];
  v_email text;
  v_partner_type text;
BEGIN
  -- Get partner type
  SELECT partner_type INTO v_partner_type
  FROM partners
  WHERE id = p_partner_id;

  -- Collect ALL user IDs for the in-app alert (excluding D2D partners)
  FOR v_rec IN
    SELECT user_id FROM get_alert_recipients(p_sale_id, p_partner_id, p_created_by_user_id)
  LOOP
    v_user_ids := array_append(v_user_ids, v_rec.user_id);
  END LOOP;

  -- ALWAYS create in-app alert (with filtered recipients)
  INSERT INTO alerts (
    type, sale_id, sale_code, message, user_ids, created_by, created_by_name
  ) VALUES (
    'new_sale', p_sale_id, p_sale_code, p_message, v_user_ids, p_created_by, p_created_by_name
  );

  -- Check global email suspension
  v_alerts_suspended := are_alerts_suspended();
  IF v_alerts_suspended THEN
    RAISE NOTICE 'Emails suspended globally - alert created but no email sent for %', p_sale_code;
    RETURN;
  END IF;

  -- Get Supabase URL and anon key from system_config table
  SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
  SELECT value INTO v_supabase_anon_key FROM system_config WHERE key = 'supabase_anon_key';

  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := 'https://iydhpyljcofpztrzjnfr.supabase.co';
  END IF;

  IF v_supabase_anon_key IS NULL OR v_supabase_anon_key = '' THEN
    RAISE NOTICE 'No supabase_anon_key found in system_config - cannot send email for %', p_sale_code;
    RETURN;
  END IF;

  -- Get operator-specific user selection and notification emails
  SELECT notification_user_ids, notification_emails
  INTO v_operator_user_ids, v_operator_emails
  FROM operators
  WHERE id = p_operator_id;

  -- Build TO recipients: admins/BO users - ALWAYS, regardless of partner type
  IF v_operator_user_ids IS NOT NULL AND array_length(v_operator_user_ids, 1) > 0 THEN
    -- Use operator-specific user list
    FOR v_rec IN
      SELECT email, name FROM users
      WHERE id = ANY(v_operator_user_ids)
      AND COALESCE(email_alerts_enabled, true) = true
    LOOP
      v_to_recipients := v_to_recipients || jsonb_build_object(
        'email', v_rec.email,
        'name', v_rec.name
      );
    END LOOP;
  ELSE
    -- Use all admin/BO users
    FOR v_rec IN
      SELECT email, name FROM users
      WHERE role IN ('admin', 'bo')
      AND COALESCE(email_alerts_enabled, true) = true
    LOOP
      v_to_recipients := v_to_recipients || jsonb_build_object(
        'email', v_rec.email,
        'name', v_rec.name
      );
    END LOOP;
  END IF;

  -- BCC: partner/creator users - ONLY if NOT D2D partner
  IF v_partner_type IS DISTINCT FROM 'D2D' THEN
    FOR v_rec IN
      SELECT DISTINCT u.email, u.name
      FROM users u
      JOIN partners p ON p.user_id = u.id
      WHERE (
        p.id = p_partner_id
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
  END IF;

  -- Add operator notification emails (always included regardless of partner type)
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

  -- Only send if we have TO recipients
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
          'sale_id', p_sale_id,
          'scope', p_scope,
          'entry_type', p_entry_type,
          'cpe', p_cpe,
          'power', p_power,
          'cui', p_cui,
          'tier', p_tier,
          'autoriza_documentos', p_autoriza_documentos
        )
      );

      RAISE NOTICE 'New sale email queued: TO=% BCC=% (D2D=%, operator_filter=%)',
        jsonb_array_length(v_to_recipients),
        jsonb_array_length(v_bcc_recipients),
        COALESCE(v_partner_type = 'D2D', false),
        COALESCE(array_length(v_operator_user_ids, 1), 0);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error sending new sale email: %', SQLERRM;
    END;
  END IF;
END;
$$;
