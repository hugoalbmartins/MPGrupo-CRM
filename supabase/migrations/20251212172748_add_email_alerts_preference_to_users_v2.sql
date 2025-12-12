/*
  # Adicionar Preferência de Alertas por Email aos Utilizadores

  1. Alterações
    - Adicionar coluna `email_alerts_enabled` à tabela users
    - Por defeito, todos os utilizadores recebem alertas por email (true)
    - Apenas administradores podem desativar esta opção para si próprios
    
  2. Notas
    - Back Office e Parceiros SEMPRE recebem alertas por email (não podem desativar)
    - Administradores podem escolher se querem ou não receber alertas por email
*/

-- Adicionar coluna à tabela users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'email_alerts_enabled'
  ) THEN
    ALTER TABLE users ADD COLUMN email_alerts_enabled boolean DEFAULT true;
  END IF;
END $$;

-- Remover função antiga
DROP FUNCTION IF EXISTS get_alert_recipients(uuid, uuid, uuid);

-- Criar função atualizada com preferência de email
CREATE OR REPLACE FUNCTION get_alert_recipients(
  p_sale_id uuid,
  p_partner_id uuid,
  p_created_by_user_id uuid
)
RETURNS TABLE (
  user_id uuid,
  user_email text,
  user_name text,
  should_send_email boolean
) AS $$
BEGIN
  RETURN QUERY
  WITH relevant_users AS (
    SELECT DISTINCT u.id, u.email, u.name, u.role, 
           COALESCE(u.email_alerts_enabled, true) as email_enabled
    FROM users u
    LEFT JOIN partners p ON p.user_id = u.id
    WHERE 
      (u.role = 'admin')
      OR
      (u.role = 'bo')
      OR
      (u.role = 'partner' AND p.id = p_partner_id)
      OR
      (u.role = 'partner_commercial' AND u.id = p_created_by_user_id)
  )
  SELECT 
    ru.id::uuid,
    ru.email,
    ru.name,
    (ru.role != 'admin' OR ru.email_enabled)::boolean as should_send_email
  FROM relevant_users ru;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar função create_alert_and_notify
CREATE OR REPLACE FUNCTION create_alert_and_notify(
  p_type text,
  p_sale_id uuid,
  p_sale_code text,
  p_message text,
  p_created_by uuid,
  p_created_by_name text,
  p_partner_id uuid,
  p_created_by_user_id uuid
)
RETURNS void AS $$
DECLARE
  v_recipients RECORD;
  v_user_ids uuid[] := '{}';
  v_email_recipients jsonb := '[]'::jsonb;
  v_supabase_url text := 'https://iydhpyljcofpztrzjnfr.supabase.co';
  v_supabase_service_key text;
  v_email_subject text;
  v_http_request_id bigint;
BEGIN
  FOR v_recipients IN 
    SELECT * FROM get_alert_recipients(p_sale_id, p_partner_id, p_created_by_user_id)
  LOOP
    v_user_ids := array_append(v_user_ids, v_recipients.user_id);
    
    IF v_recipients.should_send_email THEN
      v_email_recipients := v_email_recipients || jsonb_build_object(
        'email', v_recipients.user_email,
        'name', v_recipients.user_name
      );
    END IF;
  END LOOP;

  INSERT INTO alerts (
    type,
    sale_id,
    sale_code,
    message,
    user_ids,
    created_by,
    created_by_name
  ) VALUES (
    p_type,
    p_sale_id,
    p_sale_code,
    p_message,
    v_user_ids,
    p_created_by,
    p_created_by_name
  );

  v_email_subject := CASE p_type
    WHEN 'new_sale' THEN 'Nova Venda Registada - ' || p_sale_code
    WHEN 'status_change' THEN 'Alteração de Estado - ' || p_sale_code
    WHEN 'note_added' THEN 'Nova Nota - ' || p_sale_code
    ELSE 'Notificação - ' || p_sale_code
  END;

  v_supabase_service_key := current_setting('app.settings.service_role_key', true);

  IF jsonb_array_length(v_email_recipients) = 0 THEN
    RETURN;
  END IF;

  BEGIN
    SELECT extensions.http_post(
      v_supabase_url || '/functions/v1/send-alert-notifications',
      jsonb_build_object(
        'recipients', v_email_recipients,
        'subject', v_email_subject,
        'message', p_message,
        'sale_code', p_sale_code,
        'alert_type', p_type
      )::text,
      'application/json',
      ARRAY[
        extensions.http_header('Authorization', 'Bearer ' || COALESCE(v_supabase_service_key, 'dev-key')),
        extensions.http_header('Content-Type', 'application/json')
      ]
    ) INTO v_http_request_id;

    RAISE NOTICE 'Email notification sent for % recipients - Request ID: %', 
      jsonb_array_length(v_email_recipients), 
      v_http_request_id;

  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao enviar notificação por email: %', SQLERRM;
  END;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;