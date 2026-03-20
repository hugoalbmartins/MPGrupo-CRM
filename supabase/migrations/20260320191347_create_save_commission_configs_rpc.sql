/*
  # Create atomic save_commission_configs RPC function

  ## Summary
  Provides a single transactional RPC to replace all commission configurations
  for an operator. This prevents data loss if the INSERT fails after a DELETE
  by wrapping both operations in a single database transaction.

  ## New Functions
  - `save_commission_configs(p_operator_id, p_configs)`: Deletes all existing configs
    for the operator and inserts the provided array in one atomic transaction.
    Only admin and bo roles can call this function.
*/

CREATE OR REPLACE FUNCTION save_commission_configs(
  p_operator_id uuid,
  p_configs jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role text;
  v_config jsonb;
BEGIN
  SELECT role INTO v_user_role FROM users WHERE id = auth.uid();
  IF v_user_role NOT IN ('admin', 'bo') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  DELETE FROM commission_configurations WHERE operator_id = p_operator_id;

  FOR v_config IN SELECT * FROM jsonb_array_elements(p_configs)
  LOOP
    INSERT INTO commission_configurations (
      operator_id,
      partner_type,
      client_type,
      service_type,
      service_types,
      commission_mode,
      commission_value,
      min_sales,
      has_retention,
      retention_percentage,
      retention_months,
      direct_debit_bonus,
      electronic_invoice_bonus,
      tier_mode,
      monthly_value_min,
      monthly_value_max,
      refid_operation_type,
      activation_type,
      d2d_level,
      rev_level,
      power_value,
      additional_service_name,
      created_by,
      updated_by
    ) VALUES (
      p_operator_id,
      v_config->>'partner_type',
      v_config->>'client_type',
      v_config->>'service_type',
      CASE WHEN v_config->'service_types' IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(v_config->'service_types')) ELSE ARRAY[v_config->>'service_type'] END,
      COALESCE(v_config->>'commission_mode', 'fixed_value'),
      COALESCE((v_config->>'commission_value')::numeric, 0),
      COALESCE((v_config->>'min_sales')::integer, 0),
      COALESCE((v_config->>'has_retention')::boolean, false),
      COALESCE((v_config->>'retention_percentage')::numeric, 0),
      COALESCE((v_config->>'retention_months')::integer, 0),
      COALESCE((v_config->>'direct_debit_bonus')::numeric, 0),
      COALESCE((v_config->>'electronic_invoice_bonus')::numeric, 0),
      COALESCE(v_config->>'tier_mode', 'by_quantity'),
      COALESCE((v_config->>'monthly_value_min')::numeric, 0),
      COALESCE((v_config->>'monthly_value_max')::numeric, 0),
      v_config->>'refid_operation_type',
      v_config->>'activation_type',
      v_config->>'d2d_level',
      CASE WHEN v_config->>'rev_level' IS NOT NULL THEN (v_config->>'rev_level')::integer ELSE NULL END,
      CASE WHEN v_config->>'power_value' IS NOT NULL THEN (v_config->>'power_value')::numeric ELSE NULL END,
      v_config->>'additional_service_name',
      auth.uid(),
      auth.uid()
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION save_commission_configs(uuid, jsonb) TO authenticated;
