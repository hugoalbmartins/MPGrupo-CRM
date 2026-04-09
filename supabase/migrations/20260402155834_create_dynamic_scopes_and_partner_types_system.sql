/*
  # Dynamic Scopes, Fields, and Partner Types System

  1. New Tables
    - `scopes` - Sale scopes (replaces hardcoded telecomunicacoes/energia/solar/mobilidade_eletrica)
      - `id` (uuid, primary key)
      - `slug` (text, unique) - internal identifier e.g. "telecomunicacoes"
      - `display_name` (text) - visible name e.g. "Telecomunicacoes"
      - `icon` (text) - lucide icon name
      - `color` (text) - hex color
      - `sort_order` (integer) - display order
      - `is_system` (boolean) - prevents deletion of built-in scopes
      - `active` (boolean)
      - `created_at` (timestamptz)

    - `scope_fields` - Custom fields for each scope's sale form
      - `id` (uuid, primary key)
      - `scope_id` (uuid, FK to scopes)
      - `field_key` (text) - internal key e.g. "cpe"
      - `label` (text) - display label
      - `field_type` (text) - text, number, select, checkbox, date, textarea, email, phone
      - `is_required` (boolean)
      - `placeholder` (text)
      - `validation_rules` (jsonb) - min_length, max_length, min_value, max_value, pattern
      - `options` (jsonb) - for select fields
      - `sort_order` (integer)
      - `section` (text) - visual grouping
      - `depends_on` (jsonb) - conditional visibility rules
      - `is_system` (boolean) - prevents deletion of built-in fields
      - `maps_to_column` (text) - maps to existing sales table column if applicable
      - `active` (boolean)
      - `created_at` (timestamptz)

    - `scope_email_fields` - Fields to include in notification emails per scope
      - `id` (uuid, primary key)
      - `scope_id` (uuid, FK to scopes)
      - `field_key` (text)
      - `label` (text)
      - `sort_order` (integer)

    - `partner_types` - Dynamic partner types (replaces hardcoded D2D/REV/Rev+)
      - `id` (uuid, primary key)
      - `slug` (text, unique) - internal identifier e.g. "D2D"
      - `display_name` (text)
      - `code_prefix` (text) - for partner code generation e.g. "D2D"
      - `has_levels` (boolean)
      - `level_type` (text) - "named" or "numeric"
      - `max_levels` (integer)
      - `default_level_names` (jsonb) - default level names
      - `is_system` (boolean)
      - `active` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all new tables
    - Admin-only write access
    - Authenticated read access for all users

  3. Data Population
    - Insert existing 4 scopes
    - Insert existing 3 partner types (D2D, REV, Rev+)
    - Insert all existing scope fields
    - Insert all existing scope email fields
*/

-- Create scopes table
CREATE TABLE IF NOT EXISTS scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  display_name text NOT NULL,
  icon text DEFAULT 'circle',
  color text DEFAULT '#06b6d4',
  sort_order integer DEFAULT 0,
  is_system boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read scopes"
  ON scopes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert scopes"
  ON scopes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update scopes"
  ON scopes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete non-system scopes"
  ON scopes FOR DELETE
  TO authenticated
  USING (
    is_system = false
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create scope_fields table
CREATE TABLE IF NOT EXISTS scope_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id uuid NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'select', 'checkbox', 'date', 'textarea', 'email', 'phone')),
  is_required boolean DEFAULT false,
  placeholder text DEFAULT '',
  validation_rules jsonb DEFAULT '{}'::jsonb,
  options jsonb DEFAULT '[]'::jsonb,
  sort_order integer DEFAULT 0,
  section text DEFAULT 'general',
  depends_on jsonb DEFAULT NULL,
  is_system boolean DEFAULT false,
  maps_to_column text DEFAULT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(scope_id, field_key)
);

ALTER TABLE scope_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read scope_fields"
  ON scope_fields FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert scope_fields"
  ON scope_fields FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update scope_fields"
  ON scope_fields FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete non-system scope_fields"
  ON scope_fields FOR DELETE
  TO authenticated
  USING (
    is_system = false
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create scope_email_fields table
CREATE TABLE IF NOT EXISTS scope_email_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id uuid NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  sort_order integer DEFAULT 0,
  UNIQUE(scope_id, field_key)
);

