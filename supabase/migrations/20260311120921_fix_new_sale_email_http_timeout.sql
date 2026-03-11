/*
  # Fix new sale email: increase net.http_post timeout

  ## Problem
  The net.http_post calls inside create_new_sale_alert_with_email were using
  the default 5000ms timeout. The SMTP edge function requires ~15-30 seconds
  to connect and send via SMTP, causing all email requests to time out silently.

  ## Fix
  Rebuild the function with timeout_milliseconds := 90000 (90 seconds) on all
  three net.http_post calls (admin/BO, partner, operator notification emails).

  Also fix the manual resend path: same function, same timeout increase.
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
  p_attachments jsonb,
  p_scope text,
  p_entry_type text,
  p_cpe text,
  p_power text,
  p_cui text,
  p_tier text,
  p_autoriza_documentos text,
  p_service_type text DEFAULT NULL,
  p_activation_type text DEFAULT NULL,
  p_has_tv boolean DEFAULT false,
  p_has_net boolean DEFAULT false,
  p_has_lr boolean DEFAULT false,
  p_fix_ported boolean DEFAULT false,
  p_fix_number text DEFAULT NULL,
  p_fix_operator text DEFAULT NULL,
  p_mobile_count integer DEFAULT 0,
  p_mobile_numbers jsonb DEFAULT '[]'::jsonb,
  p_partner_name text DEFAULT NULL,
  p_email_fields jsonb DEFAULT NULL,
  p_client_contact text DEFAULT NULL,
  p_client_email text DEFAULT NULL,
  p_client_iban text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_installation_address text DEFAULT NULL,
  p_energy_sale_type text DEFAULT NULL,
  p_monthly_value numeric DEFAULT NULL,
  p_current_monthly_fee numeric DEFAULT NULL,
  p_contracted_monthly_fee numeric DEFAULT NULL,
  p_has_direct_debit boolean DEFAULT false,
  p_has_electronic_invoice boolean DEFAULT false,
  p_observations text DEFAULT NULL,
  p_voltage_type text DEFAULT NULL,
  p_additional_services text DEFAULT NULL,
  p_from_email text DEFAULT NULL,
  p_from_smtp_pass text DEFAULT NULL,
  p_fix_cvp text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_ids uuid[] := '{}';
  v_rec RECORD;
  v_admin_recipients jsonb := '[]'::jsonb;
  v_partner_recipients jsonb := '[]'::jsonb;
  v_supabase_url text;
  v_supabase_anon_key text;
  v_alerts_suspended boolean;
  v_operator_emails text[];
  v_operator_user_ids uuid[];
  v_email text;
  v_partner_type text;
  v_base_payload jsonb;
  v_email_extras jsonb;
BEGIN
  SELECT partner_type INTO v_partner_type
  FROM partners WHERE id = p_partner_id;

  FOR v_rec IN
    SELECT user_id FROM get_alert_recipients(p_sale_id, p_partner_id, p_created_by_user_id)
  LOOP
    v_user_ids := array_append(v_user_ids, v_rec.user_id);
  END LOOP;

  INSERT INTO alerts (type, sale_id, sale_code, message, user_ids, created_by, created_by_name)
  VALUES ('new_sale', p_sale_id, p_sale_code, p_message, v_user_ids, p_created_by, p_created_by_name);

  v_alerts_suspended := are_alerts_suspended();
  IF v_alerts_suspended THEN
    RAISE NOTICE 'Emails suspended globally - alert created but no email sent for %', p_sale_code;
    RETURN;
  END IF;

  SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
  SELECT value INTO v_supabase_anon_key FROM system_config WHERE key = 'supabase_anon_key';

  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := 'https://iydhpyljcofpztrzjnfr.supabase.co';
  END IF;

  IF v_supabase_anon_key IS NULL OR v_supabase_anon_key = '' THEN
    RAISE NOTICE 'No supabase_anon_key found in system_config - cannot send email for %', p_sale_code;
    RETURN;
  END IF;

  SELECT notification_user_ids, notification_emails
  INTO v_operator_user_ids, v_operator_emails
  FROM operators WHERE id = p_operator_id;

  v_base_payload := jsonb_build_object(
    'sale_code', p_sale_code,
    'customer_name', p_customer_name,
    'customer_nif', COALESCE(p_customer_nif, ''),
    'operator_name', p_operator_name,
    'partner_name', COALESCE(p_partner_name, ''),
    'message', p_message,
    'attachments', p_attachments,
    'sale_id', p_sale_id,
    'scope', p_scope,
    'client_contact', p_client_contact,
    'client_email', p_client_email,
    'client_iban', p_client_iban,
    'address', p_address,
    'installation_address', p_installation_address,
    'entry_type', p_entry_type,
    'energy_sale_type', p_energy_sale_type,
    'cpe', p_cpe,
    'power', p_power,
    'cui', p_cui,
    'tier', p_tier,
    'autoriza_documentos', p_autoriza_documentos,
    'service_type', p_service_type,
    'activation_type', p_activation_type,
    'monthly_value', p_monthly_value,
    'current_monthly_fee', p_current_monthly_fee,
    'contracted_monthly_fee', p_contracted_monthly_fee,
    'has_tv', p_has_tv,
    'has_net', p_has_net,
    'has_lr', p_has_lr,
    'has_direct_debit', p_has_direct_debit,
    'has_electronic_invoice', p_has_electronic_invoice,
    'fix_ported', p_fix_ported,
    'fix_number', p_fix_number,
    'fix_operator', p_fix_operator,
    'fix_cvp', p_fix_cvp,
    'mobile_count', p_mobile_count,
    'mobile_numbers', p_mobile_numbers,
    'observations', p_observations,
    'email_fields', p_email_fields,
    'voltage_type', p_voltage_type,
    'additional_services', p_additional_services
  );

  IF p_from_email IS NOT NULL AND p_from_email != '' AND p_from_smtp_pass IS NOT NULL AND p_from_smtp_pass != '' THEN
    v_email_extras := jsonb_build_object(
      'from_email', p_from_email,
      'from_smtp_user', p_from_email,
      'from_smtp_pass', p_from_smtp_pass
    );
  ELSE
    v_email_extras := '{}'::jsonb;
  END IF;

  -- CALL 1: Admins/BO or operator-specific users (show_partner = true)
  IF v_operator_user_ids IS NOT NULL AND array_length(v_operator_user_ids, 1) > 0 THEN
    FOR v_rec IN
      SELECT email, name FROM users
      WHERE id = ANY(v_operator_user_ids)
      AND COALESCE(email_alerts_enabled, true) = true
    LOOP
      v_admin_recipients := v_admin_recipients || jsonb_build_object('email', v_rec.email, 'name', v_rec.name);
    END LOOP;
  ELSE
    FOR v_rec IN
      SELECT email, name FROM users
      WHERE role IN ('admin', 'bo')
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
          'show_partner', true
        ),
        timeout_milliseconds := 90000
      );
      RAISE NOTICE 'New sale email (admins) queued: %', jsonb_array_length(v_admin_recipients);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error sending admin email: %', SQLERRM;
    END;
  END IF;

  -- CALL 2: Partner / vendedor (show_partner = true)
  IF v_partner_type IS DISTINCT FROM 'D2D' THEN
    FOR v_rec IN
      SELECT DISTINCT u.email, u.name
      FROM users u
      JOIN partners p ON p.user_id = u.id
      WHERE (
        p.id = p_partner_id
        OR (u.id = p_created_by_user_id AND u.role IN ('partner', 'partner_commercial'))
      )
      AND COALESCE(u.email_alerts_enabled, true) = true
    LOOP
      v_partner_recipients := v_partner_recipients || jsonb_build_object('email', v_rec.email, 'name', v_rec.name);
    END LOOP;

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
            'show_partner', true
          ),
          timeout_milliseconds := 90000
        );
        RAISE NOTICE 'New sale email (partner) queued: %', jsonb_array_length(v_partner_recipients);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error sending partner email: %', SQLERRM;
      END;
    END IF;
  END IF;

  -- CALL 3: Operator notification emails (show_partner = false)
  IF v_operator_emails IS NOT NULL AND array_length(v_operator_emails, 1) > 0 THEN
    DECLARE
      v_op_recipients jsonb := '[]'::jsonb;
    BEGIN
      FOREACH v_email IN ARRAY v_operator_emails
      LOOP
        IF v_email IS NOT NULL AND v_email != '' THEN
          v_op_recipients := v_op_recipients || jsonb_build_object('email', v_email, 'name', p_operator_name);
        END IF;
      END LOOP;

      IF jsonb_array_length(v_op_recipients) > 0 THEN
        BEGIN
          PERFORM net.http_post(
            url := v_supabase_url || '/functions/v1/send-new-sale-email',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_supabase_anon_key
            ),
            body := v_base_payload || v_email_extras || jsonb_build_object(
              'to_recipients', v_op_recipients,
              'show_partner', false
            ),
            timeout_milliseconds := 90000
          );
          RAISE NOTICE 'New sale email (operator emails) queued: %', jsonb_array_length(v_op_recipients);
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Error sending operator email: %', SQLERRM;
        END;
      END IF;
    END;
  END IF;
END;
$$;
