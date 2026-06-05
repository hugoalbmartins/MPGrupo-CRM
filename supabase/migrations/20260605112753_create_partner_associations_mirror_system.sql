/*
  # Partner Associations (Sales Mirroring) System
  
  Creates a system where partners can be linked so that sales registered for the 
  primary partner are automatically copied to the secondary partner.
  
  Key behaviors:
  - Mirror copies don't count in dashboard quantities (is_mirror_copy = true)
  - Each partner sees their own sales in listings and exports
  - Commissions are calculated independently per partner's config
  - No alerts/emails for mirror copies (is_bulk_import = true on copies)
  - Mirrors sync on insert/update/delete of original
*/

-- Table to store partner associations
CREATE TABLE partner_associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  secondary_partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT NOW(),
  created_by uuid REFERENCES users(id),
  CONSTRAINT partner_assoc_no_self CHECK (primary_partner_id != secondary_partner_id),
  CONSTRAINT partner_assoc_unique UNIQUE (primary_partner_id, secondary_partner_id)
);

-- Prevent a partner from being secondary in multiple associations
CREATE UNIQUE INDEX idx_partner_assoc_secondary_unique ON partner_associations(secondary_partner_id);

-- Add mirror tracking fields to sales
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS is_mirror_copy boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS mirror_source_sale_id uuid REFERENCES sales(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS mirror_source_partner_id uuid REFERENCES partners(id) ON DELETE SET NULL;

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_sales_is_mirror_copy ON sales(is_mirror_copy) WHERE is_mirror_copy = true;
CREATE INDEX IF NOT EXISTS idx_sales_mirror_source_sale_id ON sales(mirror_source_sale_id) WHERE mirror_source_sale_id IS NOT NULL;

-- RLS for partner_associations
ALTER TABLE partner_associations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_partner_associations" ON partner_associations
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'bo'))
  );

