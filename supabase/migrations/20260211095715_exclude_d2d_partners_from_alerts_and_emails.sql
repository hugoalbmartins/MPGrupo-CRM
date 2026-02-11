/*
  # Exclude D2D Partners from Alerts and Emails

  ## Changes
  1. Modifies `get_alert_recipients()` function to exclude D2D partners
  2. Modifies `create_new_sale_alert_with_email()` to exclude D2D partners from BCC emails
  3. Maintains alerts and emails for all other users (admins, BO, non-D2D partners, operators)

  ## Reason
  D2D partners should not receive in-app alerts or email notifications for their sales.
  All other users (admins, BO, Rev/Rev+ partners, operators) continue to receive notifications normally.

  ## Security
  - Functions use SECURITY DEFINER
  - No changes to RLS policies
*/

-- Drop and recreate function to exclude D2D partners from alerts
DROP FUNCTION IF EXISTS get_alert_recipients(uuid, uuid, uuid);

CREATE FUNCTION get_alert_recipients(
  p_sale_id uuid,
  p_partner_id uuid,
  p_created_by_user_id uuid
)
RETURNS TABLE (
  user_id uuid,
  user_email text,
  user_name text
) AS $$
BEGIN
  RETURN QUERY
  -- All admins
  SELECT u.id, u.email, u.name
  FROM users u
  WHERE u.role = 'admin'
  
  UNION
  
  -- All backoffice users
  SELECT u.id, u.email, u.name
  FROM users u
  WHERE u.role = 'bo'
  
  UNION
  
  -- Partner of the sale (ONLY if NOT D2D)
  SELECT u.id, u.email, u.name
  FROM users u
  INNER JOIN partners p ON p.user_id = u.id
  WHERE u.partner_id = p_partner_id
    AND u.role = 'partner'
    AND p.partner_type != 'D2D'
  
  UNION
  
  -- Partner commercial who created the sale (ONLY if partner is NOT D2D)
  SELECT u.id, u.email, u.name
  FROM users u
  INNER JOIN partners p ON p.id = u.partner_id
  WHERE u.id = p_created_by_user_id
    AND u.role = 'partner_commercial'
    AND p.partner_type != 'D2D'
    AND u.id NOT IN (
      SELECT u2.id FROM users u2 WHERE u2.partner_id = p_partner_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Modified function for new sale alerts to exclude D2D partners from BCC emails
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
  v_partner_email text;
  v_partner_name text;
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

  -- Build TO list: Admins (with email_alerts_enabled) + BOs
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

  -- Build BCC list: Partner, commercial who created, operator notification_emails
  -- EXCLUDE D2D partners from BCC list
  IF v_partner_type IS NULL OR v_partner_type != 'D2D' THEN
    -- Add partner user(s) only if NOT D2D
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
          'sale_id', p_sale_id
        )
      );

      RAISE NOTICE 'New sale email queued: TO=% BCC=% (D2D=%)',
        jsonb_array_length(v_to_recipients),
        jsonb_array_length(v_bcc_recipients),
        COALESCE(v_partner_type = 'D2D', false);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error sending new sale email: %', SQLERRM;
    END;
  END IF;
END;
$$;