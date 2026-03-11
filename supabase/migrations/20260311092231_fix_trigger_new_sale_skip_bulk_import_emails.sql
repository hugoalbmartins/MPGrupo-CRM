/*
  # Fix trigger_new_sale_alert to skip emails AND alerts for bulk imports

  ## Summary
  The trigger_new_sale_alert was overwritten by a later migration without preserving
  the is_bulk_import check. This migration restores that check so that when a sale
  is created via bulk import (is_bulk_import = true), neither emails NOR in-app
  alerts are sent/created for those sales.

  ## Changes
  - Rebuilt trigger_new_sale_alert to check NEW.is_bulk_import
  - When true: completely skip both alerts and emails (silent import)
  - When false: proceed normally with full alert + email flow

  ## Notes
  - The is_bulk_import column already exists (added in a previous migration)
  - This restores the intended behaviour for mass import via Excel
*/

CREATE OR REPLACE FUNCTION trigger_new_sale_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator_name text;
  v_attachments jsonb;
  v_partner_name text;
  v_email_fields jsonb;
  v_address text;
  v_op_email_envio text;
  v_op_email_password text;
  v_from_email text;
BEGIN
  -- Bulk imports: skip everything (no alerts, no emails)
  IF NEW.is_bulk_import = true THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_creator_name FROM users WHERE id = NEW.created_by_user_id;
  SELECT name INTO v_partner_name FROM partners WHERE id = NEW.partner_id;
  SELECT email_fields, email_envio, email_envio_password
  INTO v_email_fields, v_op_email_envio, v_op_email_password
  FROM operators WHERE id = NEW.operator_id;

  v_attachments := COALESCE(NEW.attachments, '[]'::jsonb);

  v_address := NULLIF(TRIM(
    COALESCE(NEW.street, '') ||
    CASE WHEN NEW.postal_code IS NOT NULL AND NEW.postal_code != '' THEN ', ' || NEW.postal_code ELSE '' END ||
    CASE WHEN NEW.locality IS NOT NULL AND NEW.locality != '' THEN ', ' || NEW.locality ELSE '' END
  ), '');

  IF v_op_email_envio IS NOT NULL AND v_op_email_envio != ''
     AND v_op_email_password IS NOT NULL AND v_op_email_password != '' THEN
    v_from_email := v_op_email_envio || '@mpgrupo.pt';
  ELSE
    v_from_email := NULL;
    v_op_email_password := NULL;
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
    COALESCE(v_partner_name, 'N/A'),
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
    NEW.fix_cvp
  );

  RETURN NEW;
END;
$$;
