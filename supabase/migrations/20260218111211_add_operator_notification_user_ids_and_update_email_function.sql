/*
  # Add per-operator admin/BO user selection for alert emails

  ## Changes

  ### 1. New Column
  - `operators.notification_user_ids` (uuid[]) - Array of admin/BO user IDs selected
    to receive email alerts for this operator. If empty, ALL admins/BOs receive alerts
    (preserving backward compatibility).

  ### 2. Updated Function: create_new_sale_alert_with_email()
  - When `notification_user_ids` is non-empty for the operator, only those specific
    admin/BO users appear in the TO list (provided they have email_alerts_enabled=true).
  - When `notification_user_ids` is empty or NULL, all admins/BOs with
    email_alerts_enabled=true receive the email (existing behaviour).
  - BCC rules remain unchanged: non-D2D partner/commercial + operator notification_emails.

  ## Security
  - No RLS changes needed (operators table policies remain)
  - Function uses SECURITY DEFINER as before
*/

-- 1. Add the new column
ALTER TABLE operators ADD COLUMN IF NOT EXISTS notification_user_ids uuid[] DEFAULT '{}';

-- 2. Drop old function signature then recreate with updated logic
DROP FUNCTION IF EXISTS create_new_sale_alert_with_email(uuid,text,text,uuid,text,uuid,uuid,text,text,text,uuid,jsonb,text,text,text,text,text,text);

CREATE FUNCTION create_new_sale_alert_with_email(
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

  -- Get operator-specific user selection and notification emails
  SELECT notification_user_ids, notification_emails
  INTO v_operator_user_ids, v_operator_emails
  FROM operators
  WHERE id = p_operator_id;

  -- Build TO list: selected admin/BO users for this operator (or all if none selected)
  IF v_operator_user_ids IS NOT NULL AND array_length(v_operator_user_ids, 1) > 0 THEN
    -- Only selected admin/BO users
    FOR v_rec IN
      SELECT u.email, u.name
      FROM users u
      WHERE u.id = ANY(v_operator_user_ids)
        AND u.role IN ('admin', 'bo')
        AND COALESCE(u.email_alerts_enabled, true) = true
    LOOP
      v_to_recipients := v_to_recipients || jsonb_build_object(
        'email', v_rec.email,
        'name', v_rec.name
      );
    END LOOP;
  ELSE
    -- No selection: send to all admins/BOs (backward-compatible default)
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
  END IF;

  -- Build BCC list: Partner, commercial who created, operator notification_emails
  -- EXCLUDE D2D partners from BCC list
  IF v_partner_type IS NULL OR v_partner_type != 'D2D' THEN
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
      v_supabase_url := current_setting('app.settings.supabase_url', true);
      v_supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);

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
          'tier', p_tier
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
