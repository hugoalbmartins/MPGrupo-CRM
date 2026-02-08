/*
  # Restructure Alert Triggers - Email Only for New Sales

  ## Changes
  1. New function `create_alert_only()` - Creates in-app alert without sending email
  2. New function `create_new_sale_alert_with_email()` - Creates alert AND sends email
     with proper TO/BCC logic:
     - TO: Admins (email_alerts_enabled=true) + BOs
     - BCC: Partner, commercial, operator notification_emails
  3. New trigger `trigger_sale_edit_alert` - Fires on field changes (not status/notes)
  4. Modified triggers:
     - `trigger_new_sale_alert` -> calls new email function
     - `trigger_status_change_alert` -> alert only (no email)
     - `trigger_note_alert` -> alert only (no email)

  ## Email Logic for New Sales
  - TO recipients: All admins with email_alerts_enabled + all BOs
  - BCC recipients: Partner user, commercial user, operator notification_emails
  - Subject: "Nova venda da operadora (OPERATOR_NAME)"
  - Body: Customer name, NIF, sale details, attachments

  ## Security
  - All functions use SECURITY DEFINER
  - Email sending respects user preferences and global suspension
*/

-- Function to create alert ONLY (no email) - used for edits, status changes, notes
CREATE OR REPLACE FUNCTION create_alert_only(
  p_type text,
  p_sale_id uuid,
  p_sale_code text,
  p_message text,
  p_created_by uuid,
  p_created_by_name text,
  p_partner_id uuid,
  p_created_by_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_ids uuid[] := '{}';
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT user_id FROM get_alert_recipients(p_sale_id, p_partner_id, p_created_by_user_id)
  LOOP
    v_user_ids := array_append(v_user_ids, v_rec.user_id);
  END LOOP;

  INSERT INTO alerts (
    type, sale_id, sale_code, message, user_ids, created_by, created_by_name
  ) VALUES (
    p_type, p_sale_id, p_sale_code, p_message, v_user_ids, p_created_by, p_created_by_name
  );
END;
$$;

-- Function for new sale: creates alert AND sends email with TO/BCC/attachments
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
BEGIN
  -- Collect ALL user IDs for the in-app alert
  FOR v_rec IN
    SELECT user_id FROM get_alert_recipients(p_sale_id, p_partner_id, p_created_by_user_id)
  LOOP
    v_user_ids := array_append(v_user_ids, v_rec.user_id);
  END LOOP;

  -- ALWAYS create in-app alert
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
  -- Add partner user(s)
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

  -- Add operator notification emails
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

      RAISE NOTICE 'New sale email queued: TO=% BCC=%',
        jsonb_array_length(v_to_recipients),
        jsonb_array_length(v_bcc_recipients);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error sending new sale email: %', SQLERRM;
    END;
  END IF;
END;
$$;

-- Recreate trigger for NEW SALE (email + alert)
CREATE OR REPLACE FUNCTION trigger_new_sale_alert()
RETURNS TRIGGER AS $$
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
    v_attachments
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger for STATUS CHANGE (alert only, no email)
CREATE OR REPLACE FUNCTION trigger_status_change_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_modifier_name text;
  v_modifier_id uuid;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_modifier_id := auth.uid();
    SELECT name INTO v_modifier_name
    FROM users
    WHERE id = v_modifier_id;

    PERFORM create_alert_only(
      'status_change',
      NEW.id,
      NEW.sale_code,
      'Estado alterado de "' || COALESCE(OLD.status, 'N/A') || '" para "' || COALESCE(NEW.status, 'N/A') || '" - Venda: ' || NEW.sale_code,
      COALESCE(v_modifier_id, NEW.created_by_user_id),
      COALESCE(v_modifier_name, 'Sistema'),
      NEW.partner_id,
      NEW.created_by_user_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger for NOTES (alert only, no email)
CREATE OR REPLACE FUNCTION trigger_note_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_modifier_name text;
  v_modifier_id uuid;
  v_old_notes_count int;
  v_new_notes_count int;
  v_last_note jsonb;
  v_note_text text;
BEGIN
  v_old_notes_count := COALESCE(jsonb_array_length(OLD.notes), 0);
  v_new_notes_count := COALESCE(jsonb_array_length(NEW.notes), 0);

  IF v_new_notes_count > v_old_notes_count THEN
    v_last_note := NEW.notes->-1;
    v_note_text := COALESCE(v_last_note->>'text', v_last_note->>'content', '');

    v_modifier_id := auth.uid();
    SELECT name INTO v_modifier_name
    FROM users
    WHERE id = v_modifier_id;

    IF (v_last_note->>'isResponse')::boolean IS TRUE THEN
      PERFORM create_alert_only(
        'note_added',
        NEW.id,
        NEW.sale_code,
        'Nova resposta adicionada - Venda: ' || NEW.sale_code || ' - ' || LEFT(v_note_text, 100),
        COALESCE(v_modifier_id, NEW.created_by_user_id),
        COALESCE(v_modifier_name, 'Sistema'),
        NEW.partner_id,
        NEW.created_by_user_id
      );
    ELSE
      PERFORM create_alert_only(
        'note_added',
        NEW.id,
        NEW.sale_code,
        'Nova nota adicionada - Venda: ' || NEW.sale_code || ' - ' || LEFT(v_note_text, 100),
        COALESCE(v_modifier_id, NEW.created_by_user_id),
        COALESCE(v_modifier_name, 'Sistema'),
        NEW.partner_id,
        NEW.created_by_user_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new trigger for SALE EDITS (alert only, no email)
CREATE OR REPLACE FUNCTION trigger_sale_edit_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_modifier_name text;
  v_modifier_id uuid;
  v_changed_fields text[] := '{}';
BEGIN
  IF OLD.client_name IS DISTINCT FROM NEW.client_name THEN
    v_changed_fields := array_append(v_changed_fields, 'nome do cliente');
  END IF;
  IF OLD.client_nif IS DISTINCT FROM NEW.client_nif THEN
    v_changed_fields := array_append(v_changed_fields, 'NIF');
  END IF;
  IF OLD.operator_id IS DISTINCT FROM NEW.operator_id THEN
    v_changed_fields := array_append(v_changed_fields, 'operadora');
  END IF;
  IF OLD.monthly_value IS DISTINCT FROM NEW.monthly_value THEN
    v_changed_fields := array_append(v_changed_fields, 'valor mensal');
  END IF;
  IF OLD.service_type IS DISTINCT FROM NEW.service_type THEN
    v_changed_fields := array_append(v_changed_fields, 'tipo de serviço');
  END IF;
  IF OLD.calculated_commission IS DISTINCT FROM NEW.calculated_commission THEN
    v_changed_fields := array_append(v_changed_fields, 'comissão');
  END IF;
  IF OLD.manual_commission IS DISTINCT FROM NEW.manual_commission THEN
    v_changed_fields := array_append(v_changed_fields, 'comissão manual');
  END IF;
  IF OLD.partner_id IS DISTINCT FROM NEW.partner_id THEN
    v_changed_fields := array_append(v_changed_fields, 'parceiro');
  END IF;
  IF OLD.observations IS DISTINCT FROM NEW.observations THEN
    v_changed_fields := array_append(v_changed_fields, 'observações');
  END IF;

  IF array_length(v_changed_fields, 1) > 0 THEN
    v_modifier_id := auth.uid();
    SELECT name INTO v_modifier_name
    FROM users
    WHERE id = v_modifier_id;

    PERFORM create_alert_only(
      'sale_edit',
      NEW.id,
      NEW.sale_code,
      'Venda editada: ' || NEW.sale_code || ' - Campos alterados: ' || array_to_string(v_changed_fields, ', '),
      COALESCE(v_modifier_id, NEW.created_by_user_id),
      COALESCE(v_modifier_name, 'Sistema'),
      NEW.partner_id,
      NEW.created_by_user_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate triggers
DROP TRIGGER IF EXISTS sales_new_sale_alert ON sales;
CREATE TRIGGER sales_new_sale_alert
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION trigger_new_sale_alert();

DROP TRIGGER IF EXISTS sales_status_change_alert ON sales;
CREATE TRIGGER sales_status_change_alert
  AFTER UPDATE ON sales
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trigger_status_change_alert();

DROP TRIGGER IF EXISTS sales_note_alert ON sales;
CREATE TRIGGER sales_note_alert
  AFTER UPDATE ON sales
  FOR EACH ROW
  WHEN (OLD.notes IS DISTINCT FROM NEW.notes)
  EXECUTE FUNCTION trigger_note_alert();

DROP TRIGGER IF EXISTS sales_edit_alert ON sales;
CREATE TRIGGER sales_edit_alert
  AFTER UPDATE ON sales
  FOR EACH ROW
  WHEN (
    OLD.status IS NOT DISTINCT FROM NEW.status
    AND OLD.notes IS NOT DISTINCT FROM NEW.notes
    AND (
      OLD.client_name IS DISTINCT FROM NEW.client_name OR
      OLD.client_nif IS DISTINCT FROM NEW.client_nif OR
      OLD.operator_id IS DISTINCT FROM NEW.operator_id OR
      OLD.monthly_value IS DISTINCT FROM NEW.monthly_value OR
      OLD.service_type IS DISTINCT FROM NEW.service_type OR
      OLD.calculated_commission IS DISTINCT FROM NEW.calculated_commission OR
      OLD.manual_commission IS DISTINCT FROM NEW.manual_commission OR
      OLD.partner_id IS DISTINCT FROM NEW.partner_id OR
      OLD.observations IS DISTINCT FROM NEW.observations
    )
  )
  EXECUTE FUNCTION trigger_sale_edit_alert();
