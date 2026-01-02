/*
  # Add Manager Roles and Email Validation

  ## Changes
  
  1. New User Roles
    - Add "gestor_nv1" role - Access to all partner commissions, can register sales and attach forms
    - Add "gestor_nv2" role - Access to assigned partner commissions only, can register sales in "Para registo" state
  
  2. Partner Management
    - Add `manager_id` field to partners table to assign a manager (gestor_nv1 or gestor_nv2)
    
  3. Sales State
    - Add "Para registo" state for sales created by gestor_nv2
    
  4. Email Validation
    - Add check constraint to ensure admin, bo, gestor_nv1, and gestor_nv2 users have @mpgrupo.pt or @marciopinto.pt email
    
  5. Security
    - Update RLS policies to support new roles
    - Managers can view sales but not edit
    - Gestor_nv2 can only see their assigned partners
*/

-- Add manager_id to partners table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'manager_id'
  ) THEN
    ALTER TABLE partners ADD COLUMN manager_id uuid REFERENCES users(id);
  END IF;
END $$;

-- Create index on manager_id
CREATE INDEX IF NOT EXISTS idx_partners_manager_id ON partners(manager_id);

-- Update users role check constraint to include new roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'bo', 'partner', 'commercial', 'gestor_nv1', 'gestor_nv2'));

-- Add email validation function
CREATE OR REPLACE FUNCTION validate_user_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IN ('admin', 'bo', 'gestor_nv1', 'gestor_nv2') THEN
    IF NOT (NEW.email LIKE '%@mpgrupo.pt' OR NEW.email LIKE '%@marciopinto.pt') THEN
      RAISE EXCEPTION 'Users with role admin, bo, gestor_nv1 or gestor_nv2 must have email ending in @mpgrupo.pt or @marciopinto.pt';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for email validation on INSERT
DROP TRIGGER IF EXISTS validate_user_email_insert_trigger ON users;
CREATE TRIGGER validate_user_email_insert_trigger
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_email();

-- Create trigger for email validation on UPDATE (only when email or role changes)
DROP TRIGGER IF EXISTS validate_user_email_update_trigger ON users;
CREATE TRIGGER validate_user_email_update_trigger
  BEFORE UPDATE OF email, role ON users
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email OR NEW.role IS DISTINCT FROM OLD.role)
  EXECUTE FUNCTION validate_user_email();

-- Update sales status check to include "Para registo"
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE sales ADD CONSTRAINT sales_status_check 
  CHECK (status IN ('Pendente', 'Ativo', 'Cancelado', 'Suspenso', 'Para registo'));

-- RLS Policies for new manager roles

-- Gestor Nv1: Can view all sales but not edit
CREATE POLICY "Gestor Nv1 can view all sales"
  ON sales FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'gestor_nv1'
    )
  );

-- Gestor Nv2: Can view sales from assigned partners only
CREATE POLICY "Gestor Nv2 can view assigned partner sales"
  ON sales FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      JOIN partners ON partners.manager_id = users.id
      WHERE users.id = auth.uid()
      AND users.role = 'gestor_nv2'
      AND sales.partner_id = partners.id
    )
  );

-- Gestor Nv1: Can insert sales
CREATE POLICY "Gestor Nv1 can insert sales"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'gestor_nv1'
    )
  );

-- Gestor Nv2: Can insert sales (will be in "Para registo" state)
CREATE POLICY "Gestor Nv2 can insert sales"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'gestor_nv2'
    )
    AND status = 'Para registo'
  );

-- Partners table: Gestor Nv1 can view all partners
CREATE POLICY "Gestor Nv1 can view all partners"
  ON partners FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'gestor_nv1'
    )
  );

-- Partners table: Gestor Nv2 can view assigned partners only
CREATE POLICY "Gestor Nv2 can view assigned partners"
  ON partners FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'gestor_nv2'
      AND partners.manager_id = auth.uid()
    )
  );

-- Commission reports: Gestor Nv1 can view all
CREATE POLICY "Gestor Nv1 can view all commission reports"
  ON commission_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'gestor_nv1'
    )
  );

-- Commission reports: Gestor Nv2 can view assigned partners only
CREATE POLICY "Gestor Nv2 can view assigned partner commission reports"
  ON commission_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      JOIN partners ON partners.manager_id = users.id
      WHERE users.id = auth.uid()
      AND users.role = 'gestor_nv2'
      AND commission_reports.partner_id = partners.id
    )
  );

-- Operators: Managers can view but not modify
CREATE POLICY "Managers can view operators"
  ON operators FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('gestor_nv1', 'gestor_nv2')
    )
  );

-- Alerts: Managers receive alerts
CREATE POLICY "Gestor Nv1 can view all alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'gestor_nv1'
    )
  );

CREATE POLICY "Gestor Nv2 can view assigned partner alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      JOIN partners ON partners.manager_id = users.id
      JOIN sales ON sales.partner_id = partners.id
      WHERE users.id = auth.uid()
      AND users.role = 'gestor_nv2'
      AND alerts.sale_id = sales.id
    )
    OR (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'gestor_nv2'
      )
      AND type IN ('new_sale', 'sale_status_change', 'operator_validation_pending')
    )
  );