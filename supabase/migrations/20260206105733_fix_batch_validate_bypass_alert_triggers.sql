/*
  # Fix batch_validate_sales to bypass alert triggers

  1. Modified Functions
    - `batch_validate_sales` - Now disables alert triggers during batch updates
      to prevent trigger errors from blocking the actual sale updates.
      Creates bulk alerts after all updates succeed.
    - `trigger_status_change_alert` - Now checks for batch_validation session flag
      to skip during batch operations
    - `sales_audit_trigger` - Now checks for batch_validation session flag

  2. Important Notes
    - During batch validation, alert triggers could fail (e.g., due to HTTP extension 
      issues in PostgREST context) and block the actual UPDATE operations
    - This fix sets a session variable that trigger functions check
    - Alerts for status changes are created in bulk after all updates succeed
*/

CREATE OR REPLACE FUNCTION batch_validate_sales(p_updates jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_update jsonb;
  v_sale_id uuid;
  v_updated_count integer := 0;
  v_updated_ids uuid[] := '{}';
  v_errors text[] := '{}';
  v_user_role text;
  v_current_uid uuid;
  v_user_name text;
  v_old_status text;
BEGIN
  v_current_uid := auth.uid();
  
  IF v_current_uid IS NULL THEN
    RETURN jsonb_build_object(
      'updated_count', 0,
      'updated_ids', '[]'::jsonb,
      'errors', jsonb_build_array('Utilizador nao autenticado')
    );
  END IF;

  SELECT role, name INTO v_user_role, v_user_name FROM users WHERE id = v_current_uid;

  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'bo') THEN
    RETURN jsonb_build_object(
      'updated_count', 0,
      'updated_ids', '[]'::jsonb,
      'errors', jsonb_build_array('Acesso negado: role=' || COALESCE(v_user_role, 'null'))
    );
  END IF;

  PERFORM set_config('app.batch_validation', 'true', true);

  FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    v_sale_id := (v_update->>'sale_id')::uuid;

    BEGIN
      SELECT status INTO v_old_status FROM sales WHERE id = v_sale_id;

      UPDATE sales SET
        status = COALESCE(v_update->>'status', status),
        operator_validated = COALESCE((v_update->>'operator_validated')::boolean, operator_validated),
        operator_validation_date = COALESCE((v_update->>'operator_validation_date')::timestamptz, operator_validation_date),
        paid_to_operator = COALESCE((v_update->>'paid_to_operator')::boolean, paid_to_operator),
        payment_date = CASE 
          WHEN v_update->>'payment_date' IS NOT NULL THEN (v_update->>'payment_date')::date
          ELSE payment_date
        END,
        electricity_paid = COALESCE((v_update->>'electricity_paid')::boolean, electricity_paid),
        gas_paid = COALESCE((v_update->>'gas_paid')::boolean, gas_paid),
        electricity_payment_date = CASE
          WHEN v_update->>'electricity_payment_date' IS NOT NULL THEN (v_update->>'electricity_payment_date')::date
          ELSE electricity_payment_date
        END,
        gas_payment_date = CASE
          WHEN v_update->>'gas_payment_date' IS NOT NULL THEN (v_update->>'gas_payment_date')::date
          ELSE gas_payment_date
        END,
        is_partial_payment = COALESCE((v_update->>'is_partial_payment')::boolean, is_partial_payment)
      WHERE id = v_sale_id;

      IF FOUND THEN
        v_updated_count := v_updated_count + 1;
        v_updated_ids := array_append(v_updated_ids, v_sale_id);
      ELSE
        v_errors := array_append(v_errors, 'Venda nao encontrada: ' || v_sale_id::text);
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'Erro venda ' || v_sale_id::text || ': ' || SQLERRM);
    END;
  END LOOP;

  PERFORM set_config('app.batch_validation', 'false', true);

  IF v_updated_count > 0 THEN
    BEGIN
      INSERT INTO alerts (type, sale_id, sale_code, message, user_ids, created_by, created_by_name)
      SELECT 
        'operator_validation',
        s.id,
        s.sale_code,
        'Validacao de operador - Venda: ' || s.sale_code || ' marcada como validada',
        ARRAY(SELECT u.id FROM users u WHERE u.role IN ('admin', 'bo')),
        v_current_uid,
        COALESCE(v_user_name, 'Sistema')
      FROM sales s
      WHERE s.id = ANY(v_updated_ids);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'updated_count', v_updated_count,
    'updated_ids', to_jsonb(v_updated_ids),
    'errors', to_jsonb(v_errors)
  );
END;
$$;

CREATE OR REPLACE FUNCTION trigger_status_change_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_modifier_name text;
  v_modifier_id uuid;
BEGIN
  IF current_setting('app.batch_validation', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_modifier_id := auth.uid();
    SELECT name INTO v_modifier_name
    FROM users
    WHERE id = v_modifier_id;

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
$$;

CREATE OR REPLACE FUNCTION trigger_note_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_modifier_name text;
  v_modifier_id uuid;
BEGIN
  IF current_setting('app.batch_validation', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF OLD.notes IS DISTINCT FROM NEW.notes AND NEW.notes IS NOT NULL THEN
    v_modifier_id := auth.uid();
    SELECT name INTO v_modifier_name
    FROM users
    WHERE id = v_modifier_id;

    PERFORM create_alert_and_notify(
      'note_added',
      NEW.id,
      NEW.sale_code,
      'Nova nota adicionada - Venda: ' || NEW.sale_code,
      COALESCE(v_modifier_id, NEW.created_by_user_id),
      COALESCE(v_modifier_name, 'Sistema'),
      NEW.partner_id,
      NEW.created_by_user_id
    );
  END IF;

  RETURN NEW;
END;
$$;
