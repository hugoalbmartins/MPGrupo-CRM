/*
# Correct normal new-sale email recipient rules

1. Purpose
- Normal (non-blocked, non-treatment) sales now produce two separate email
  deliveries instead of one combined send:
  * Admin/Backoffice users (operator notification_user_ids if set, otherwise
    all admin/bo users with email alerts enabled) receive the sale WITHOUT
    attachments and WITH the partner name visible.
  * Operator notification_emails (external addresses) receive the sale WITH
    attachments and WITHOUT the partner name.
- The optional partner BCC path (email_bcc_enabled) is preserved unchanged.
- Blocked-sale and internal-treatment flows are preserved unchanged.

2. Data safety
- No tables, columns, or rows are changed or deleted.
- Only the notification function is replaced.
*/

CREATE OR REPLACE FUNCTION public.create_new_sale_alert_with_email(
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
  p_service_type text DEFAULT NULL::text,
  p_activation_type text DEFAULT NULL::text,
  p_has_tv boolean DEFAULT false,
  p_has_net boolean DEFAULT false,
  p_has_lr boolean DEFAULT false,
  p_fix_ported boolean DEFAULT false,
  p_fix_number text DEFAULT NULL::text,
  p_fix_operator text DEFAULT NULL::text,
  p_mobile_count integer DEFAULT 0,
  p_mobile_numbers jsonb DEFAULT '[]'::jsonb,
  p_partner_name text DEFAULT NULL::text,
  p_email_fields jsonb DEFAULT NULL::jsonb,
  p_client_contact text DEFAULT NULL::text,
  p_client_email text DEFAULT NULL::text,
  p_client_iban text DEFAULT NULL::text,
  p_address text DEFAULT NULL::text,
  p_installation_address text DEFAULT NULL::text,
  p_energy_sale_type text DEFAULT NULL::text,
  p_monthly_value numeric DEFAULT NULL::numeric,
  p_current_monthly_fee numeric DEFAULT NULL::numeric,
  p_contracted_monthly_fee numeric DEFAULT NULL::numeric,
  p_has_direct_debit boolean DEFAULT false,
  p_has_electronic_invoice boolean DEFAULT false,
  p_observations text DEFAULT NULL::text,
  p_voltage_type text DEFAULT NULL::text,
  p_additional_services text DEFAULT NULL::text,
  p_from_email text DEFAULT NULL::text,
  p_from_smtp_pass text DEFAULT NULL::text,
  p_fix_cvp text DEFAULT NULL::text,
  p_operator_requires_additional_services boolean DEFAULT false,
  p_campaign text DEFAULT NULL::text,
  p_sale_type text DEFAULT 'normal'::text,
  p_billing_address text DEFAULT NULL::text,
  p_energy_points_list jsonb DEFAULT '[]'::jsonb,
  p_ev_outlet_count integer DEFAULT NULL::integer,
  p_ev_monthly_fee numeric DEFAULT NULL::numeric,
  p_ev_margin numeric DEFAULT NULL::numeric,
  p_ev_fidelization_months integer DEFAULT NULL::integer,
  p_is_blocked_sale boolean DEFAULT false,
  p_is_internal_treatment boolean DEFAULT false,
  p_tariff_schedule text DEFAULT NULL::text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user_ids uuid[] := '{}';
  v_rec RECORD;
  v_admin_recipients jsonb := '[]'::jsonb;
  v_partner_recipients jsonb := '[]'::jsonb;
  v_operator_recipients jsonb := '[]'::jsonb;
  v_supabase_url text;
  v_supabase_anon_key text;
  v_alerts_suspended boolean;
  v_operator_emails text[];
  v_operator_user_ids uuid[];
  v_email text;
  v_partner_type text;
  v_partner_email text;
  v_partner_bcc_enabled boolean;
  v_base_payload jsonb;
  v_email_extras jsonb;
BEGIN
  SELECT partner_type, email, email_bcc_enabled
  INTO v_partner_type, v_partner_email, v_partner_bcc_enabled
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
    'observations', p_observations
  ) || jsonb_build_object(
    'email_fields', p_email_fields,
    'voltage_type', p_voltage_type,
    'additional_services', p_additional_services,
    'operator_requires_additional_services', p_operator_requires_additional_services,
    'campaign', p_campaign,
    'tariff_schedule', p_tariff_schedule,
    'sale_type', p_sale_type,
    'billing_address', p_billing_address,
    'energy_points_list', p_energy_points_list,
    'ev_outlet_count', p_ev_outlet_count,
    'ev_monthly_fee', p_ev_monthly_fee,
    'ev_margin', p_ev_margin,
    'ev_fidelization_months', p_ev_fidelization_months
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

  -- ===== BLOCKED SALE =====
  IF p_is_blocked_sale THEN
    FOR v_rec IN
      SELECT email, name FROM users
      WHERE role IN ('admin', 'bo')
      AND COALESCE(email_alerts_enabled, true) = true
    LOOP
      v_admin_recipients := v_admin_recipients || jsonb_build_object('email', v_rec.email, 'name', v_rec.name);
    END LOOP;

    IF jsonb_array_length(v_admin_recipients) > 0 THEN
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-new-sale-email',
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_supabase_anon_key),
          body := v_base_payload || v_email_extras || jsonb_build_object(
            'to_recipients', v_admin_recipients,
            'show_partner', false,
            'include_attachments', true,
            'is_blocked_sale', true
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error sending blocked sale email: %', SQLERRM;
      END;
    END IF;
    RETURN;
  END IF;

  -- ===== INTERNAL TREATMENT =====
  IF p_is_internal_treatment THEN
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
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_supabase_anon_key),
          body := v_base_payload || v_email_extras || jsonb_build_object(
            'to_recipients', v_admin_recipients,
            'show_partner', false,
            'include_attachments', true,
            'is_internal_treatment', true
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error sending internal treatment email: %', SQLERRM;
      END;
    END IF;
    RETURN;
  END IF;

  -- ===== NORMAL SALE =====

  -- Optional partner BCC: no attachments, partner name visible
  IF v_partner_bcc_enabled IS TRUE
     AND v_partner_email IS NOT NULL AND v_partner_email != '' THEN
    v_partner_recipients := jsonb_build_array(
      jsonb_build_object('email', v_partner_email, 'name', COALESCE(p_partner_name, 'Parceiro'))
    );
    BEGIN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-new-sale-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_supabase_anon_key),
        body := v_base_payload || v_email_extras || jsonb_build_object(
          'to_recipients', v_partner_recipients,
          'show_partner', true,
          'include_attachments', false,
          'attachments', '[]'::jsonb
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error sending partner email: %', SQLERRM;
    END;
  END IF;

  -- Admin/BO recipients: no attachments, partner name visible
  v_admin_recipients := '[]'::jsonb;
  IF v_operator_user_ids IS NOT NULL AND array_length(v_operator_user_ids, 1) > 0 THEN
    FOR v_rec IN
      SELECT email, name FROM users
      WHERE id = ANY(v_operator_user_ids)
      AND COALESCE(email_alerts_enabled, true) = true
    LOOP
      v_admin_recipients := v_admin_recipients || jsonb_build_object('email', v_rec.email, 'name', v_rec.name);
    END LOOP;

    FOR v_rec IN
      SELECT email, name FROM users
      WHERE role = 'admin'
      AND COALESCE(email_alerts_enabled, true) = true
      AND id != ALL(v_operator_user_ids)
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
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_supabase_anon_key),
        body := v_base_payload || v_email_extras || jsonb_build_object(
          'to_recipients', v_admin_recipients,
          'show_partner', true,
          'include_attachments', false,
          'attachments', '[]'::jsonb
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error sending admin/BO email: %', SQLERRM;
    END;
  END IF;

  -- Operator external notification emails: with attachments, partner name hidden
  v_operator_recipients := '[]'::jsonb;
  IF v_operator_emails IS NOT NULL AND array_length(v_operator_emails, 1) > 0 THEN
    FOREACH v_email IN ARRAY v_operator_emails
    LOOP
      IF v_email IS NOT NULL AND v_email != '' THEN
        v_operator_recipients := v_operator_recipients || jsonb_build_object('email', v_email, 'name', p_operator_name);
      END IF;
    END LOOP;
  END IF;

  IF jsonb_array_length(v_operator_recipients) > 0 THEN
    BEGIN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-new-sale-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_supabase_anon_key),
        body := v_base_payload || v_email_extras || jsonb_build_object(
          'to_recipients', v_operator_recipients,
          'show_partner', false,
          'include_attachments', true
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error sending operator notification email: %', SQLERRM;
    END;
  END IF;
END;
$function$;