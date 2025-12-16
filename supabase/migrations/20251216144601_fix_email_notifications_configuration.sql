/*
  # Fix Email Notifications Configuration

  1. Changes
    - Create a system_config table to store application settings
    - Populate with Supabase configuration needed for email notifications
    - Update create_alert_and_notify function to use the config table
    - Update notify_admins_on_commission_report function to use the config table
  
  2. Security
    - RLS enabled on system_config table
    - Only admins can read/write system config
*/

-- Create system configuration table
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read system config
CREATE POLICY "Admins can read system config"
  ON system_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Only admins can update system config
CREATE POLICY "Admins can update system config"
  ON system_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Insert configuration values
INSERT INTO system_config (key, value, description) VALUES
  ('supabase_url', 'https://iydhpyljcofpztrzjnfr.supabase.co', 'Supabase project URL'),
  ('app_url', 'https://www.mpgrupo.pt', 'Application frontend URL')
ON CONFLICT (key) DO NOTHING;

-- Update create_alert_and_notify function to use config table
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
  v_email_recipients jsonb := '[]'::jsonb;
  v_supabase_url text;
  v_email_subject text;
  v_http_request_id bigint;
BEGIN
  -- Get Supabase URL from config
  SELECT value INTO v_supabase_url
  FROM system_config
  WHERE key = 'supabase_url';

  -- If not found, use default
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://iydhpyljcofpztrzjnfr.supabase.co';
  END IF;

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
        extensions.http_header('Content-Type', 'application/json'),
        extensions.http_header('apikey', (SELECT value FROM system_config WHERE key = 'supabase_anon_key'))
      ]
    ) INTO v_http_request_id;

    RAISE NOTICE 'Email notification sent for % recipients - Request ID: %', 
      jsonb_array_length(v_email_recipients), 
      v_http_request_id;

  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao enviar notificação por email: %', SQLERRM;
  END;

END;
$$;

-- Update notify_admins_on_commission_report function
CREATE OR REPLACE FUNCTION notify_admins_on_commission_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_name TEXT;
  v_month TEXT;
  v_admin RECORD;
  v_month_names TEXT[] := ARRAY[
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  v_app_url TEXT;
  v_supabase_url TEXT;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.emailed_at IS NOT NULL AND OLD.emailed_at IS NULL) THEN
    SELECT name INTO v_partner_name FROM partners WHERE id = NEW.partner_id;

    v_month := v_month_names[NEW.month];
    
    -- Get URLs from config
    SELECT value INTO v_app_url FROM system_config WHERE key = 'app_url';
    SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
    
    IF v_app_url IS NULL THEN
      v_app_url := 'https://www.mpgrupo.pt';
    END IF;
    
    IF v_supabase_url IS NULL THEN
      v_supabase_url := 'https://iydhpyljcofpztrzjnfr.supabase.co';
    END IF;

    FOR v_admin IN
      SELECT email, name
      FROM users
      WHERE role = 'admin'
        AND (receive_email_alerts IS NULL OR receive_email_alerts = true)
    LOOP
      BEGIN
        PERFORM
          extensions.http_post(
            url := v_supabase_url || '/functions/v1/send-alert-email',
            body := jsonb_build_object(
              'to', v_admin.email,
              'subject', '[Admin] Auto de Comissões - ' || v_month || '/' || NEW.year,
              'html', '<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
.container { max-width: 600px; margin: 0 auto; padding: 20px; }
.header { background: linear-gradient(135deg, #1F4E78 0%, #2C5F8D 100%); color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
.content { background: #f9f9f9; padding: 25px; }
.info-box { background: white; border-left: 4px solid #1F4E78; padding: 15px; margin: 15px 0; border-radius: 4px; }
.button { display: inline-block; background: #1F4E78; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
.footer { text-align: center; padding: 15px; color: #666; font-size: 12px; }
</style>
</head>
<body>
<div class="container">
<div class="header"><h1>Auto de Comissões Aprovado</h1></div>
<div class="content">
<p>Foi aprovado um auto de comissões:</p>
<div class="info-box">
<strong>Parceiro:</strong> ' || v_partner_name || '<br>
<strong>Período:</strong> ' || v_month || '/' || NEW.year || '<br>
<strong>Versão:</strong> V' || NEW.version || '<br>
<strong>Estado:</strong> Enviado ao parceiro
</div>
<center><a href="' || v_app_url || '/commission-reports" class="button">Ver Todos os Autos</a></center>
</div>
<div class="footer">© ' || EXTRACT(YEAR FROM CURRENT_DATE) || ' MP Grupo</div>
</div>
</body>
</html>'
            )::text,
            headers := 'application/json',
            http_headers := ARRAY[
              extensions.http_header('Content-Type', 'application/json'),
              extensions.http_header('apikey', (SELECT value FROM system_config WHERE key = 'supabase_anon_key'))
            ]
          );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to send admin notification to %: %', v_admin.email, SQLERRM;
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
