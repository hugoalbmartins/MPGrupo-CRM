/*
  # Fix Commission Report Admin Notification Trigger

  1. Changes
    - Update notify_admins_on_commission_report function to use correct field name
    - Change from email_sent (doesn't exist) to emailed_at (timestamp that exists)
    - Check if emailed_at was just set (was NULL, now has a value)
  
  2. Impact
    - Fixes the "record 'new' has no field 'email_sent'" error
    - Admin notifications will now work correctly when commission reports are emailed
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
BEGIN
  -- Trigger when emailed_at is set (was NULL, now has a timestamp)
  IF (TG_OP = 'UPDATE' AND NEW.emailed_at IS NOT NULL AND OLD.emailed_at IS NULL) THEN
    SELECT name INTO v_partner_name FROM partners WHERE id = NEW.partner_id;

    v_month := v_month_names[NEW.month];
    v_app_url := COALESCE(current_setting('app.settings.app_url', true), 'https://www.mpgrupo.pt');

    FOR v_admin IN
      SELECT email, name
      FROM users
      WHERE role = 'admin'
        AND (receive_email_alerts IS NULL OR receive_email_alerts = true)
    LOOP
      BEGIN
        PERFORM
          net.http_post(
            url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-alert-email',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key', true)
            ),
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
            )
          );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to send admin notification to %: %', v_admin.email, SQLERRM;
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