ALTER TABLE scope_email_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read scope_email_fields"
  ON scope_email_fields FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert scope_email_fields"
  ON scope_email_fields FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update scope_email_fields"
  ON scope_email_fields FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete scope_email_fields"
  ON scope_email_fields FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create partner_types table
CREATE TABLE IF NOT EXISTS partner_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  display_name text NOT NULL,
  code_prefix text NOT NULL,
  has_levels boolean DEFAULT false,
  level_type text DEFAULT 'named' CHECK (level_type IN ('named', 'numeric')),
  max_levels integer DEFAULT 5,
  default_level_names jsonb DEFAULT '[]'::jsonb,
  is_system boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE partner_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read partner_types"
  ON partner_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert partner_types"
  ON partner_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update partner_types"
  ON partner_types FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete non-system partner_types"
  ON partner_types FOR DELETE
  TO authenticated
  USING (
    is_system = false
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Add custom_fields JSONB column to sales for dynamic fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'custom_fields'
  ) THEN
    ALTER TABLE sales ADD COLUMN custom_fields jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Populate scopes with existing hardcoded values
INSERT INTO scopes (slug, display_name, icon, color, sort_order, is_system, active) VALUES
  ('telecomunicacoes', 'Telecomunicacoes', 'phone', '#3b82f6', 1, true, true),
  ('energia', 'Energia', 'zap', '#f59e0b', 2, true, true),
  ('solar', 'Solar', 'sun', '#eab308', 3, true, true),
  ('mobilidade_eletrica', 'Mobilidade Eletrica', 'car', '#10b981', 4, true, true)
ON CONFLICT (slug) DO NOTHING;

-- Populate partner_types with existing hardcoded values
INSERT INTO partner_types (slug, display_name, code_prefix, has_levels, level_type, max_levels, default_level_names, is_system, active) VALUES
  ('D2D', 'D2D', 'D2D', true, 'named', 10, '["Nv1","Nv2","Nv3","Nv4","Nv5"]'::jsonb, true, true),
  ('REV', 'REV', 'REV', true, 'numeric', 5, '["1","2","3","4","5"]'::jsonb, true, true),
  ('Rev+', 'Rev+', 'Rev+', true, 'numeric', 5, '["1","2","3","4","5"]'::jsonb, true, true)
ON CONFLICT (slug) DO NOTHING;

-- Populate scope_fields for TELECOMUNICACOES
DO $$
DECLARE
  v_scope_id uuid;
BEGIN
  SELECT id INTO v_scope_id FROM scopes WHERE slug = 'telecomunicacoes';

  INSERT INTO scope_fields (scope_id, field_key, label, field_type, is_required, placeholder, validation_rules, options, sort_order, section, depends_on, is_system, maps_to_column) VALUES
    (v_scope_id, 'service_type', 'Tipo de Servico', 'select', true, '', '{}', '["NI","MC","REFID"]', 1, 'service_details', NULL, true, 'service_type'),
    (v_scope_id, 'activation_type', 'Tipo de Ativacao', 'select', true, '', '{}', '["M2","M3","M4","Movel"]', 2, 'service_details', NULL, true, 'activation_type'),
    (v_scope_id, 'monthly_value', 'Mensalidade (EUR)', 'number', true, '0.00', '{"min_value":0,"step":0.01}', '[]', 3, 'service_details', '{"field":"service_type","operator":"not_equals","value":"REFID"}', true, 'monthly_value'),
    (v_scope_id, 'current_monthly_fee', 'Mensalidade Atual (EUR)', 'number', true, '0.00', '{"min_value":0,"step":0.01}', '[]', 4, 'service_details', '{"field":"service_type","operator":"equals","value":"REFID"}', true, 'current_monthly_fee'),
    (v_scope_id, 'contracted_monthly_fee', 'Mensalidade Contratada (EUR)', 'number', true, '0.00', '{"min_value":0,"step":0.01}', '[]', 5, 'service_details', '{"field":"service_type","operator":"equals","value":"REFID"}', true, 'contracted_monthly_fee'),
    (v_scope_id, 'has_tv', 'TV', 'checkbox', false, '', '{}', '[]', 6, 'services', '{"field":"activation_type","operator":"not_equals","value":"Movel"}', true, 'has_tv'),
    (v_scope_id, 'has_net', 'NET/Fibra', 'checkbox', false, '', '{}', '[]', 7, 'services', '{"field":"activation_type","operator":"not_equals","value":"Movel"}', true, 'has_net'),
    (v_scope_id, 'has_lr', 'Linha Fixa/LR', 'checkbox', false, '', '{}', '[]', 8, 'services', '{"field":"activation_type","operator":"not_equals","value":"Movel"}', true, 'has_lr'),
    (v_scope_id, 'fix_ported', 'Fixo e portado?', 'checkbox', false, '', '{}', '[]', 9, 'portability', '{"field":"has_lr","operator":"equals","value":true}', true, 'fix_ported'),
    (v_scope_id, 'fix_number', 'Numero fixo a portar', 'text', true, '', '{"max_length":9}', '[]', 10, 'portability', '{"field":"fix_ported","operator":"equals","value":true}', true, 'fix_number'),
    (v_scope_id, 'fix_operator', 'Operadora atual', 'select', true, '', '{}', '["MEO","Vodafone","NOS","Digi","Outro"]', 11, 'portability', '{"field":"fix_ported","operator":"equals","value":true}', true, 'fix_operator'),
    (v_scope_id, 'fix_cvp', 'CVP do fixo', 'text', true, '', '{"max_length":12}', '[]', 12, 'portability', '{"field":"fix_ported","operator":"equals","value":true}', true, 'fix_cvp'),
    (v_scope_id, 'mobile_count', 'Quantidade de Moveis', 'select', false, '', '{}', '["0","1","2","3","4","5"]', 13, 'mobile', '{"field":"activation_type","operator":"in","value":["M4","Movel"]}', true, 'mobile_count'),
    (v_scope_id, 'tratar_oop', 'Tratar desligamento OOP?', 'checkbox', false, '', '{}', '[]', 14, 'other', NULL, true, 'tratar_oop')
  ON CONFLICT (scope_id, field_key) DO NOTHING;
