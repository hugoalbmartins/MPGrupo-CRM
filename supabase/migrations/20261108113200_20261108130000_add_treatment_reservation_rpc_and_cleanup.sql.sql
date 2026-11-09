/*
# Add treatment reservation RPC and cleanup duplicate trigger

## Purpose
1. Removes the duplicate trigger `trg_new_sale_alert` created in the previous
   migration (the existing `sales_new_sale_alert` trigger already calls
   `trigger_new_sale_alert()`).
2. Adds an explicit `internal_treatment` skip to `trigger_new_sale_alert()` so
   treatment sales never generate a new-sale alert even if is_bulk_import
   is later cleared.
3. Creates `start_treatment(sale_id, user_id)` RPC that:
   - Sets `treatment_reserved_by` and `treatment_reserved_at`.
   - Deletes existing alerts for the sale so they stop appearing.
4. Creates `complete_treatment(sale_id, oportunidade_number, user_id)` RPC that:
   - Clears `internal_treatment`, records `oportunidade_number`, sets status to
     'Para registo', clears the reservation, and clears is_bulk_import so the
     normal new-sale alert/email flow can fire on future changes.

## Security
- Both RPCs verify the caller is admin/bo via auth.uid() lookup.
- Existing RLS grants on sales already cover admin/bo UPDATE/SELECT.
*/

-- 1. Drop duplicate trigger
DROP TRIGGER IF EXISTS trg_new_sale_alert ON sales;
DROP FUNCTION IF EXISTS trigger_new_sale_alert_func();

-- 2. Add internal_treatment skip to existing trigger function
CREATE OR REPLACE FUNCTION trigger_new_sale_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
v_creator_name text;
v_attachments jsonb;
v_partner_name text;
v_email_fields jsonb;
v_address text;
v_op_email_envio text;
v_op_email_password text;
v_from_email text;
v_requires_additional_services boolean;
v_energy_points jsonb := '[]'::jsonb;
v_point RECORD;
v_partner_sales_blocked boolean := false;
BEGIN
IF TG_OP != 'INSERT' THEN
RETURN NEW;
END IF;

IF NEW.is_bulk_import IS TRUE THEN
RETURN NEW;
END IF;

IF NEW.internal_treatment IS TRUE THEN
RETURN NEW;
END IF;

SELECT name INTO v_creator_name FROM users WHERE id = NEW.created_by_user_id;
SELECT name, sales_blocked INTO v_partner_name, v_partner_sales_blocked FROM partners WHERE id = NEW.partner_id;

v_attachments := COALESCE(NEW.attachments, '[]'::jsonb);

SELECT email_envio, email_envio_password, requires_additional_services
INTO v_op_email_envio, v_op_email_password, v_requires_additional_services
FROM operators WHERE id = NEW.operator_id;

v_from_email := v_op_email_envio;

IF NEW.scope = 'energia' THEN
v_address := CASE
WHEN NEW.installation_address IS NOT NULL AND NEW.installation_address != '' THEN NEW.installation_address
ELSE COALESCE(NEW.street, '') || CASE WHEN NEW.postal_code IS NOT NULL THEN ', ' || NEW.postal_code ELSE '' END || CASE WHEN NEW.locality IS NOT NULL THEN ', ' || NEW.locality ELSE '' END
END;
ELSE
v_address := COALESCE(NEW.street, '') || CASE WHEN NEW.postal_code IS NOT NULL THEN ', ' || NEW.postal_code ELSE '' END || CASE WHEN NEW.locality IS NOT NULL THEN ', ' || NEW.locality ELSE '' END;
END IF;

SELECT email_fields INTO v_email_fields FROM operators WHERE id = NEW.operator_id;

