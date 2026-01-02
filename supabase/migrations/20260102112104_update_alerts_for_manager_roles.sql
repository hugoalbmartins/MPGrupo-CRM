/*
  # Update Alerts System for Manager Roles

  ## Changes
  
  1. Alert Types
    - Ensure new_sale and sale_status_change alerts are created for managers
    
  2. Alert Recipients
    - Gestor Nv1: Receives alerts for all sales
    - Gestor Nv2: Receives alerts for assigned partner sales only
    
  3. Triggers
    - Update alert creation triggers to include managers
*/

-- Update the create_sale_alert function to include managers
CREATE OR REPLACE FUNCTION create_sale_alert(
  alert_type TEXT,
  sale_id UUID,
  sale_code TEXT,
  alert_message TEXT,
  creator_id UUID DEFAULT NULL,
  creator_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  alert_id UUID;
  user_id_array UUID[];
  admin_user RECORD;
  manager_user RECORD;
  sale_partner_id UUID;
BEGIN
  -- Get the partner_id from the sale
  SELECT partner_id INTO sale_partner_id FROM sales WHERE id = sale_id;

  -- Start with empty array
  user_id_array := ARRAY[]::UUID[];

  -- Add all admins
  FOR admin_user IN 
    SELECT id FROM users WHERE role = 'admin'
  LOOP
    user_id_array := array_append(user_id_array, admin_user.id);
  END LOOP;

  -- Add all gestor_nv1 users
  FOR manager_user IN 
    SELECT id FROM users WHERE role = 'gestor_nv1'
  LOOP
    user_id_array := array_append(user_id_array, manager_user.id);
  END LOOP;

  -- Add gestor_nv2 users who manage this partner
  IF sale_partner_id IS NOT NULL THEN
    FOR manager_user IN 
      SELECT u.id 
      FROM users u
      JOIN partners p ON p.manager_id = u.id
      WHERE u.role = 'gestor_nv2' 
      AND p.id = sale_partner_id
    LOOP
      user_id_array := array_append(user_id_array, manager_user.id);
    END LOOP;
  END IF;

  -- Insert the alert
  INSERT INTO alerts (type, sale_id, sale_code, message, user_ids, created_by, created_by_name)
  VALUES (alert_type, sale_id, sale_code, alert_message, user_id_array, creator_id, creator_name)
  RETURNING id INTO alert_id;

  RETURN alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger function for new sales
CREATE OR REPLACE FUNCTION notify_new_sale()
RETURNS TRIGGER AS $$
DECLARE
  creator_name TEXT;
  customer_name TEXT;
  alert_message TEXT;
BEGIN
  -- Get creator name
  SELECT name INTO creator_name FROM users WHERE id = NEW.created_by_user_id;
  
  -- Get customer name
  customer_name := COALESCE(NEW.customer_name, 'Cliente desconhecido');
  
  -- Create message
  alert_message := 'Nova venda registada: ' || customer_name || ' por ' || COALESCE(creator_name, 'Utilizador desconhecido');

  -- Create alert
  PERFORM create_sale_alert(
    'new_sale',
    NEW.id,
    NEW.code,
    alert_message,
    NEW.created_by_user_id,
    creator_name
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger function for status changes
CREATE OR REPLACE FUNCTION notify_sale_status_change()
RETURNS TRIGGER AS $$
DECLARE
  updater_name TEXT;
  customer_name TEXT;
  alert_message TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Get updater name
    SELECT name INTO updater_name FROM users WHERE id = NEW.updated_by_user_id;
    
    -- Get customer name
    customer_name := COALESCE(NEW.customer_name, 'Cliente desconhecido');
    
    -- Create message
    alert_message := 'Estado da venda ' || customer_name || ' alterado de "' || 
                    COALESCE(OLD.status, 'Desconhecido') || '" para "' || NEW.status || 
                    '" por ' || COALESCE(updater_name, 'Utilizador desconhecido');

    -- Create alert
    PERFORM create_sale_alert(
      'sale_status_change',
      NEW.id,
      NEW.code,
      alert_message,
      NEW.updated_by_user_id,
      updater_name
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;