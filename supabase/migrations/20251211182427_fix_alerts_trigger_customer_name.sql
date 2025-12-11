/*
  # Fix Alerts Trigger - Customer Name Field

  1. Changes
    - Update `trigger_new_sale_alert` function to use `client_name` instead of `customer_name`
    - The column was renamed in a previous migration but the trigger was not updated

  2. Security
    - No security changes, maintaining existing RLS policies
*/

CREATE OR REPLACE FUNCTION trigger_new_sale_alert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_creator_name text;
BEGIN
  SELECT name INTO v_creator_name
  FROM users
  WHERE id = NEW.created_by_user_id;

  PERFORM create_alert_and_notify(
    'new_sale',
    NEW.id,
    NEW.sale_code,
    'Nova venda registada: ' || NEW.sale_code || ' - Cliente: ' || NEW.client_name || ' - Operador: ' || NEW.operator_name,
    NEW.created_by_user_id,
    COALESCE(v_creator_name, 'Sistema'),
    NEW.partner_id,
    NEW.created_by_user_id
  );

  RETURN NEW;
END;
$$;