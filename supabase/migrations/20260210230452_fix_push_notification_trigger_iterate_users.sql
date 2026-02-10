/*
  # Fix push notification trigger to iterate over users

  1. Changes
    - Updates `send_push_notification_for_alert` to iterate over each user_id
    - Makes individual HTTP calls to send-push-notification for each user
    - The edge function expects a single user_id, not an array
    
  2. Impact
    - Push notifications will now work correctly for each user who should receive them
    - Previously was sending user_ids array which the edge function couldn't process
*/

CREATE OR REPLACE FUNCTION send_push_notification_for_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_user_id uuid;
  v_title text;
BEGIN
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.supabase_service_role_key', true);

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine notification title based on alert type
  v_title := CASE NEW.type
    WHEN 'new_sale' THEN 'Nova Venda'
    WHEN 'status_change' THEN 'Alteracao de Estado'
    WHEN 'note_added' THEN 'Nova Nota'
    WHEN 'operator_validation' THEN 'Validacao de Operadora'
    WHEN 'proposal_pending' THEN 'Proposta Pendente'
    WHEN 'sale_edit' THEN 'Venda Editada'
    ELSE 'Notificacao'
  END;

  -- Iterate over each user_id and send individual push notification
  IF NEW.user_ids IS NOT NULL THEN
    FOREACH v_user_id IN ARRAY NEW.user_ids
    LOOP
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-push-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          ),
          body := jsonb_build_object(
            'user_id', v_user_id,
            'title', v_title,
            'body', NEW.message,
            'data', jsonb_build_object(
              'type', NEW.type,
              'sale_code', NEW.sale_code,
              'sale_id', NEW.sale_id,
              'url', '/alerts'
            )
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Push notification failed for user %: %', v_user_id, SQLERRM;
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists on alerts table
DROP TRIGGER IF EXISTS trigger_push_notification_on_alert ON alerts;

CREATE TRIGGER trigger_push_notification_on_alert
  AFTER INSERT ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION send_push_notification_for_alert();
