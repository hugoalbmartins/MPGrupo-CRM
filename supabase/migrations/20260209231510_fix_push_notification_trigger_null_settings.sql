/*
  # Fix push notification trigger to handle missing settings

  1. Changes
    - Rewrites `send_push_notification_for_alert` to safely check if
      `app.settings.supabase_url` and `app.settings.supabase_service_role_key`
      are available before attempting the HTTP call
    - If settings are missing, the trigger silently skips the HTTP call
      instead of failing with a NOT NULL constraint violation
    - Adds an outer EXCEPTION handler as a safety net

  2. Impact
    - Fixes 400 Bad Request errors when editing sales caused by the
      `net.http_post()` call receiving NULL URL/headers
    - Alerts are still created in the database; only the push notification
      HTTP call is skipped when settings are unavailable
*/

CREATE OR REPLACE FUNCTION send_push_notification_for_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.supabase_service_role_key', true);

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'alert_id', NEW.id,
        'user_ids', NEW.user_ids,
        'title', CASE NEW.type
          WHEN 'new_sale' THEN 'Nova Venda'
          WHEN 'status_change' THEN 'Alteração de Estado'
          WHEN 'note_added' THEN 'Nova Nota'
          WHEN 'operator_validation' THEN 'Validação de Operadora'
          WHEN 'proposal_pending' THEN 'Proposta Pendente'
          ELSE 'Notificação'
        END,
        'body', NEW.message,
        'sale_code', NEW.sale_code,
        'url', '/sales?highlight=' || NEW.sale_id::text
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Push notification failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
