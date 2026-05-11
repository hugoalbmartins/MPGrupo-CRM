/*
  # Add SMTP configuration to system_settings

  1. New Data
    - Insert `smtp_config` row into `system_settings` table
    - Stores SMTP host, port, user, from email, from name, reply-to, BCC, and provider settings
    - Password is NOT stored in the database (remains in edge function secrets for security)

  2. Security
    - No RLS changes needed (existing admin-only policies apply)
    - SMTP password stays in Supabase edge function secrets (SMTP_PASS env var)
    - Only non-sensitive SMTP settings are stored in the database

  3. Important Notes
    - The `setting_value` JSONB contains all configurable SMTP parameters
    - Edge functions will read this config and fall back to env vars for password
    - Default values match current production configuration
*/

INSERT INTO system_settings (setting_key, setting_value, description)
VALUES (
  'smtp_config',
  '{
    "smtp_host": "mail.mpgrupo.pt",
    "smtp_port": 465,
    "smtp_user": "info@mpgrupo.pt",
    "from_email": "info@mpgrupo.pt",
    "from_name": "MP Grupo CRM",
    "reply_to": "geral@marciopinto.pt",
    "bcc_enabled": false,
    "bcc_emails": [],
    "email_provider": "smtp",
    "new_sale_email_enabled": true,
    "alert_email_enabled": true,
    "commission_report_email_enabled": true,
    "operator_notification_email_enabled": true
  }'::jsonb,
  'Configuracao SMTP e definicoes de envio de email. A password SMTP e gerida via variaveis de ambiente das edge functions por razoes de seguranca.'
)
ON CONFLICT (setting_key) DO NOTHING;