END $$;

-- Populate scope_fields for ENERGIA
DO $$
DECLARE
  v_scope_id uuid;
BEGIN
  SELECT id INTO v_scope_id FROM scopes WHERE slug = 'energia';

  INSERT INTO scope_fields (scope_id, field_key, label, field_type, is_required, placeholder, validation_rules, options, sort_order, section, depends_on, is_system, maps_to_column) VALUES
    (v_scope_id, 'energy_sale_type', 'Tipo de energia', 'select', false, '', '{}', '["eletricidade","gas","dual"]', 1, 'energy_details', NULL, true, 'energy_sale_type'),
    (v_scope_id, 'entry_type', 'Tipo de Entrada', 'select', true, '', '{}', '["Alteracao de comercializadora","Alteracao de comercializadora com alteracao de titular","Entrada Direta"]', 2, 'energy_details', NULL, true, 'entry_type'),
    (v_scope_id, 'voltage_type', 'Tipo de Tensao', 'select', false, '', '{}', '["Monofasico","Trifasico"]', 3, 'energy_details', NULL, true, 'voltage_type'),
    (v_scope_id, 'cpe', 'CPE (PT0002...)', 'text', false, 'PT0002...', '{"pattern":"^PT0002"}', '[]', 4, 'energy_points', NULL, true, 'cpe'),
    (v_scope_id, 'power', 'Potencia', 'select', false, '', '{}', '["1.15kVA","2.3kVA","3.45kVA","4.6kVA","5.75kVA","6.9kVA","10.35kVA","13.8kVA","17.25kVA","20.7kVA","27.6kVA","34.5kVA","41.4kVA","Outros"]', 5, 'energy_points', NULL, true, 'power'),
    (v_scope_id, 'cui', 'CUI (PT16...)', 'text', false, 'PT16...', '{"pattern":"^PT16"}', '[]', 6, 'energy_points', NULL, true, 'cui'),
    (v_scope_id, 'tier', 'Escalao', 'select', false, '', '{}', '["T1","T2","T3","T4"]', 7, 'energy_points', NULL, true, 'tier'),
    (v_scope_id, 'additional_services', 'Servicos Adicionais', 'select', false, '', '{}', '[]', 8, 'additional', NULL, true, 'additional_services')
  ON CONFLICT (scope_id, field_key) DO NOTHING;
END $$;

-- Populate scope_fields for SOLAR
DO $$
DECLARE
  v_scope_id uuid;
