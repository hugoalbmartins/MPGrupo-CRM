/*
  # Create batch_validate_sales RPC function

  1. New Functions
    - `batch_validate_sales(p_updates jsonb)` - Accepts a JSON array of sale update objects
      - Each object contains: sale_id, status, operator_validated, operator_validation_date,
        paid_to_operator, payment_date, electricity_paid, gas_paid, 
        electricity_payment_date, gas_payment_date, is_partial_payment
      - Returns JSON with: updated_count (integer), updated_ids (uuid array), errors (text array)

  2. Security
    - Function checks caller is admin or BO role via has_any_role()
    - Uses SECURITY DEFINER to bypass RLS for the actual updates
    - Only callable by authenticated users

  3. Important Notes
    - This replaces individual PostgREST PATCH calls that were silently failing
    - Each sale update is performed individually within the function so partial failures are tracked
    - The function returns accurate counts of successful updates
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
  v_result record;
BEGIN
  IF NOT has_any_role(ARRAY['admin', 'bo']) THEN
    RETURN jsonb_build_object(
      'updated_count', 0,
      'updated_ids', '[]'::jsonb,
      'errors', jsonb_build_array('Acesso negado: apenas admin e BO podem validar vendas')
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
        v_errors := array_append(v_errors, 'Venda não encontrada: ' || v_sale_id::text);
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
