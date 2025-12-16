/*
  # Fix Email Notifications for Admins and Commission Reports

  1. Changes
    - Fix get_alert_recipients function to correctly send emails to admins
    - Fix notify_admins_on_commission_report to send emails to admins and partner
    - Use correct field name: email_alerts_enabled (not receive_email_alerts)
  
  2. Impact
    - Admins will now receive alert emails when they have email_alerts_enabled = true
    - Commission reports will be sent to both admins and partner's main email
*/

-- Fix get_alert_recipients function to correctly handle admin email preferences
CREATE OR REPLACE FUNCTION get_alert_recipients(
  p_sale_id uuid,
  p_partner_id uuid,
  p_created_by_user_id uuid
)
RETURNS TABLE(
  user_id uuid,
  user_email text,
  user_name text,
  should_send_email boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH relevant_users AS (
    SELECT DISTINCT 
      u.id, 
      u.email, 
      u.name, 
      u.role,
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
    (
      CASE 
        WHEN ru.role = 'admin' THEN ru.email_enabled
        WHEN ru.role = 'bo' THEN true
        WHEN ru.role IN ('partner', 'partner_commercial') THEN ru.email_enabled
        ELSE false
      END
    )::boolean as should_send_email
  FROM relevant_users ru;
END;
$$;

-- Fix notify_admins_on_commission_report to send to admins and partner
CREATE OR REPLACE FUNCTION notify_admins_on_commission_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_name TEXT;
  v_partner_email TEXT;
  v_month TEXT;
  v_admin RECORD;
  v_month_names TEXT[] := ARRAY[
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  v_app_url TEXT;
  v_supabase_url TEXT;
  v_supabase_anon_key TEXT;
  v_request_id bigint;
  v_email_html TEXT;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.emailed_at IS NOT NULL AND OLD.emailed_at IS NULL) THEN
    -- Get partner info
    SELECT name, email 
    INTO v_partner_name, v_partner_email
    FROM partners 
    WHERE id = NEW.partner_id;

    v_month := v_month_names[NEW.month];
    
    -- Get configuration
    SELECT value INTO v_app_url FROM system_config WHERE key = 'app_url';
    SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
    SELECT value INTO v_supabase_anon_key FROM system_config WHERE key = 'supabase_anon_key';
    
    -- Use defaults if not found
    IF v_app_url IS NULL THEN
      v_app_url := 'https://www.mpgrupo.pt';
    END IF;
    
    IF v_supabase_url IS NULL THEN
      v_supabase_url := 'https://iydhpyljcofpztrzjnfr.supabase.co';
    END IF;

    -- Prepare email HTML (same for all recipients)
    v_email_html := '<!DOCTYPE html>
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
</html>';

    -- Send to all admins with email alerts enabled
    FOR v_admin IN
      SELECT email, name
      FROM users
      WHERE role = 'admin'
        AND COALESCE(email_alerts_enabled, true) = true
    LOOP
      BEGIN
        SELECT extensions.http_post(
          url := v_supabase_url || '/functions/v1/send-alert-email',
          body := jsonb_build_object(
            'to', v_admin.email,
            'subject', '[Admin] Auto de Comissões - ' || v_month || '/' || NEW.year,
            'html', v_email_html
          ),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', COALESCE(v_supabase_anon_key, '')
          )
        ) INTO v_request_id;

        RAISE NOTICE 'Admin notification sent to % (request_id: %)', v_admin.email, v_request_id;

      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to send admin notification to %: %', v_admin.email, SQLERRM;
      END;
    END LOOP;

    -- Send to partner's main email
    IF v_partner_email IS NOT NULL AND v_partner_email != '' THEN
      BEGIN
        SELECT extensions.http_post(
          url := v_supabase_url || '/functions/v1/send-alert-email',
          body := jsonb_build_object(
            'to', v_partner_email,
            'subject', 'Auto de Comissões - ' || v_month || '/' || NEW.year,
            'html', v_email_html
          ),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', COALESCE(v_supabase_anon_key, '')
          )
        ) INTO v_request_id;

        RAISE NOTICE 'Partner notification sent to % (request_id: %)', v_partner_email, v_request_id;

      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to send partner notification to %: %', v_partner_email, SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