IF NEW.sale_type = 'multiponto' THEN
FOR v_point IN
SELECT point_type, point_code, power_kva, tier,
inst_street, inst_postal_code, inst_locality,
installation_address, billing_address,
energy_type, entry_type, voltage_type, additional_services
FROM sales_energy_points
WHERE sale_id = NEW.id
ORDER BY created_at
LOOP
v_energy_points := v_energy_points || jsonb_build_object(
'point_type', v_point.point_type,
'point_code', v_point.point_code,
'power_kva', v_point.power_kva,
'tier', v_point.tier,
'inst_street', v_point.inst_street,
'inst_postal_code', v_point.inst_postal_code,
'inst_locality', v_point.inst_locality,
'installation_address', v_point.installation_address,
'billing_address', v_point.billing_address,
'energy_type', v_point.energy_type,
'entry_type', v_point.entry_type,
'voltage_type', v_point.voltage_type,
'additional_services', v_point.additional_services
);
END LOOP;
ELSIF NEW.sale_type = 'multilocal' THEN
WITH raw_points AS (
SELECT point_type, point_code, power_kva, tier,
inst_street, inst_postal_code, inst_locality,
installation_address, billing_address,
energy_type, entry_type, voltage_type, additional_services,
created_at,
COALESCE(
NULLIF(TRIM(installation_address), ''),
NULLIF(TRIM(CONCAT_WS('|', inst_street, inst_postal_code, inst_locality)), ''),
'point-' || row_number() OVER (ORDER BY created_at)::text
) AS location_key
FROM sales_energy_points
WHERE sale_id = NEW.id
),
grouped AS (
SELECT
location_key,
MIN(created_at) AS first_created,
MAX(inst_street) AS inst_street,
MAX(inst_postal_code) AS inst_postal_code,
MAX(inst_locality) AS inst_locality,
MAX(installation_address) AS installation_address,
MAX(billing_address) AS billing_address,
MAX(energy_type) AS energy_type,
MAX(entry_type) AS entry_type,
MAX(voltage_type) AS voltage_type,
MAX(additional_services) AS additional_services,
MAX(CASE WHEN point_type = 'cpe' THEN point_code END) AS cpe_code,
MAX(CASE WHEN point_type = 'cpe' THEN power_kva END) AS cpe_power,
MAX(CASE WHEN point_type = 'cui' THEN point_code END) AS cui_code,
MAX(CASE WHEN point_type = 'cui' THEN tier END) AS cui_tier
FROM raw_points
GROUP BY location_key
)
SELECT COALESCE(jsonb_agg(
jsonb_build_object(
'point_type', CASE
WHEN cpe_code IS NOT NULL AND cui_code IS NOT NULL THEN 'dual'
WHEN cui_code IS NOT NULL THEN 'cui'
ELSE 'cpe'
END,
'point_code', COALESCE(cpe_code, cui_code),
'power_kva', cpe_power,
'tier', cui_tier,
'cpe_code', cpe_code,
'cpe_power', cpe_power,
'cui_code', cui_code,
'cui_tier', cui_tier,
'inst_street', inst_street,
'inst_postal_code', inst_postal_code,
'inst_locality', inst_locality,
'installation_address', installation_address,
'billing_address', billing_address,
'energy_type', energy_type,
'entry_type', entry_type,
'voltage_type', voltage_type,
'additional_services', additional_services
) ORDER BY first_created
), '[]'::jsonb)
INTO v_energy_points
FROM grouped;
END IF;

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
NEW.tier,
NEW.autoriza_documentos,
NEW.service_type,
NEW.activation_type,
COALESCE(NEW.has_tv, false),
COALESCE(NEW.has_net, false),
COALESCE(NEW.has_lr, false),
COALESCE(NEW.fix_ported, false),
NEW.fix_number,
NEW.fix_operator,
COALESCE(NEW.mobile_count, 0),
COALESCE(NEW.mobile_numbers, '[]'::jsonb),
v_partner_name,
v_email_fields,
NEW.client_contact,
NEW.client_email,
NEW.client_iban,
v_address,
NEW.installation_address,
NEW.energy_sale_type,
NEW.monthly_value,
NEW.current_monthly_fee,
NEW.contracted_monthly_fee,
COALESCE(NEW.has_direct_debit, false),
COALESCE(NEW.has_electronic_invoice, false),
NEW.observations,
NEW.voltage_type,
NEW.additional_services,
v_from_email,
v_op_email_password,
NEW.fix_cvp,
COALESCE(v_requires_additional_services, false),
NEW.campaign,
COALESCE(NEW.sale_type, 'normal'),
NEW.billing_address,
v_energy_points,
NEW.ev_outlet_count,
NEW.ev_monthly_fee,
NEW.ev_margin,
NEW.ev_fidelization_months,
COALESCE(v_partner_sales_blocked, false)
);

RETURN NEW;
END;
$function$;

-- 3. start_treatment RPC
CREATE OR REPLACE FUNCTION start_treatment(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role text;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_user_role FROM users WHERE id = v_user_id;
  IF v_user_role NOT IN ('admin', 'bo') THEN
    RAISE EXCEPTION 'Only admin/bo can start treatment';
  END IF;

  UPDATE sales
  SET treatment_reserved_by = v_user_id,
      treatment_reserved_at = now(),
      internal_treatment = true
  WHERE id = p_sale_id
    AND internal_treatment = true;

  -- Delete existing alerts for this sale so they stop appearing.
  DELETE FROM alerts WHERE sale_id = p_sale_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION start_treatment(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION start_treatment(uuid) FROM anon;

-- 4. complete_treatment RPC
CREATE OR REPLACE FUNCTION complete_treatment(p_sale_id uuid, p_oportunidade_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role text;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_user_role FROM users WHERE id = v_user_id;
  IF v_user_role NOT IN ('admin', 'bo') THEN
    RAISE EXCEPTION 'Only admin/bo can complete treatment';
  END IF;

  IF p_oportunidade_number IS NULL OR btrim(p_oportunidade_number) = '' THEN
    RAISE EXCEPTION 'Oportunidade number is required';
  END IF;

  UPDATE sales
  SET internal_treatment = false,
      oportunidade_number = btrim(p_oportunidade_number),
      treatment_reserved_by = NULL,
      treatment_reserved_at = NULL,
      status = 'Para registo',
      is_bulk_import = false
  WHERE id = p_sale_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION complete_treatment(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION complete_treatment(uuid, text) FROM anon;
