/*
  # Add energy fields to new sale email function

  1. Changes
    - Updates `create_new_sale_alert_with_email` function to include energy-specific fields
    - Adds parameters: p_scope, p_entry_type, p_cpe, p_power, p_cui, p_tier
    - Passes these fields to the send-new-sale-email edge function
    
  2. Purpose
    - When scope is 'energia' or 'energias', the email will display:
      - Tipo de Entrada (entry_type)
      - CPE + Potencia (cpe + power)
      - CUI + Escalao (cui + tier)
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
  p_attachments jsonb DEFAULT '[]'::jsonb,
  p_scope text DEFAULT NULL,
  p_entry_type text DEFAULT NULL,
  p_cpe text DEFAULT NULL,
  p_power text DEFAULT NULL,
  p_cui text DEFAULT NULL,
  p_tier text DEFAULT NULL
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
  v_body jsonb;
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
      v_body := jsonb_build_object(
        'to_recipients', v_to_recipients,
        'bcc_recipients', v_bcc_recipients,
        'sale_code', p_sale_code,
        'customer_name', p_customer_name,
        'customer_nif', COALESCE(p_customer_nif, ''),
        'operator_name', p_operator_name,
        'message', p_message,
        'attachments', p_attachments,
        'sale_id', p_sale_id
      );

      IF p_scope IS NOT NULL THEN
        v_body := v_body || jsonb_build_object('scope', p_scope);
      END IF;

      IF p_entry_type IS NOT NULL THEN
        v_body := v_body || jsonb_build_object('entry_type', p_entry_type);
      END IF;

      IF p_cpe IS NOT NULL THEN
        v_body := v_body || jsonb_build_object('cpe', p_cpe);
      END IF;

      IF p_power IS NOT NULL THEN
        v_body := v_body || jsonb_build_object('power', p_power);
      END IF;

      IF p_cui IS NOT NULL THEN
        v_body := v_body || jsonb_build_object('cui', p_cui);
      END IF;

      IF p_tier IS NOT NULL THEN
        v_body := v_body || jsonb_build_object('tier', p_tier);
      END IF;

      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-new-sale-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_supabase_anon_key
        ),
        body := v_body
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error sending new sale email: %', SQLERRM;
    END;
  END IF;
END;
$$;