BEGIN
  SELECT id INTO v_scope_id FROM scopes WHERE slug = 'solar';

  INSERT INTO scope_fields (scope_id, field_key, label, field_type, is_required, placeholder, validation_rules, options, sort_order, section, depends_on, is_system, maps_to_column) VALUES
    (v_scope_id, 'cpe', 'CPE (PT0002...)', 'text', true, 'PT0002...', '{"pattern":"^PT0002"}', '[]', 1, 'solar_details', NULL, true, 'cpe'),
    (v_scope_id, 'power', 'Potencia', 'select', true, '', '{}', '["1.15kVA","2.3kVA","3.45kVA","4.6kVA","5.75kVA","6.9kVA","10.35kVA","13.8kVA","17.25kVA","20.7kVA","27.6kVA","34.5kVA","41.4kVA","Outros"]', 2, 'solar_details', NULL, true, 'power')
  ON CONFLICT (scope_id, field_key) DO NOTHING;
END $$;

-- Populate scope_fields for MOBILIDADE ELETRICA
DO $$
DECLARE
  v_scope_id uuid;
BEGIN
  SELECT id INTO v_scope_id FROM scopes WHERE slug = 'mobilidade_eletrica';

  INSERT INTO scope_fields (scope_id, field_key, label, field_type, is_required, placeholder, validation_rules, options, sort_order, section, depends_on, is_system, maps_to_column) VALUES
    (v_scope_id, 'ev_outlet_count', 'Quantidade de Tomadas Instaladas', 'number', true, '1', '{"min_value":1}', '[]', 1, 'ev_details', NULL, true, 'ev_outlet_count'),
    (v_scope_id, 'ev_monthly_fee', 'Mensalidade Negociada (EUR)', 'number', true, '0.00', '{"min_value":0,"step":0.01}', '[]', 2, 'ev_details', NULL, true, 'ev_monthly_fee'),
    (v_scope_id, 'ev_margin', 'Margem Negociada (%)', 'number', false, '0.00', '{"min_value":0,"max_value":100,"step":0.01}', '[]', 3, 'ev_details', NULL, true, 'ev_margin'),
    (v_scope_id, 'ev_fidelization_months', 'Prazo de Fidelizacao (meses)', 'number', true, '12', '{"min_value":1}', '[]', 4, 'ev_details', NULL, true, 'ev_fidelization_months')
  ON CONFLICT (scope_id, field_key) DO NOTHING;
END $$;

-- Populate scope_email_fields for TELECOMUNICACOES
DO $$
DECLARE
  v_scope_id uuid;
BEGIN
  SELECT id INTO v_scope_id FROM scopes WHERE slug = 'telecomunicacoes';

  INSERT INTO scope_email_fields (scope_id, field_key, label, sort_order) VALUES
    (v_scope_id, 'client_contact', 'Contacto do Cliente', 1),
    (v_scope_id, 'client_email', 'Email do Cliente', 2),
    (v_scope_id, 'client_iban', 'IBAN do Cliente', 3),
    (v_scope_id, 'address', 'Morada', 4),
    (v_scope_id, 'installation_address', 'Morada de Instalacao', 5),
    (v_scope_id, 'autoriza_documentos', 'Autorizacao de Documentos', 6),
    (v_scope_id, 'service_type', 'Tipo de Servico', 7),
    (v_scope_id, 'activation_type', 'Tipo de Ativacao', 8),
    (v_scope_id, 'monthly_value', 'Mensalidade', 9),
    (v_scope_id, 'refid_fees', 'Mensalidades REFID', 10),
    (v_scope_id, 'services', 'Servicos (TV/NET/LR)', 11),
    (v_scope_id, 'mobile_lines', 'Linhas Moveis', 12),
    (v_scope_id, 'direct_debit', 'Debito Direto', 13),
    (v_scope_id, 'electronic_invoice', 'Fatura Eletronica', 14),
    (v_scope_id, 'observations', 'Observacoes', 15)
  ON CONFLICT (scope_id, field_key) DO NOTHING;
END $$;

-- Populate scope_email_fields for ENERGIA
DO $$
DECLARE
  v_scope_id uuid;
