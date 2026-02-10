/*
  # Update trigger_new_sale_alert to pass energy fields

  1. Changes
    - Updates trigger_new_sale_alert function to pass energy-specific fields
    - Passes: scope, entry_type, cpe, power, cui, tier
    - These fields are used by create_new_sale_alert_with_email to populate email template
*/

CREATE OR REPLACE FUNCTION trigger_new_sale_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_creator_name text;
  v_attachments jsonb;
BEGIN
  SELECT name INTO v_creator_name
  FROM users
  WHERE id = NEW.created_by_user_id;

  v_attachments := COALESCE(NEW.attachments, '[]'::jsonb);

  PERFORM create_new_sale_alert_with_email(
    NEW.id,
    NEW.sale_code,
    'Nova venda registada: ' || NEW.sale_code || ' - Cliente: ' || COALESCE(NEW.client_name, 'N/A') || ' - Operadora: ' || COALESCE(NEW.operator_name, 'N/A'),
    NEW.created_by_user_id,
    COALESCE(v_creator_name, 'Sistema'),
    NEW.partner_id,
    NEW.created_by_user_id,
    COALESCE(NEW.client_name, 'N/A'),
    COALESCE(NEW.client_nif, ''),
    COALESCE(NEW.operator_name, 'N/A'),
    NEW.operator_id,
    v_attachments,
    NEW.scope,
    NEW.entry_type,
    NEW.cpe,
    NEW.power,
    NEW.cui,
    NEW.tier
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
