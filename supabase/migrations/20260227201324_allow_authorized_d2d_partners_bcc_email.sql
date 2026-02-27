/*
  # Allow authorized D2D partners to receive BCC emails

  ## Summary
  Updates the create_new_sale_alert_with_email function to check the new
  email_bcc_enabled flag on D2D partners. By default D2D partners are excluded
  from BCC emails, but individual D2D partners can be authorized by admin/BO
  by setting email_bcc_enabled = true on the partner record.

  ## Changes
  1. Drop the existing trigger (depends on the function)
  2. Drop the existing function (to allow signature change if needed)
  3. Recreate function with updated D2D BCC logic:
     - Non-D2D partners: always included in BCC (existing behavior)
     - D2D partners with email_bcc_enabled = true: included in BCC
     - D2D partners with email_bcc_enabled = false: excluded from BCC (default)
  4. Recreate the trigger

  ## Logic Change
  Old: IF v_partner_type IS DISTINCT FROM 'D2D' THEN -- add BCC
  New: IF v_partner_type IS DISTINCT FROM 'D2D' OR v_partner_bcc_enabled = true THEN -- add BCC
*/

-- Step 1: Drop trigger
DROP TRIGGER IF EXISTS sales_new_sale_alert ON sales;

-- Step 2: Drop old function
DROP FUNCTION IF EXISTS create_new_sale_alert_with_email(
  uuid, text, text, uuid, text, uuid, uuid,
  text, text, text, uuid, jsonb,
  text, text, text, text, text, text, text,
  text, text, boolean, boolean, boolean, boolean, text, text, integer, jsonb
);

-- Step 3: Recreate function with updated D2D BCC logic
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
  p_mobile_numbers jsonb DEFAULT '[]'::jsonb
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
  v_partner_bcc_enabled boolean;
BEGIN
  -- Get partner type and email_bcc_enabled flag
  SELECT partner_type, COALESCE(email_bcc_enabled, false)
  INTO v_partner_type, v_partner_bcc_enabled
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

  -- BCC: partner/creator users
  -- Non-D2D partners: always included
  -- D2D partners: only if explicitly authorized (email_bcc_enabled = true)
  IF v_partner_type IS DISTINCT FROM 'D2D' OR v_partner_bcc_enabled = true THEN
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
          'autoriza_documentos', p_autoriza_documentos,
          'service_type', p_service_type,
          'activation_type', p_activation_type,
          'has_tv', p_has_tv,
          'has_net', p_has_net,
          'has_lr', p_has_lr,
          'fix_ported', p_fix_ported,
          'fix_number', p_fix_number,
          'fix_operator', p_fix_operator,
          'mobile_count', p_mobile_count,
          'mobile_numbers', p_mobile_numbers
        )
      );

      RAISE NOTICE 'New sale email queued: TO=% BCC=% (D2D=%, bcc_enabled=%, operator_filter=%)',
        jsonb_array_length(v_to_recipients),
        jsonb_array_length(v_bcc_recipients),
        COALESCE(v_partner_type = 'D2D', false),
        COALESCE(v_partner_bcc_enabled, false),
        COALESCE(array_length(v_operator_user_ids, 1), 0);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error sending new sale email: %', SQLERRM;
    END;
  END IF;
END;
$$;

-- Step 4: Recreate trigger function
CREATE OR REPLACE FUNCTION trigger_new_sale_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator_name text;
  v_attachments jsonb;
BEGIN
  SELECT name INTO v_creator_name
  FROM users
  WHERE id = NEW.created_by_user_id;

  v_attachments := COALESCE(NEW.attachments, '[]'::jsonb);

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
    COALESCE(NEW.mobile_numbers, '[]'::jsonb)
  );

  RETURN NEW;
END;
$$;

-- Step 5: Recreate the trigger
CREATE TRIGGER sales_new_sale_alert
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION trigger_new_sale_alert();
