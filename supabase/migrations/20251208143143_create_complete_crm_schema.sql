/*
  # MP Grupo CRM - Complete Database Schema

  ## New Tables
  - users: User profiles with roles (admin, bo, partner, partner_commercial)
  - partners: Partner companies with contact info and documents
  - operators: Telecom/Energy operators with commission configuration
  - sales: Sales records with commission tracking
  - alerts: Notification system for sales changes
  - forms: Form submissions from partners

  ## Security
  - RLS enabled on all tables
  - Role-based policies for data access
*/

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'bo', 'partner', 'partner_commercial')),
  position text NOT NULL,
  partner_id uuid,
  must_change_password boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can view all users" ON users FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
);
CREATE POLICY "Admins can manage users" ON users FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Partners table
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_code text UNIQUE NOT NULL,
  partner_type text NOT NULL CHECK (partner_type IN ('D2D', 'Rev', 'Rev+')),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  communication_emails text[] DEFAULT '{}',
  phone text NOT NULL,
  contact_person text NOT NULL,
  street text NOT NULL,
  door_number text NOT NULL,
  postal_code text NOT NULL,
  locality text NOT NULL,
  nif text NOT NULL,
  crc text,
  documents jsonb DEFAULT '[]',
  user_id uuid,
  initial_password text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and BO view partners" ON partners FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo'))
);
CREATE POLICY "Partners view own" ON partners FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage partners" ON partners FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
);

-- Operators table
CREATE TABLE IF NOT EXISTS operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('telecomunicacoes', 'energia', 'solar', 'dual')),
  energy_type text CHECK (energy_type IN ('eletricidade', 'gas', 'dual')),
  active boolean DEFAULT true,
  hidden boolean DEFAULT false,
  commission_config jsonb DEFAULT '{}',
  documents jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE operators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated view active operators" ON operators FOR SELECT TO authenticated USING (
  active = true OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo'))
);
CREATE POLICY "Admins manage operators" ON operators FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
);
CREATE POLICY "BO update operators" ON operators FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo'))
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_code text UNIQUE NOT NULL,
  sale_date date NOT NULL,
  partner_id uuid NOT NULL REFERENCES partners(id),
  partner_name text NOT NULL,
  created_by_user_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('telecomunicacoes', 'energia', 'solar', 'dual')),
  customer_type text NOT NULL CHECK (customer_type IN ('particular', 'empresarial')),
  customer_name text NOT NULL,
  nif text NOT NULL,
  contact text NOT NULL,
  operator_id uuid NOT NULL REFERENCES operators(id),
  operator_name text NOT NULL,
  status text NOT NULL DEFAULT 'Pendente',
  request_number text,
  monthly_value numeric(10, 2),
  commission_value numeric(10, 2),
  calculated_commission numeric(10, 2) DEFAULT 0,
  paid_to_operator boolean DEFAULT false,
  payment_date date,
  notes jsonb DEFAULT '[]',
  cpe text,
  cui text,
  street text,
  door_number text,
  postal_code text,
  locality text,
  province text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all sales" ON sales FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin')
);
CREATE POLICY "BO view all sales" ON sales FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'bo')
);
CREATE POLICY "Partners view own sales" ON sales FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users u JOIN partners p ON u.partner_id = p.id WHERE u.id = auth.uid() AND u.role = 'partner' AND sales.partner_id = p.id)
);
CREATE POLICY "Commercials view created sales" ON sales FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'partner_commercial' AND sales.created_by_user_id = u.id)
);
CREATE POLICY "Admins and BO create sales" ON sales FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo'))
);
CREATE POLICY "Partners create sales" ON sales FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM users u JOIN partners p ON u.partner_id = p.id WHERE u.id = auth.uid() AND u.role IN ('partner', 'partner_commercial') AND sales.partner_id = p.id)
);
CREATE POLICY "Admins and BO update sales" ON sales FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo'))
);
CREATE POLICY "Partners add notes" ON sales FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM users u JOIN partners p ON u.partner_id = p.id WHERE u.id = auth.uid() AND u.role = 'partner' AND sales.partner_id = p.id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM users u JOIN partners p ON u.partner_id = p.id WHERE u.id = auth.uid() AND u.role = 'partner' AND sales.partner_id = p.id)
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('new_sale', 'status_change', 'note_added')),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  sale_code text NOT NULL,
  message text NOT NULL,
  user_ids uuid[] NOT NULL DEFAULT '{}',
  read_by uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL,
  created_by_name text NOT NULL
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own alerts" ON alerts FOR SELECT TO authenticated USING (auth.uid() = ANY(user_ids));
CREATE POLICY "Users mark alerts read" ON alerts FOR UPDATE TO authenticated USING (auth.uid() = ANY(user_ids)) WITH CHECK (auth.uid() = ANY(user_ids));
CREATE POLICY "Users create alerts" ON alerts FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

-- Forms table
CREATE TABLE IF NOT EXISTS forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id),
  partner_name text NOT NULL,
  form_type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  pdf_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and BO view forms" ON forms FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo'))
);
CREATE POLICY "Partners view own forms" ON forms FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM users u JOIN partners p ON u.partner_id = p.id WHERE u.id = auth.uid() AND forms.partner_id = p.id)
);
CREATE POLICY "Partners create forms" ON forms FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM users u JOIN partners p ON u.partner_id = p.id WHERE u.id = auth.uid() AND forms.partner_id = p.id)
);
CREATE POLICY "Admins and BO update forms" ON forms FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_partners_code ON partners(partner_code);
CREATE INDEX IF NOT EXISTS idx_partners_user_id ON partners(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_partner ON sales(partner_id);
CREATE INDEX IF NOT EXISTS idx_sales_operator ON sales(operator_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_creator ON sales(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_users ON alerts USING gin(user_ids);
CREATE INDEX IF NOT EXISTS idx_forms_partner ON forms(partner_id);
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status);

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER forms_updated_at BEFORE UPDATE ON forms FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Insert admin user
INSERT INTO users (id, name, email, role, position, must_change_password)
VALUES (
  '8629ca66-a8c7-4fa3-8fad-dbd0cb5d7ed2'::uuid,
  'Hugo Martins',
  'hugo.martins@marciopinto.pt',
  'admin',
  'Administrador do Sistema',
  false
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = 'admin',
  must_change_password = false;