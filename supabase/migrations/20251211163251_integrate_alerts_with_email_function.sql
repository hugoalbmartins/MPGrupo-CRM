/*
  # Integração de Alertas com Edge Function de Email

  ## Descrição
  Atualiza o sistema de alertas para chamar a edge function
  que envia emails para todos os destinatários.

  ## Alterações
  1. Atualiza função create_alert_and_notify para chamar edge function
  2. Adiciona extensão http para fazer chamadas HTTP
*/

-- Habilitar extensão http se não existir
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Atualizar função para chamar edge function
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
  -- Obter destinatários
  FOR v_recipients IN 
    SELECT * FROM get_alert_recipients(p_sale_id, p_partner_id, p_created_by_user_id)
  LOOP
    v_user_ids := array_append(v_user_ids, v_recipients.user_id);
    v_email_recipients := v_email_recipients || jsonb_build_object(
      'email', v_recipients.user_email,
      'name', v_recipients.user_name
    );
  END LOOP;

  -- Criar alerta na base de dados
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

  -- Preparar subject do email
  v_email_subject := CASE p_type
    WHEN 'new_sale' THEN 'Nova Venda Registada - ' || p_sale_code
    WHEN 'status_change' THEN 'Alteração de Estado - ' || p_sale_code
    WHEN 'note_added' THEN 'Nova Nota - ' || p_sale_code
    ELSE 'Notificação - ' || p_sale_code
  END;

  -- Obter service key (disponível no ambiente da função)
  v_supabase_service_key := current_setting('app.settings.service_role_key', true);

  -- Se não há destinatários, retornar
  IF jsonb_array_length(v_email_recipients) = 0 THEN
    RETURN;
  END IF;

  -- Chamar edge function para enviar emails (de forma assíncrona)
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
    -- Log erro mas não falha a transação
    RAISE NOTICE 'Erro ao enviar notificação por email: %', SQLERRM;
  END;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adicionar política para permitir chamadas HTTP
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'http'
  ) THEN
    RAISE NOTICE 'HTTP extension not available - emails will be logged only';
  END IF;
END $$;