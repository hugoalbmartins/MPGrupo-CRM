/*
# Internal treatment (pre-tratamento interno) for operators

## Summary
Adds the ability to mark operators as requiring "internal treatment" before
processing. Sales registered for such operators go into a "Para Tratamento"
state — emails are sent only to selected admin/BO users (the ones configured
in notification_user_ids), with attachments. When an admin/BO clicks
"Tratado Interno" and enters an opportunity/registration number, the sale
moves to normal status and the standard new-sale email flow is triggered
for all normal recipients (including operator notification emails), with the
opportunity number shown at the top of the sale data in the email.

## Changes to `operators` table
- `requires_internal_treatment` (boolean, default false): when true, sales
  for this operator are held in "Para Tratamento" status

## Changes to `sales` table
- `internal_treatment` (boolean, default false): marks sales awaiting
  internal treatment
- `oportunidade_number` (text, nullable): the opportunity/registration
  number entered by the admin/BO when marking the sale as "tratado interno"

## Trigger changes
- `trigger_new_sale_alert`: checks the operator's
  `requires_internal_treatment` flag; if true, sets `p_is_internal_treatment`
  = true
- `create_new_sale_alert_with_email`: accepts `p_is_internal_treatment`;
  when true, sends only to the operator's notification_user_ids (or all
  admins/BO if none configured), with attachments, subject prefixed
  "TRATAMENTO INTERNO"

## Notes
- No data is lost; existing operators default to false (unchanged behavior)
- Available for new and existing operators
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'operators' AND column_name = 'requires_internal_treatment') THEN
    ALTER TABLE operators ADD COLUMN requires_internal_treatment boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'internal_treatment') THEN
    ALTER TABLE sales ADD COLUMN internal_treatment boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'oportunidade_number') THEN
    ALTER TABLE sales ADD COLUMN oportunidade_number text;
  END IF;
END $$;

-- Update create_new_sale_alert_with_email to accept p_is_internal_treatment
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
  p_fix_cvp text DEFAULT NULL,
  p_operator_requires_additional_services boolean DEFAULT false,
  p_campaign text DEFAULT NULL,
  p_sale_type text DEFAULT 'normal',
  p_billing_address text DEFAULT NULL,
  p_energy_points_list jsonb DEFAULT '[]'::jsonb,
  p_ev_outlet_count integer DEFAULT NULL,
  p_ev_monthly_fee numeric DEFAULT NULL,
  p_ev_margin numeric DEFAULT NULL,
  p_ev_fidelization_months integer DEFAULT NULL,
  p_is_blocked_sale boolean DEFAULT false,
  p_is_internal_treatment boolean DEFAULT false
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
    'observations', p_observations,
    'email_fields', p_email_fields,
    'voltage_type', p_voltage_type,
    'additional_services', p_additional_services,
    'operator_requires_additional_services', p_operator_requires_additional_services,
    'campaign', p_campaign,
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

  -- ===== BLOCKED SALE: only admins/BO get email with VENDA BLOQUEADA =====
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
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_supabase_anon_key
          ),
          body := v_base_payload || v_email_extras || jsonb_build_object(
            'to_recipients', v_admin_recipients,
            'show_partner', false,
            'include_attachments', true,
            'is_blocked_sale', true
          )
        );
        RAISE NOTICE 'Blocked sale email sent to admins/BO only: %', jsonb_array_length(v_admin_recipients);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error sending blocked sale email: %', SQLERRM;
      END;
    END IF;

    RETURN;
  END IF;

  -- ===== INTERNAL TREATMENT: only selected admin/BO users, with attachments =====
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
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_supabase_anon_key
          ),
          body := v_base_payload || v_email_extras || jsonb_build_object(
            'to_recipients', v_admin_recipients,
            'show_partner', false,
            'include_attachments', true,
            'is_internal_treatment', true
          )
        );
        RAISE NOTICE 'Internal treatment email sent to selected admins/BO: %', jsonb_array_length(v_admin_recipients);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error sending internal treatment email: %', SQLERRM;
      END;
    END IF;

    RETURN;
  END IF;

  -- ===== NORMAL SALE: full email flow =====

  -- CALL A: Partner email (record-level email, only if BCC authorization enabled)
  IF v_partner_bcc_enabled IS TRUE
     AND v_partner_email IS NOT NULL AND v_partner_email != '' THEN
    v_partner_recipients := jsonb_build_array(
      jsonb_build_object('email', v_partner_email, 'name', COALESCE(p_partner_name, 'Parceiro'))
    );

    BEGIN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-new-sale-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_supabase_anon_key
        ),
        body := v_base_payload || v_email_extras || jsonb_build_object(
          'to_recipients', v_partner_recipients,
          'show_partner', true,
          'include_attachments', false,
          'attachments', '[]'::jsonb
        )
      );
      RAISE NOTICE 'New sale email (partner) queued to %', v_partner_email;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error sending partner email: %', SQLERRM;
    END;
  END IF;

  -- CALL B: Combined admins/BO + operator-specific users + external operator emails
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

  -- Add external operator notification emails to the same recipient list
  IF v_operator_emails IS NOT NULL AND array_length(v_operator_emails, 1) > 0 THEN
    FOREACH v_email IN ARRAY v_operator_emails
    LOOP
      IF v_email IS NOT NULL AND v_email != '' THEN
        v_admin_recipients := v_admin_recipients || jsonb_build_object('email', v_email, 'name', p_operator_name);
      END IF;
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
          'show_partner', false,
          'include_attachments', true
        )
      );
      RAISE NOTICE 'New sale email (admins+operator) queued: %', jsonb_array_length(v_admin_recipients);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error sending admins+operator email: %', SQLERRM;
    END;
  END IF;
END;
$$;

-- Update trigger to detect operators with requires_internal_treatment
CREATE OR REPLACE FUNCTION trigger_new_sale_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator_name text;
  v_attachments jsonb;
  v_partner_name text;
  v_email_fields jsonb;
  v_address text;
  v_op_email_envio text;
  v_op_email_password text;
  v_from_email text;
  v_requires_additional_services boolean;
  v_energy_points jsonb := '[]'::jsonb;
  v_point RECORD;
  v_partner_sales_blocked boolean := false;
  v_op_requires_treatment boolean := false;
BEGIN
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.is_bulk_import IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_creator_name FROM users WHERE id = NEW.created_by_user_id;
  SELECT name, sales_blocked INTO v_partner_name, v_partner_sales_blocked FROM partners WHERE id = NEW.partner_id;

  SELECT email_envio, email_password, requires_additional_services, requires_internal_treatment
    INTO v_op_email_envio, v_op_email_password, v_requires_additional_services, v_op_requires_treatment
  FROM operators WHERE id = NEW.operator_id;

  v_attachments := COALESCE(NEW.attachments, '[]'::jsonb);

  v_from_email := v_op_email_envio;

  IF NEW.scope = 'energia' THEN
    v_address := CASE
      WHEN NEW.installation_address IS NOT NULL AND NEW.installation_address != '' THEN NEW.installation_address
      ELSE COALESCE(NEW.street, '') || CASE WHEN NEW.postal_code IS NOT NULL THEN ', ' || NEW.postal_code ELSE '' END || CASE WHEN NEW.locality IS NOT NULL THEN ', ' || NEW.locality ELSE '' END
    END;
  ELSE
    v_address := COALESCE(NEW.street, '') || CASE WHEN NEW.postal_code IS NOT NULL THEN ', ' || NEW.postal_code ELSE '' END || CASE WHEN NEW.locality IS NOT NULL THEN ', ' || NEW.locality ELSE '' END;
  END IF;

  v_email_fields := NEW.email_fields;

  -- Build energy_points_list
  IF NEW.sale_type = 'multiponto' THEN
    FOR v_point IN
      SELECT point_type, point_code, power_kva, tier,
             inst_street, inst_postal_code, inst_locality,
             installation_address, billing_address,
             energy_type, entry_type, voltage_type, additional_services
      FROM sales_energy_points
      WHERE sale_id = NEW.id
      ORDER BY created_at
    LOOP
      v_energy_points := v_energy_points || jsonb_build_object(
        'point_type', v_point.point_type,
        'point_code', v_point.point_code,
        'power_kva', v_point.power_kva,
        'tier', v_point.tier,
        'inst_street', v_point.inst_street,
        'inst_postal_code', v_point.inst_postal_code,
        'inst_locality', v_point.inst_locality,
        'installation_address', v_point.installation_address,
        'billing_address', v_point.billing_address,
        'energy_type', v_point.energy_type,
        'entry_type', v_point.entry_type,
        'voltage_type', v_point.voltage_type,
        'additional_services', v_point.additional_services
      );
    END LOOP;
  ELSIF NEW.sale_type = 'multilocal' THEN
    WITH raw_points AS (
      SELECT point_type, point_code, power_kva, tier,
             inst_street, inst_postal_code, inst_locality,
             installation_address, billing_address,
             energy_type, entry_type, voltage_type, additional_services,
             created_at,
             COALESCE(
               NULLIF(TRIM(installation_address), ''),
               NULLIF(TRIM(CONCAT_WS('|', inst_street, inst_postal_code, inst_locality)), ''),
               'point-' || row_number() OVER (ORDER BY created_at)::text
             ) AS location_key
      FROM sales_energy_points
      WHERE sale_id = NEW.id
    ),
    grouped AS (
      SELECT
        location_key,
        MIN(created_at) AS first_created,
        MAX(inst_street) AS inst_street,
        MAX(inst_postal_code) AS inst_postal_code,
        MAX(inst_locality) AS inst_locality,
        MAX(installation_address) AS installation_address,
        MAX(billing_address) AS billing_address,
        MAX(energy_type) AS energy_type,
        MAX(entry_type) AS entry_type,
        MAX(voltage_type) AS voltage_type,
        MAX(additional_services) AS additional_services,
        MAX(CASE WHEN point_type = 'cpe' THEN point_code END) AS cpe_code,
        MAX(CASE WHEN point_type = 'cpe' THEN power_kva END) AS cpe_power,
        MAX(CASE WHEN point_type = 'cui' THEN point_code END) AS cui_code,
        MAX(CASE WHEN point_type = 'cui' THEN tier END) AS cui_tier
      FROM raw_points
      GROUP BY location_key
    )
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'point_type',
          CASE
            WHEN cpe_code IS NOT NULL AND cui_code IS NOT NULL THEN 'dual'
            WHEN cui_code IS NOT NULL THEN 'cui'
            ELSE 'cpe'
          END,
        'point_code', COALESCE(cpe_code, cui_code),
        'power_kva', cpe_power,
        'tier', cui_tier,
        'cpe_code', cpe_code,
        'cpe_power', cpe_power,
        'cui_code', cui_code,
        'cui_tier', cui_tier,
        'inst_street', inst_street,
        'inst_postal_code', inst_postal_code,
        'inst_locality', inst_locality,
        'installation_address', installation_address,
        'billing_address', billing_address,
        'energy_type', energy_type,
        'entry_type', entry_type,
        'voltage_type', voltage_type,
        'additional_services', additional_services
      ) ORDER BY first_created
    ), '[]'::jsonb)
    INTO v_energy_points
    FROM grouped;
  END IF;

  PERFORM create_new_sale_alert_with_email(
    NEW.id,
    NEW.sale_code,
    'Nova venda registada: ' || NEW.sale_code || ' - Cliente: ' || COALESCE(NEW.client_name, 'N/A') || ' - Operadora: ' || COALESCE(NEW.operator_name, 'N/A'),
    NEW.created_by_user_id,
    COALESCE(v_creator_name, 'Sistema'),
    NEW.partner_id,
    NEW.created_by_user_id,
    COALESCE(NEW.client_name, 'N/A'),
    COALESCE(NEW.client_nif, ''),
    COALESCE(NEW.operator_name, 'N/A'),
    NEW.operator_id,
    v_attachments,
    NEW.scope,
    NEW.entry_type,
    NEW.cpe,
    NEW.power,
    NEW.cui,
    NEW.tier,
    NEW.autoriza_documentos,
    NEW.service_type,
    NEW.activation_type,
    COALESCE(NEW.has_tv, false),
    COALESCE(NEW.has_net, false),
    COALESCE(NEW.has_lr, false),
    COALESCE(NEW.fix_ported, false),
    NEW.fix_number,
    NEW.fix_operator,
    COALESCE(NEW.mobile_count, 0),
    COALESCE(NEW.mobile_numbers, '[]'::jsonb),
    v_partner_name,
    v_email_fields,
    NEW.client_contact,
    NEW.client_email,
    NEW.client_iban,
    v_address,
    NEW.installation_address,
    NEW.energy_sale_type,
    NEW.monthly_value,
    NEW.current_monthly_fee,
    NEW.contracted_monthly_fee,
    COALESCE(NEW.has_direct_debit, false),
    COALESCE(NEW.has_electronic_invoice, false),
    NEW.observations,
    NEW.voltage_type,
    NEW.additional_services,
    v_from_email,
    v_op_email_password,
    NEW.fix_cvp,
    COALESCE(v_requires_additional_services, false),
    NEW.campaign,
    COALESCE(NEW.sale_type, 'normal'),
    NEW.billing_address,
    v_energy_points,
    NEW.ev_outlet_count,
    NEW.ev_monthly_fee,
    NEW.ev_margin,
    NEW.ev_fidelization_months,
    COALESCE(v_partner_sales_blocked, false),
    COALESCE(v_op_requires_treatment, false)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_new_sale_alert ON sales;
CREATE TRIGGER sales_new_sale_alert
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION trigger_new_sale_alert();
