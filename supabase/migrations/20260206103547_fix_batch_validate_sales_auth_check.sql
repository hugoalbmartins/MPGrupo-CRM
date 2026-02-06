/*
  # Fix batch_validate_sales auth check

  1. Modified Functions
    - `batch_validate_sales(p_updates jsonb)` - Updated to use direct role check
      instead of has_any_role() which may fail in RPC SECURITY DEFINER context
    - Added debug info to error response for troubleshooting
    - Direct SELECT from users table using auth.uid() for role verification

  2. Important Notes
    - The has_any_role() function depends on auth.uid() which may not be
      properly set in all RPC calling contexts
    - Direct query approach is more reliable in SECURITY DEFINER functions
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
BEGIN
  v_current_uid := auth.uid();
  
  IF v_current_uid IS NULL THEN
    RETURN jsonb_build_object(
      'updated_count', 0,
      'updated_ids', '[]'::jsonb,
      'errors', jsonb_build_array('Utilizador nao autenticado')
    );
  END IF;

  SELECT role INTO v_user_role FROM users WHERE id = v_current_uid;

  IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'bo') THEN
    RETURN jsonb_build_object(
      'updated_count', 0,
      'updated_ids', '[]'::jsonb,
      'errors', jsonb_build_array('Acesso negado: role=' || COALESCE(v_user_role, 'null') || ' uid=' || v_current_uid::text)
    );
  END IF;

  FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    v_sale_id := (v_update->>'sale_id')::uuid;

    BEGIN
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
      v_errors := array_append(v_errors, 'Erro ao atualizar venda ' || v_sale_id::text || ': ' || SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'updated_count', v_updated_count,
    'updated_ids', to_jsonb(v_updated_ids),
    'errors', to_jsonb(v_errors)
  );
END;
$$;
