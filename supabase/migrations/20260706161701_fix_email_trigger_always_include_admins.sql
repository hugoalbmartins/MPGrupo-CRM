/*
# Fix email trigger to always include admins regardless of operator notification_user_ids

1. Modified Functions
   - `create_new_sale_alert_with_email` - When notification_user_ids is set on an operator,
     it now includes BOTH the specified users AND all admin users with email_alerts_enabled=true.
     Previously it ONLY sent to the specified users, excluding admins not in the list.

2. Important Notes
   - This ensures admin users always receive sale emails regardless of per-operator config
   - BO users are still controlled by the notification_user_ids setting as before
   - The fix merges: operator-specified users + all admins with alerts enabled
   - Duplicate emails are prevented by checking if email already exists in recipients
*/

CREATE OR REPLACE FUNCTION create_new_sale_alert_with_email(
  p_sale_code text,
  p_client_name text,
  p_operator_name text,
  p_partner_name text,
  p_status text,
  p_scope text,
  p_service_type text,
  p_sale_date text,
  p_partner_type text,
  p_energy_sale_type text DEFAULT NULL,
  p_entry_type text DEFAULT NULL,
  p_power text DEFAULT NULL,
  p_tier text DEFAULT NULL,
  p_client_nif text DEFAULT NULL,
  p_cpe text DEFAULT NULL,
  p_cui text DEFAULT NULL,
  p_monthly_value text DEFAULT NULL,
  p_has_direct_debit boolean DEFAULT false,
  p_has_electronic_invoice boolean DEFAULT false,
  p_autoriza_documentos text DEFAULT NULL,
  p_portability_numbers text DEFAULT NULL,
  p_mobile_numbers text DEFAULT NULL,
  p_mobile_monthly_value text DEFAULT NULL,
  p_activation_type text DEFAULT NULL,
  p_operator_id uuid DEFAULT NULL,
  p_partner_id uuid DEFAULT NULL,
  p_voltage_type text DEFAULT NULL,
  p_additional_services text DEFAULT NULL,
  p_attachments jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url text;
  v_anon_key text;
  v_operator_user_ids uuid[];
  v_operator_emails text[];
  v_admin_recipients jsonb := '[]'::jsonb;
  v_partner_recipients jsonb := '[]'::jsonb;
  v_operator_external jsonb := '[]'::jsonb;
  v_email_fields jsonb := '{}'::jsonb;
  v_operator_smtp_email text;
  v_operator_smtp_pass text;
  v_rec record;
  v_email_extras jsonb := '{}'::jsonb;
  v_partner_bcc_enabled boolean := false;
  v_partner_email text;
  v_alert_suspended boolean := false;
  v_seen_emails text[] := '{}';
BEGIN
  SELECT COALESCE(current_setting('app.settings.supabase_url', true), '')
  INTO v_supabase_url;

  IF v_supabase_url = '' THEN
    SELECT value INTO v_supabase_url FROM system_settings WHERE key = 'supabase_url';
  END IF;

  SELECT COALESCE(current_setting('app.settings.supabase_anon_key', true), '')
  INTO v_anon_key;

  IF v_anon_key = '' THEN
    SELECT value INTO v_anon_key FROM system_settings WHERE key = 'supabase_anon_key';
  END IF;

  IF v_supabase_url IS NULL OR v_anon_key IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    SELECT are_alerts_suspended() INTO v_alert_suspended;
  EXCEPTION WHEN OTHERS THEN
    v_alert_suspended := false;
  END;

  IF v_alert_suspended THEN
    RETURN;
  END IF;

  -- Insert alert record
  INSERT INTO alerts (type, title, message, severity, data)
  VALUES (
    'new_sale',
    'Nova Venda: ' || p_sale_code,
    'Cliente: ' || COALESCE(p_client_name, 'N/A') || ' | Operadora: ' || COALESCE(p_operator_name, 'N/A') || ' | Parceiro: ' || COALESCE(p_partner_name, 'N/A'),
    'info',
    jsonb_build_object('sale_code', p_sale_code, 'operator', p_operator_name, 'partner', p_partner_name, 'scope', p_scope)
  );

  -- Get operator config
  IF p_operator_id IS NOT NULL THEN
    SELECT notification_user_ids, notification_emails, email_fields, smtp_email, smtp_pass
    INTO v_operator_user_ids, v_operator_emails, v_email_fields, v_operator_smtp_email, v_operator_smtp_pass
    FROM operators WHERE id = p_operator_id;
  END IF;

  -- Get partner BCC preference
  IF p_partner_id IS NOT NULL THEN
    SELECT COALESCE(email_bcc_enabled, false), email
    INTO v_partner_bcc_enabled, v_partner_email
    FROM partners WHERE id = p_partner_id;
  END IF;

  -- Build email extras
  IF v_email_fields IS NOT NULL AND v_email_fields != '{}'::jsonb THEN
    v_email_extras := jsonb_build_object('email_fields', v_email_fields);
  END IF;
  IF v_operator_smtp_email IS NOT NULL AND v_operator_smtp_email != '' THEN
    v_email_extras := v_email_extras || jsonb_build_object('from_email', v_operator_smtp_email, 'from_smtp_pass', v_operator_smtp_pass);
  END IF;

  -- Build attachments extra
  IF p_attachments IS NOT NULL AND jsonb_array_length(p_attachments) > 0 THEN
    v_email_extras := v_email_extras || jsonb_build_object('attachments', p_attachments);
  END IF;

  -- CALL 1: Build admin/BO recipients
  -- When notification_user_ids is set, include those users PLUS all admins
  -- This ensures admins always receive emails regardless of operator-specific settings
  IF v_operator_user_ids IS NOT NULL AND array_length(v_operator_user_ids, 1) > 0 THEN
    -- Include specified users (BO or admin)
    FOR v_rec IN
      SELECT email, name FROM users
      WHERE id = ANY(v_operator_user_ids)
      AND COALESCE(email_alerts_enabled, true) = true
    LOOP
      IF NOT (v_rec.email = ANY(v_seen_emails)) THEN
        v_admin_recipients := v_admin_recipients || jsonb_build_object('email', v_rec.email, 'name', v_rec.name);
        v_seen_emails := v_seen_emails || v_rec.email;
      END IF;
    END LOOP;
    -- Also include all admins not already in the list
    FOR v_rec IN
      SELECT email, name FROM users
      WHERE role = 'admin'
      AND COALESCE(email_alerts_enabled, true) = true
      AND NOT (email = ANY(v_seen_emails))
    LOOP
      v_admin_recipients := v_admin_recipients || jsonb_build_object('email', v_rec.email, 'name', v_rec.name);
      v_seen_emails := v_seen_emails || v_rec.email;
    END LOOP;
  ELSE
    -- Default: all admins and BO
    FOR v_rec IN
      SELECT email, name FROM users
      WHERE role IN ('admin', 'bo')
      AND COALESCE(email_alerts_enabled, true) = true
    LOOP
      v_admin_recipients := v_admin_recipients || jsonb_build_object('email', v_rec.email, 'name', v_rec.name);
      v_seen_emails := v_seen_emails || v_rec.email;
    END LOOP;
  END IF;

  IF jsonb_array_length(v_admin_recipients) > 0 THEN
    BEGIN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-new-sale-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body := jsonb_build_object(
          'sale_code', p_sale_code,
          'client_name', p_client_name,
          'operator_name', p_operator_name,
          'partner_name', p_partner_name,
          'status', p_status,
          'scope', p_scope,
          'service_type', p_service_type,
          'sale_date', p_sale_date,
          'partner_type', p_partner_type,
          'energy_sale_type', p_energy_sale_type,
          'entry_type', p_entry_type,
          'power', p_power,
          'tier', p_tier,
          'client_nif', p_client_nif,
          'cpe', p_cpe,
          'cui', p_cui,
          'monthly_value', p_monthly_value,
          'has_direct_debit', p_has_direct_debit,
          'has_electronic_invoice', p_has_electronic_invoice,
          'autoriza_documentos', p_autoriza_documentos,
          'portability_numbers', p_portability_numbers,
          'mobile_numbers', p_mobile_numbers,
          'mobile_monthly_value', p_mobile_monthly_value,
          'activation_type', p_activation_type,
          'voltage_type', p_voltage_type,
          'additional_services', p_additional_services,
          'recipients', v_admin_recipients,
          'show_partner', true,
          'extras', v_email_extras
        ),
        timeout_milliseconds := 5000
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- CALL 2: Partner/Commercial users (excluding D2D)
  IF p_partner_type IS NULL OR p_partner_type != 'D2D' THEN
    FOR v_rec IN
      SELECT email, name FROM users
      WHERE (
        (partner_id = p_partner_id)
        OR (id IN (SELECT created_by FROM sales WHERE sale_code = p_sale_code LIMIT 1))
      )
      AND role IN ('partner', 'partner_commercial')
      AND COALESCE(email_alerts_enabled, true) = true
      AND NOT (email = ANY(v_seen_emails))
    LOOP
      v_partner_recipients := v_partner_recipients || jsonb_build_object('email', v_rec.email, 'name', v_rec.name);
    END LOOP;

    -- Add partner BCC if enabled
    IF v_partner_bcc_enabled AND v_partner_email IS NOT NULL AND v_partner_email != '' THEN
      v_partner_recipients := v_partner_recipients || jsonb_build_object('email', v_partner_email, 'name', 'Parceiro (BCC)');
    END IF;

    IF jsonb_array_length(v_partner_recipients) > 0 THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-new-sale-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_anon_key
          ),
          body := jsonb_build_object(
            'sale_code', p_sale_code,
            'client_name', p_client_name,
            'operator_name', p_operator_name,
            'partner_name', p_partner_name,
            'status', p_status,
            'scope', p_scope,
            'service_type', p_service_type,
            'sale_date', p_sale_date,
            'partner_type', p_partner_type,
            'energy_sale_type', p_energy_sale_type,
            'entry_type', p_entry_type,
            'power', p_power,
            'tier', p_tier,
            'client_nif', p_client_nif,
            'cpe', p_cpe,
            'cui', p_cui,
            'monthly_value', p_monthly_value,
            'has_direct_debit', p_has_direct_debit,
            'has_electronic_invoice', p_has_electronic_invoice,
            'autoriza_documentos', p_autoriza_documentos,
            'portability_numbers', p_portability_numbers,
            'mobile_numbers', p_mobile_numbers,
            'mobile_monthly_value', p_mobile_monthly_value,
            'activation_type', p_activation_type,
            'voltage_type', p_voltage_type,
            'additional_services', p_additional_services,
            'recipients', v_partner_recipients,
            'show_partner', false,
            'extras', v_email_extras
          ),
          timeout_milliseconds := 5000
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  -- CALL 3: External operator notification emails (with attachments, operator SMTP)
  IF v_operator_emails IS NOT NULL AND array_length(v_operator_emails, 1) > 0 THEN
    FOR i IN 1..array_length(v_operator_emails, 1) LOOP
      v_operator_external := v_operator_external || jsonb_build_object('email', v_operator_emails[i], 'name', 'Operadora');
    END LOOP;

    IF jsonb_array_length(v_operator_external) > 0 THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-new-sale-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_anon_key
          ),
          body := jsonb_build_object(
            'sale_code', p_sale_code,
            'client_name', p_client_name,
            'operator_name', p_operator_name,
            'partner_name', p_partner_name,
            'status', p_status,
            'scope', p_scope,
            'service_type', p_service_type,
            'sale_date', p_sale_date,
            'partner_type', p_partner_type,
            'energy_sale_type', p_energy_sale_type,
            'entry_type', p_entry_type,
            'power', p_power,
            'tier', p_tier,
            'client_nif', p_client_nif,
            'cpe', p_cpe,
            'cui', p_cui,
            'monthly_value', p_monthly_value,
            'has_direct_debit', p_has_direct_debit,
            'has_electronic_invoice', p_has_electronic_invoice,
            'autoriza_documentos', p_autoriza_documentos,
            'portability_numbers', p_portability_numbers,
            'mobile_numbers', p_mobile_numbers,
            'mobile_monthly_value', p_mobile_monthly_value,
            'activation_type', p_activation_type,
            'voltage_type', p_voltage_type,
            'additional_services', p_additional_services,
            'recipients', v_operator_external,
            'show_partner', true,
            'extras', v_email_extras
          ),
          timeout_milliseconds := 5000
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;
END;
$$;
