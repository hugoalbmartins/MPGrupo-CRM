/*
  # Corrigir Suspensão Global de Alertas - Manter Dashboard

  1. Alterações
    - Atualizar função `create_alert_and_notify` para:
      * SEMPRE criar alertas no dashboard (independente da suspensão global)
      * BLOQUEAR apenas o envio de emails quando suspensão global estiver ativa
      * Quando suspensão global estiver ativa: alertas aparecem no dashboard mas NENHUM email é enviado
      * Quando suspensão global estiver inativa: alertas aparecem no dashboard E emails são enviados para quem tem email_alerts_enabled = true

  2. Comportamento Esperado
    - Suspensão Global ATIVA:
      * Alertas criados no dashboard ✓
      * Emails bloqueados para TODOS ✗
    
    - Suspensão Global INATIVA:
      * Alertas criados no dashboard ✓
      * Emails enviados apenas para quem tem email_alerts_enabled = true ✓
*/

-- Recriar função create_alert_and_notify com lógica corrigida
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
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipients RECORD;
  v_user_ids uuid[] := '{}';
  v_all_recipients RECORD;
  v_email_recipients jsonb := '[]'::jsonb;
  v_supabase_url text;
  v_supabase_anon_key text;
  v_alerts_suspended boolean;
BEGIN
  -- Obter TODOS os destinatários para criar o alerta (dashboard)
  FOR v_all_recipients IN 
    SELECT user_id FROM get_alert_recipients(p_sale_id, p_partner_id, p_created_by_user_id)
  LOOP
    v_user_ids := array_append(v_user_ids, v_all_recipients.user_id);
  END LOOP;

  -- SEMPRE criar alerta na base de dados (aparece no dashboard de todos)
  -- Isto NÃO é afetado pela suspensão global
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

  -- Verificar se alertas estão suspensos globalmente
  v_alerts_suspended := are_alerts_suspended();

  -- Se alertas estiverem suspensos, NÃO enviar emails mas alerta já foi criado
  IF v_alerts_suspended THEN
    RAISE NOTICE 'Alertas suspensos - Email bloqueado mas alerta criado no dashboard: % para venda %', p_type, p_sale_code;
    RETURN;
  END IF;

  -- Obter apenas destinatários com emails habilitados
  FOR v_recipients IN 
    SELECT * FROM get_alert_recipients(p_sale_id, p_partner_id, p_created_by_user_id)
    WHERE should_send_email = true
  LOOP
    -- Adicionar ao array de destinatários de email
    v_email_recipients := v_email_recipients || jsonb_build_object(
      'email', v_recipients.user_email,
      'name', v_recipients.user_name
    );
  END LOOP;

  -- Apenas enviar emails se houver destinatários com email habilitado
  IF jsonb_array_length(v_email_recipients) > 0 THEN
    BEGIN
      -- Obter configuração do Supabase
      v_supabase_url := current_setting('app.settings.supabase_url', true);
      v_supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);

      -- Chamar edge function para enviar email (payload com múltiplos destinatários)
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-alert-notifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_supabase_anon_key
        ),
        body := jsonb_build_object(
          'recipients', v_email_recipients,
          'subject', CASE p_type
            WHEN 'new_sale' THEN 'Nova Venda Registada - ' || p_sale_code
            WHEN 'status_change' THEN 'Alteração de Estado - ' || p_sale_code
            WHEN 'note_added' THEN 'Nova Nota - ' || p_sale_code
            WHEN 'operator_validation' THEN 'Validação de Operador - ' || p_sale_code
            ELSE 'Notificação - ' || p_sale_code
          END,
          'message', p_message,
          'sale_code', p_sale_code,
          'alert_type', p_type
        )
      );

      RAISE NOTICE 'Email enviado para % destinatários', jsonb_array_length(v_email_recipients);
    EXCEPTION WHEN OTHERS THEN
      -- Log erro mas não falha a transação
      RAISE NOTICE 'Erro ao enviar emails: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Nenhum destinatário com emails habilitados para alerta %', p_type;
  END IF;

END;
$$;