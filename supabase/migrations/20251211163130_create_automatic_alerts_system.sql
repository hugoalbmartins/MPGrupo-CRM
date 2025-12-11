/*
  # Sistema de Alertas Automáticos

  ## Descrição
  Implementa sistema de alertas automáticos que dispara quando:
  - Nova venda criada
  - Estado de venda alterado
  - Nova nota adicionada
  - Resposta a nota existente

  ## Destinatários
  - Todos os administradores
  - Todos os backoffice
  - Parceiro da venda
  - Parceiro comercial associado (se aplicável)

  ## Componentes
  1. Função para obter destinatários de alertas
  2. Função para criar alertas e enviar emails
  3. Triggers para nova venda, mudança de estado e notas
*/

-- Função para obter todos os destinatários de um alerta
CREATE OR REPLACE FUNCTION get_alert_recipients(
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
  -- Todos os admins
  SELECT u.id, u.email, u.name
  FROM users u
  WHERE u.role = 'admin'
  
  UNION
  
  -- Todos os backoffice
  SELECT u.id, u.email, u.name
  FROM users u
  WHERE u.role = 'bo'
  
  UNION
  
  -- Parceiro da venda
  SELECT u.id, u.email, u.name
  FROM users u
  WHERE u.partner_id = p_partner_id
    AND u.role = 'partner'
  
  UNION
  
  -- Parceiro comercial que criou a venda (se diferente do parceiro)
  SELECT u.id, u.email, u.name
  FROM users u
  WHERE u.id = p_created_by_user_id
    AND u.role = 'partner_commercial'
    AND u.id NOT IN (
      SELECT u2.id FROM users u2 WHERE u2.partner_id = p_partner_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar alerta e enviar emails
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
  v_supabase_url text;
  v_supabase_anon_key text;
  v_email_payload jsonb;
  v_http_response jsonb;
BEGIN
  -- Obter destinatários
  FOR v_recipients IN 
    SELECT * FROM get_alert_recipients(p_sale_id, p_partner_id, p_created_by_user_id)
  LOOP
    v_user_ids := array_append(v_user_ids, v_recipients.user_id);
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

  -- Obter configuração do Supabase
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);

  -- Enviar email para cada destinatário
  FOR v_recipients IN 
    SELECT * FROM get_alert_recipients(p_sale_id, p_partner_id, p_created_by_user_id)
  LOOP
    BEGIN
      -- Preparar payload do email
      v_email_payload := jsonb_build_object(
        'recipients', jsonb_build_array(
          jsonb_build_object(
            'email', v_recipients.user_email,
            'name', v_recipients.user_name
          )
        ),
        'subject', CASE p_type
          WHEN 'new_sale' THEN 'Nova Venda Registada - ' || p_sale_code
          WHEN 'status_change' THEN 'Alteração de Estado - ' || p_sale_code
          WHEN 'note_added' THEN 'Nova Nota - ' || p_sale_code
          ELSE 'Notificação - ' || p_sale_code
        END,
        'message', p_message,
        'sale_code', p_sale_code,
        'alert_type', p_type
      );

      -- Chamar edge function para enviar email
      -- Nota: Esta chamada será feita através de HTTP request na edge function
      -- Por agora, apenas logamos para debug
      RAISE NOTICE 'Email a enviar para: % (%) - Tipo: %', 
        v_recipients.user_name, 
        v_recipients.user_email, 
        p_type;

    EXCEPTION WHEN OTHERS THEN
      -- Log erro mas não falha a transação
      RAISE NOTICE 'Erro ao enviar email para %: %', v_recipients.user_email, SQLERRM;
    END;
  END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para nova venda
CREATE OR REPLACE FUNCTION trigger_new_sale_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_creator_name text;
BEGIN
  -- Obter nome do criador
  SELECT name INTO v_creator_name
  FROM users
  WHERE id = NEW.created_by_user_id;

  -- Criar alerta
  PERFORM create_alert_and_notify(
    'new_sale',
    NEW.id,
    NEW.sale_code,
    'Nova venda registada: ' || NEW.sale_code || ' - Cliente: ' || NEW.customer_name || ' - Operador: ' || NEW.operator_name,
    NEW.created_by_user_id,
    COALESCE(v_creator_name, 'Sistema'),
    NEW.partner_id,
    NEW.created_by_user_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para alteração de estado
CREATE OR REPLACE FUNCTION trigger_status_change_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_modifier_name text;
  v_modifier_id uuid;
BEGIN
  -- Verificar se o estado mudou
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Obter ID e nome do modificador
    v_modifier_id := auth.uid();
    SELECT name INTO v_modifier_name
    FROM users
    WHERE id = v_modifier_id;

    -- Criar alerta
    PERFORM create_alert_and_notify(
      'status_change',
      NEW.id,
      NEW.sale_code,
      'Estado alterado de "' || OLD.status || '" para "' || NEW.status || '" - Venda: ' || NEW.sale_code,
      COALESCE(v_modifier_id, NEW.created_by_user_id),
      COALESCE(v_modifier_name, 'Sistema'),
      NEW.partner_id,
      NEW.created_by_user_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para novas notas ou respostas
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
  -- Contar notas antigas e novas
  v_old_notes_count := COALESCE(jsonb_array_length(OLD.notes), 0);
  v_new_notes_count := COALESCE(jsonb_array_length(NEW.notes), 0);

  -- Verificar se houve mudança nas notas
  IF v_new_notes_count > v_old_notes_count THEN
    -- Obter última nota
    v_last_note := NEW.notes->-1;
    v_note_text := COALESCE(v_last_note->>'text', '');

    -- Obter ID e nome do modificador
    v_modifier_id := auth.uid();
    SELECT name INTO v_modifier_name
    FROM users
    WHERE id = v_modifier_id;

    -- Determinar se é nota ou resposta
    IF (v_last_note->>'isResponse')::boolean THEN
      -- É uma resposta
      PERFORM create_alert_and_notify(
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
      -- É uma nota nova
      PERFORM create_alert_and_notify(
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

-- Criar triggers
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

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_sale_id ON alerts(sale_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);