/*
  # MP Grupo CRM - Complete Database Schema

  ## Overview
  Complete database schema for a CRM system managing partners, sales, and commissions.

  ## New Tables
  
  ### 1. users
  - `id` (uuid, primary key)
  - `name` (text) - User's full name
  - `email` (text, unique) - User email for authentication
  - `role` (text) - User role: admin, bo (backoffice), partner, partner_commercial
  - `position` (text) - Job position
  - `partner_id` (uuid, nullable) - Reference to partner if user is partner/partner_commercial
  - `must_change_password` (boolean) - Force password change on first login
  - `created_at` (timestamptz) - Account creation timestamp

  ### 2. partners
  - `id` (uuid, primary key)
  - `partner_code` (text, unique) - Auto-generated code (D2D1001, Rev1001, etc)
  - `partner_type` (text) - Type: D2D, Rev, Rev+
  - `name` (text) - Partner name
  - `email` (text, unique) - Partner email
  - `communication_emails` (text[]) - Additional emails for communication
  - `phone` (text) - Contact phone
  - `contact_person` (text) - Contact person name
  - `street` (text) - Street address
  - `door_number` (text) - Door/building number
  - `postal_code` (text) - Postal code
  - `locality` (text) - City/locality
  - `nif` (text) - Tax ID
  - `crc` (text, nullable) - CRC validation code
  - `documents` (jsonb) - Uploaded documents metadata
  - `user_id` (uuid, nullable) - Associated user account
  - `initial_password` (text, nullable) - Initial password for first login
  - `created_at` (timestamptz)

  ### 3. operators
  - `id` (uuid, primary key)
  - `name` (text) - Operator name (Vodafone, MEO, NOS, etc)
  - `scope` (text) - telecomunicacoes, energia, solar, dual
  - `energy_type` (text, nullable) - eletricidade, gas, dual (for energia scope)
  - `active` (boolean) - Active status
  - `hidden` (boolean) - Hide from forms
  - `commission_config` (jsonb) - Commission tiers configuration per customer type
  - `documents` (jsonb) - Uploaded documents metadata
  - `created_at` (timestamptz)

  ### 4. sales
  - `id` (uuid, primary key)
  - `sale_code` (text, unique) - Auto-generated code (ALB000111)
  - `sale_date` (date) - Date of sale
  - `partner_id` (uuid) - Reference to partner
  - `partner_name` (text) - Partner name (denormalized)
  - `created_by_user_id` (uuid) - User who created the sale
  - `scope` (text) - telecomunicacoes, energia, solar, dual
  - `customer_type` (text) - particular, empresarial
  - `customer_name` (text) - Customer name
  - `nif` (text) - Customer tax ID
  - `contact` (text) - Customer contact
  - `operator_id` (uuid) - Reference to operator
  - `operator_name` (text) - Operator name (denormalized)
  - `status` (text) - Ativo, Pendente, Cancelado, etc
  - `request_number` (text, nullable) - Request/order number
  - `monthly_value` (decimal, nullable) - Monthly value (telecomunicacoes)
  - `commission_value` (decimal, nullable) - Fixed commission (energia/solar)
  - `calculated_commission` (decimal) - Final calculated commission with tiers
  - `paid_to_operator` (boolean) - Payment status to operator
  - `payment_date` (date, nullable) - Date of payment
  - `notes` (jsonb) - Array of notes with timestamps
  - Additional fields for different scopes (cpe, cui, address fields, etc)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 5. alerts
  - `id` (uuid, primary key)
  - `type` (text) - new_sale, status_change, note_added
  - `sale_id` (uuid) - Reference to sale
  - `sale_code` (text) - Sale code for display
  - `message` (text) - Alert message
  - `user_ids` (uuid[]) - Users who should see this alert
  - `read_by` (uuid[]) - Users who have read this alert
  - `created_at` (timestamptz)
  - `created_by` (uuid) - User who created the alert
  - `created_by_name` (text) - Creator name for display

  ### 6. forms
  - `id` (uuid, primary key)
  - `partner_id` (uuid) - Partner who submitted the form
  - `partner_name` (text) - Partner name
  - `form_type` (text) - Type of form submitted
  - `data` (jsonb) - Form data
  - `status` (text) - pending, approved, rejected
  - `pdf_url` (text, nullable) - URL to uploaded PDF
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Create policies based on user roles (admin, bo, partner, partner_commercial)
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'bo', 'partner', 'partner_commercial')),
  position text NOT NULL,
  partner_id uuid,
  must_change_password boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can create users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Create partners table
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

-- Partners policies
CREATE POLICY "Admins and BO can view all partners"
  ON partners FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo')
    )
  );

CREATE POLICY "Partners can view their own profile"
  ON partners FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage partners"
  ON partners FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Create operators table
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

-- Operators policies
CREATE POLICY "Authenticated users can view active operators"
  ON operators FOR SELECT
  TO authenticated
  USING (active = true OR EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo')
  ));

CREATE POLICY "Admins can manage operators"
  ON operators FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "BO can update operator status"
  ON operators FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo')
    )
  );

-- Create sales table
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
  monthly_value decimal(10, 2),
  commission_value decimal(10, 2),
  calculated_commission decimal(10, 2) DEFAULT 0,
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

-- Sales policies
CREATE POLICY "Admins can view all sales"
  ON sales FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "BO can view all sales"
  ON sales FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'bo'
    )
  );

CREATE POLICY "Partners can view their own sales"
  ON sales FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN partners p ON u.partner_id = p.id
      WHERE u.id = auth.uid() AND u.role = 'partner' AND sales.partner_id = p.id
    )
  );

CREATE POLICY "Partner commercials can view their created sales"
  ON sales FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'partner_commercial' AND sales.created_by_user_id = u.id
    )
  );

CREATE POLICY "Admins and BO can create sales"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo')
    )
  );

CREATE POLICY "Partners and commercials can create sales for their partner"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN partners p ON u.partner_id = p.id
      WHERE u.id = auth.uid() 
      AND u.role IN ('partner', 'partner_commercial') 
      AND sales.partner_id = p.id
    )
  );

CREATE POLICY "Admins and BO can update sales"
  ON sales FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo')
    )
  );

CREATE POLICY "Partners can add notes to their sales"
  ON sales FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN partners p ON u.partner_id = p.id
      WHERE u.id = auth.uid() AND u.role = 'partner' AND sales.partner_id = p.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN partners p ON u.partner_id = p.id
      WHERE u.id = auth.uid() AND u.role = 'partner' AND sales.partner_id = p.id
    )
  );

-- Create alerts table
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

-- Alerts policies
CREATE POLICY "Users can view their own alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (auth.uid() = ANY(user_ids));

CREATE POLICY "Users can mark alerts as read"
  ON alerts FOR UPDATE
  TO authenticated
  USING (auth.uid() = ANY(user_ids))
  WITH CHECK (auth.uid() = ANY(user_ids));

CREATE POLICY "Authenticated users can create alerts"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Create forms table
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

-- Forms policies
CREATE POLICY "Admins and BO can view all forms"
  ON forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo')
    )
  );

CREATE POLICY "Partners can view their own forms"
  ON forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN partners p ON u.partner_id = p.id
      WHERE u.id = auth.uid() AND forms.partner_id = p.id
    )
  );

CREATE POLICY "Partners can create their own forms"
  ON forms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN partners p ON u.partner_id = p.id
      WHERE u.id = auth.uid() AND forms.partner_id = p.id
    )
  );

CREATE POLICY "Admins and BO can update forms"
  ON forms FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'bo')
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_partners_partner_code ON partners(partner_code);
CREATE INDEX IF NOT EXISTS idx_partners_user_id ON partners(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_partner_id ON sales(partner_id);
CREATE INDEX IF NOT EXISTS idx_sales_operator_id ON sales(operator_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON sales(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_ids ON alerts USING gin(user_ids);
CREATE INDEX IF NOT EXISTS idx_forms_partner_id ON forms(partner_id);
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to sales table
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to forms table
CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON forms
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();