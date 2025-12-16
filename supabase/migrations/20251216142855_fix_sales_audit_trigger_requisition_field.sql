/*
  # Fix Sales Audit Trigger - Remove Requisition Field Reference

  1. Changes
    - Remove reference to non-existent 'requisition' field in sales_audit_trigger function
    - The function was trying to access OLD.requisition and NEW.requisition which don't exist
    - This was causing 400 errors when updating sales records
  
  2. Impact
    - Fixes the "record 'old' has no field 'requisition'" error
    - Sales updates will now work correctly
    - Audit log will continue to track all other field changes
*/

CREATE OR REPLACE FUNCTION sales_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_changed_fields text[] := '{}';
  v_old_values jsonb := '{}'::jsonb;
  v_new_values jsonb := '{}'::jsonb;
  v_description text;
  v_action_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'create';
    v_description := 'Venda criada';
    v_new_values := to_jsonb(NEW);

  ELSIF TG_OP = 'UPDATE' THEN
    -- Detectar campos alterados
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_changed_fields := array_append(v_changed_fields, 'status');
      v_old_values := jsonb_set(v_old_values, '{status}', to_jsonb(OLD.status));
      v_new_values := jsonb_set(v_new_values, '{status}', to_jsonb(NEW.status));
      v_action_type := 'status_change';
      v_description := 'Estado alterado de "' || OLD.status || '" para "' || NEW.status || '"';
    END IF;

    IF OLD.request_number IS DISTINCT FROM NEW.request_number THEN
      v_changed_fields := array_append(v_changed_fields, 'request_number');
      v_old_values := jsonb_set(v_old_values, '{request_number}', to_jsonb(OLD.request_number));
      v_new_values := jsonb_set(v_new_values, '{request_number}', to_jsonb(NEW.request_number));
    END IF;

    IF OLD.paid_to_operator IS DISTINCT FROM NEW.paid_to_operator THEN
      v_changed_fields := array_append(v_changed_fields, 'paid_to_operator');
      v_old_values := jsonb_set(v_old_values, '{paid_to_operator}', to_jsonb(OLD.paid_to_operator));
      v_new_values := jsonb_set(v_new_values, '{paid_to_operator}', to_jsonb(NEW.paid_to_operator));
      v_action_type := 'payment_update';
      v_description := 'Estado de pagamento alterado';
    END IF;

    IF OLD.manual_commission IS DISTINCT FROM NEW.manual_commission THEN
      v_changed_fields := array_append(v_changed_fields, 'manual_commission');
      v_old_values := jsonb_set(v_old_values, '{manual_commission}', to_jsonb(OLD.manual_commission));
      v_new_values := jsonb_set(v_new_values, '{manual_commission}', to_jsonb(NEW.manual_commission));
    END IF;

    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
      v_changed_fields := array_append(v_changed_fields, 'notes');
      v_action_type := 'note_added';
      v_description := 'Nova nota adicionada';
    END IF;

    -- Se não foi detectado tipo específico, é update genérico
    IF v_action_type IS NULL THEN
      v_action_type := 'update';
      v_description := 'Venda atualizada - campos: ' || array_to_string(v_changed_fields, ', ');
    END IF;

    -- Só criar log se houve alterações
    IF array_length(v_changed_fields, 1) > 0 THEN
      PERFORM create_sales_audit_log(
        NEW.id,
        NEW.sale_code,
        v_action_type,
        v_old_values,
        v_new_values,
        v_changed_fields,
        v_description
      );
    END IF;
  END IF;

  -- Para INSERT, criar log
  IF TG_OP = 'INSERT' THEN
    PERFORM create_sales_audit_log(
      NEW.id,
      NEW.sale_code,
      v_action_type,
      v_old_values,
      v_new_values,
      v_changed_fields,
      v_description
    );
  END IF;

  RETURN NEW;
END;
$$;