BEGIN
  SELECT id INTO v_scope_id FROM scopes WHERE slug = 'energia';

  INSERT INTO scope_email_fields (scope_id, field_key, label, sort_order) VALUES
    (v_scope_id, 'client_contact', 'Contacto do Cliente', 1),
    (v_scope_id, 'client_email', 'Email do Cliente', 2),
    (v_scope_id, 'client_iban', 'IBAN do Cliente', 3),
    (v_scope_id, 'address', 'Morada', 4),
    (v_scope_id, 'installation_address', 'Morada de Instalacao', 5),
    (v_scope_id, 'autoriza_documentos', 'Autorizacao de Documentos', 6),
    (v_scope_id, 'entry_type', 'Tipo de Entrada', 7),
    (v_scope_id, 'energy_sale_type', 'Tipo de Energia', 8),
    (v_scope_id, 'cpe_power', 'CPE / Potencia', 9),
    (v_scope_id, 'cui_tier', 'CUI / Escalao', 10),
    (v_scope_id, 'direct_debit', 'Debito Direto', 11),
    (v_scope_id, 'electronic_invoice', 'Fatura Eletronica', 12),
    (v_scope_id, 'observations', 'Observacoes', 13)
  ON CONFLICT (scope_id, field_key) DO NOTHING;
END $$;

-- Populate scope_email_fields for SOLAR
DO $$
DECLARE
  v_scope_id uuid;
BEGIN
  SELECT id INTO v_scope_id FROM scopes WHERE slug = 'solar';

  INSERT INTO scope_email_fields (scope_id, field_key, label, sort_order) VALUES
    (v_scope_id, 'client_contact', 'Contacto do Cliente', 1),
    (v_scope_id, 'client_email', 'Email do Cliente', 2),
    (v_scope_id, 'client_iban', 'IBAN do Cliente', 3),
    (v_scope_id, 'address', 'Morada', 4),
    (v_scope_id, 'installation_address', 'Morada de Instalacao', 5),
    (v_scope_id, 'autoriza_documentos', 'Autorizacao de Documentos', 6),
    (v_scope_id, 'cpe_power', 'CPE / Potencia', 7),
    (v_scope_id, 'observations', 'Observacoes', 8)
  ON CONFLICT (scope_id, field_key) DO NOTHING;
END $$;

-- Populate scope_email_fields for MOBILIDADE ELETRICA
DO $$
DECLARE
  v_scope_id uuid;
BEGIN
  SELECT id INTO v_scope_id FROM scopes WHERE slug = 'mobilidade_eletrica';

  INSERT INTO scope_email_fields (scope_id, field_key, label, sort_order) VALUES
    (v_scope_id, 'client_contact', 'Contacto do Cliente', 1),
    (v_scope_id, 'client_email', 'Email do Cliente', 2),
    (v_scope_id, 'address', 'Morada', 3),
    (v_scope_id, 'ev_outlet_count', 'Quantidade de Tomadas', 4),
    (v_scope_id, 'ev_monthly_fee', 'Mensalidade Negociada', 5),
    (v_scope_id, 'ev_margin', 'Margem Negociada', 6),
    (v_scope_id, 'ev_fidelization_months', 'Prazo de Fidelizacao', 7),
    (v_scope_id, 'observations', 'Observacoes', 8)
  ON CONFLICT (scope_id, field_key) DO NOTHING;
END $$;

-- Remove CHECK constraint on operators.scope to allow dynamic scopes
DO $$
BEGIN
  ALTER TABLE operators DROP CONSTRAINT IF EXISTS operators_scope_check;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Remove CHECK constraint on sales.scope to allow dynamic scopes
DO $$
BEGIN
  ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_scope_check;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Remove CHECK constraint on partners.partner_type to allow dynamic types
DO $$
BEGIN
  ALTER TABLE partners DROP CONSTRAINT IF EXISTS partners_partner_type_check;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Remove CHECK constraint on commission_configurations.partner_type
DO $$
BEGIN
  ALTER TABLE commission_configurations DROP CONSTRAINT IF EXISTS commission_configurations_partner_type_check;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scope_fields_scope_id ON scope_fields(scope_id);
CREATE INDEX IF NOT EXISTS idx_scope_fields_active ON scope_fields(scope_id, active);
CREATE INDEX IF NOT EXISTS idx_scope_email_fields_scope_id ON scope_email_fields(scope_id);
CREATE INDEX IF NOT EXISTS idx_partner_types_active ON partner_types(active);
CREATE INDEX IF NOT EXISTS idx_scopes_active ON scopes(active);
CREATE INDEX IF NOT EXISTS idx_sales_custom_fields ON sales USING gin(custom_fields);
