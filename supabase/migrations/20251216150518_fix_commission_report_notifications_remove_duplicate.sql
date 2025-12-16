/*
  # Fix Commission Report Notifications - Remove Duplicate Partner Email

  1. Changes
    - Update notify_admins_on_commission_report to only notify admins
    - Remove duplicate email to partner (already sent by send-commission-report-email function)
  
  2. Impact
    - Admins will receive notification when commission report is emailed
    - Partner will not receive duplicate notification (only the main commission report email)
*/

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
  v_supabase_anon_key TEXT;
  v_request_id bigint;
  v_email_html TEXT;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.emailed_at IS NOT NULL AND OLD.emailed_at IS NULL) THEN
    -- Get partner name
    SELECT name INTO v_partner_name
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

    -- Prepare email HTML
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
<div class="header"><h1>Auto de Comissões Enviado</h1></div>
<div class="content">
<p>Foi enviado um auto de comissões ao parceiro:</p>
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

    -- Send notification to all admins with email alerts enabled
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
            'subject', '[Admin] Auto de Comissões Enviado - ' || v_month || '/' || NEW.year,
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
  END IF;

  RETURN NEW;
END;
$$;