CREATE POLICY "insert_partner_associations" ON partner_associations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "update_partner_associations" ON partner_associations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "delete_partner_associations" ON partner_associations
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- Function to create a mirror copy of a sale for a secondary partner
CREATE OR REPLACE FUNCTION mirror_sale_to_partner(
  p_source_sale_id uuid,
  p_secondary_partner_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_source_sale RECORD;
  v_secondary_partner RECORD;
  v_new_id uuid;
  v_new_code text;
BEGIN
  -- Get the source sale
  SELECT * INTO v_source_sale FROM sales WHERE id = p_source_sale_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  
  -- Get the secondary partner
  SELECT id, name FROM partners INTO v_secondary_partner WHERE id = p_secondary_partner_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  
  -- Generate new ID and code
  v_new_id := gen_random_uuid();
  v_new_code := v_source_sale.sale_code || '_M';
  
  -- Check if code already exists, append timestamp if so
  IF EXISTS (SELECT 1 FROM sales WHERE sale_code = v_new_code) THEN
    v_new_code := v_new_code || '_' || extract(epoch from now())::bigint;
  END IF;
  
  -- Insert the mirror copy
  INSERT INTO sales (
    id, sale_code, date, partner_id, partner_name, created_by_user_id,
    scope, client_type, client_name, client_nif, client_contact, client_email, client_iban,
    street, postal_code, locality, installation_address, billing_address,
    operator_id, operator_name, status, service_type, activation_type,
    monthly_value, current_monthly_fee, contracted_monthly_fee,
    energy_sale_type, cpe, power, entry_type, cui, tier, voltage_type, additional_services,
    observations, autoriza_documentos,
    has_direct_debit, has_electronic_invoice,
    has_tv, has_net, has_lr, fix_ported, fix_number, fix_operator, fix_cvp,
    mobile_count, mobile_numbers, tratar_oop, technology,
    sale_type, parent_sale_id,
    ev_outlet_count, ev_monthly_fee, ev_margin, ev_fidelization_months,
    activation_date, paid_to_operator, payment_date,
    custom_fields, attachments,
    is_bulk_import, is_mirror_copy, mirror_source_sale_id, mirror_source_partner_id,
    calculated_commission
  )
  SELECT
    v_new_id, v_new_code, v_source_sale.date, p_secondary_partner_id, v_secondary_partner.name,
    v_source_sale.created_by_user_id,
    v_source_sale.scope, v_source_sale.client_type, v_source_sale.client_name,
    v_source_sale.client_nif, v_source_sale.client_contact, v_source_sale.client_email,
    v_source_sale.client_iban, v_source_sale.street, v_source_sale.postal_code,
    v_source_sale.locality, v_source_sale.installation_address, v_source_sale.billing_address,
    v_source_sale.operator_id, v_source_sale.operator_name, v_source_sale.status,
    v_source_sale.service_type, v_source_sale.activation_type,
    v_source_sale.monthly_value, v_source_sale.current_monthly_fee, v_source_sale.contracted_monthly_fee,
    v_source_sale.energy_sale_type, v_source_sale.cpe, v_source_sale.power, v_source_sale.entry_type,
    v_source_sale.cui, v_source_sale.tier, v_source_sale.voltage_type, v_source_sale.additional_services,
    v_source_sale.observations, v_source_sale.autoriza_documentos,
    v_source_sale.has_direct_debit, v_source_sale.has_electronic_invoice,
    v_source_sale.has_tv, v_source_sale.has_net, v_source_sale.has_lr,
    v_source_sale.fix_ported, v_source_sale.fix_number, v_source_sale.fix_operator, v_source_sale.fix_cvp,
    v_source_sale.mobile_count, v_source_sale.mobile_numbers, v_source_sale.tratar_oop, v_source_sale.technology,
    v_source_sale.sale_type, v_source_sale.parent_sale_id,
    v_source_sale.ev_outlet_count, v_source_sale.ev_monthly_fee, v_source_sale.ev_margin,
    v_source_sale.ev_fidelization_months,
    v_source_sale.activation_date, v_source_sale.paid_to_operator, v_source_sale.payment_date,
    v_source_sale.custom_fields, v_source_sale.attachments,
    true, -- is_bulk_import (prevents alerts/emails)
    true, -- is_mirror_copy
    p_source_sale_id, -- mirror_source_sale_id
    v_source_sale.partner_id, -- mirror_source_partner_id (the primary partner)
    0 -- calculated_commission placeholder (will be updated by frontend on recalc)
  ;
  
  RETURN v_new_id;
END;
$$;

-- Trigger function: auto-mirror on INSERT
CREATE OR REPLACE FUNCTION trigger_mirror_sale_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assoc RECORD;
BEGIN
  -- Only mirror non-copy, non-proposal sales
  IF NEW.is_mirror_copy = true THEN
    RETURN NEW;
  END IF;
  
  -- Find associations where this partner is primary
  FOR v_assoc IN
    SELECT secondary_partner_id FROM partner_associations
    WHERE primary_partner_id = NEW.partner_id
  LOOP
    PERFORM mirror_sale_to_partner(NEW.id, v_assoc.secondary_partner_id);
  END LOOP;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_sale_mirror_insert
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION trigger_mirror_sale_on_insert();

-- Trigger function: sync mirror on UPDATE of original
CREATE OR REPLACE FUNCTION trigger_sync_mirror_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only sync if this is NOT a mirror copy itself
  IF NEW.is_mirror_copy = true THEN
    RETURN NEW;
  END IF;
  
  -- Update all mirror copies to match the source (except partner-specific fields)
  UPDATE sales SET
    date = NEW.date,
    scope = NEW.scope,
    client_type = NEW.client_type,
    client_name = NEW.client_name,
    client_nif = NEW.client_nif,
    client_contact = NEW.client_contact,
    client_email = NEW.client_email,
    client_iban = NEW.client_iban,
    street = NEW.street,
    postal_code = NEW.postal_code,
    locality = NEW.locality,
    installation_address = NEW.installation_address,
    billing_address = NEW.billing_address,
    operator_id = NEW.operator_id,
    operator_name = NEW.operator_name,
    status = NEW.status,
    service_type = NEW.service_type,
    activation_type = NEW.activation_type,
    monthly_value = NEW.monthly_value,
    current_monthly_fee = NEW.current_monthly_fee,
    contracted_monthly_fee = NEW.contracted_monthly_fee,
    energy_sale_type = NEW.energy_sale_type,
    cpe = NEW.cpe,
    power = NEW.power,
    entry_type = NEW.entry_type,
    cui = NEW.cui,
    tier = NEW.tier,
    voltage_type = NEW.voltage_type,
    additional_services = NEW.additional_services,
    observations = NEW.observations,
    autoriza_documentos = NEW.autoriza_documentos,
    has_direct_debit = NEW.has_direct_debit,
    has_electronic_invoice = NEW.has_electronic_invoice,
    has_tv = NEW.has_tv,
    has_net = NEW.has_net,
    has_lr = NEW.has_lr,
    fix_ported = NEW.fix_ported,
    fix_number = NEW.fix_number,
    fix_operator = NEW.fix_operator,
    fix_cvp = NEW.fix_cvp,
    mobile_count = NEW.mobile_count,
    mobile_numbers = NEW.mobile_numbers,
    tratar_oop = NEW.tratar_oop,
    technology = NEW.technology,
    sale_type = NEW.sale_type,
    ev_outlet_count = NEW.ev_outlet_count,
    ev_monthly_fee = NEW.ev_monthly_fee,
    ev_margin = NEW.ev_margin,
    ev_fidelization_months = NEW.ev_fidelization_months,
    activation_date = NEW.activation_date,
    paid_to_operator = NEW.paid_to_operator,
    payment_date = NEW.payment_date,
    custom_fields = NEW.custom_fields,
    attachments = NEW.attachments
  WHERE mirror_source_sale_id = NEW.id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_sale_mirror_sync_update
  AFTER UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_mirror_on_update();

-- RPC to sync existing sales when association is created
CREATE OR REPLACE FUNCTION sync_partner_association_sales(
  p_primary_partner_id uuid,
  p_secondary_partner_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale RECORD;
  v_count integer := 0;
BEGIN
  -- First delete any existing mirrors from this pair
  DELETE FROM sales
  WHERE is_mirror_copy = true
    AND mirror_source_partner_id = p_primary_partner_id
    AND partner_id = p_secondary_partner_id;
  
  -- Copy all non-mirror, non-proposal sales from primary to secondary
  FOR v_sale IN
    SELECT id FROM sales
    WHERE partner_id = p_primary_partner_id
      AND is_mirror_copy = false
      AND status != 'Em proposta'
  LOOP
    PERFORM mirror_sale_to_partner(v_sale.id, p_secondary_partner_id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- RPC to clear mirror sales when association is removed
CREATE OR REPLACE FUNCTION clear_partner_association_sales(
  p_primary_partner_id uuid,
  p_secondary_partner_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM sales
  WHERE is_mirror_copy = true
    AND mirror_source_partner_id = p_primary_partner_id
    AND partner_id = p_secondary_partner_id;
  
  DELETE FROM sales
  WHERE is_mirror_copy = true
    AND mirror_source_partner_id = p_primary_partner_id
    AND partner_id = p_secondary_partner_id;
  
  RETURN v_count;
END;
$$;
