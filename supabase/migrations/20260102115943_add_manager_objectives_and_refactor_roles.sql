/*
  # Refatoração de Gestores e Sistema de Objetivos

  1. Alterações em Users
    - Remove papel gestor_nv2 do check constraint
    - Adiciona campo `commission_type` para gestores (D2D, Rev, Rev+)
    - Adiciona campo `manager_id` para atribuir parceiros a gestores
  
  2. Nova Tabela: manager_objectives
    - `id` (uuid, primary key)
    - `manager_id` (uuid, foreign key to users)
    - `operator_id` (uuid, foreign key to operators)
    - `month` (integer, 1-12)
    - `year` (integer)
    - `electricity_target` (integer, default 0)
    - `gas_target` (integer, default 0)
    - `tv_target` (integer, default 0)
    - `fiber_target` (integer, default 0)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
  
  3. Alterações em Sales (telecomunicações)
    - Adiciona `has_tv` (boolean, default false)
    - Adiciona `has_net` (boolean, default false)
    - Adiciona `has_lr` (boolean, default false)
    - Adiciona `mobile_count` (integer, default 0)
  
  4. Security
    - RLS policies para manager_objectives
    - Atualização de policies existentes
*/

-- Add commission_type to users table for managers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'commission_type'
  ) THEN
    ALTER TABLE users ADD COLUMN commission_type text CHECK (commission_type IN ('D2D', 'Rev', 'Rev+'));
    COMMENT ON COLUMN users.commission_type IS 'Tipo de comissão para gestores: D2D, Rev, Rev+';
  END IF;
END $$;

-- Add manager_id to users table to assign partners to managers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'manager_id'
  ) THEN
    ALTER TABLE users ADD COLUMN manager_id uuid REFERENCES users(id);
    COMMENT ON COLUMN users.manager_id IS 'ID do gestor responsável pelo parceiro';
  END IF;
END $$;

-- Update role check constraint to support only gestor_nv1 (removing gestor_nv2)
DO $$
BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('admin', 'bo', 'partner', 'commercial', 'partner_commercial', 'gestor_nv1'));
END $$;

-- Create manager_objectives table
CREATE TABLE IF NOT EXISTS manager_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL CHECK (year >= 2020 AND year <= 2100),
  electricity_target integer DEFAULT 0 NOT NULL CHECK (electricity_target >= 0),
  gas_target integer DEFAULT 0 NOT NULL CHECK (gas_target >= 0),
  tv_target integer DEFAULT 0 NOT NULL CHECK (tv_target >= 0),
  fiber_target integer DEFAULT 0 NOT NULL CHECK (fiber_target >= 0),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(manager_id, operator_id, month, year)
);

COMMENT ON TABLE manager_objectives IS 'Objetivos mensais para gestores nível 1';
COMMENT ON COLUMN manager_objectives.electricity_target IS 'Objetivo de vendas de eletricidade';
COMMENT ON COLUMN manager_objectives.gas_target IS 'Objetivo de vendas de gás';
COMMENT ON COLUMN manager_objectives.tv_target IS 'Objetivo de adesões a TV (telecomunicações)';
COMMENT ON COLUMN manager_objectives.fiber_target IS 'Objetivo de adesões a fibra/LR (telecomunicações)';

-- Add telecom service fields to sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'has_tv'
  ) THEN
    ALTER TABLE sales ADD COLUMN has_tv boolean DEFAULT false NOT NULL;
    COMMENT ON COLUMN sales.has_tv IS 'Cliente aderiu a serviço de TV';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'has_net'
  ) THEN
    ALTER TABLE sales ADD COLUMN has_net boolean DEFAULT false NOT NULL;
    COMMENT ON COLUMN sales.has_net IS 'Cliente aderiu a serviço de NET/Internet/Fibra';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'has_lr'
  ) THEN
    ALTER TABLE sales ADD COLUMN has_lr boolean DEFAULT false NOT NULL;
    COMMENT ON COLUMN sales.has_lr IS 'Cliente aderiu a linha fixa/LR';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'mobile_count'
  ) THEN
    ALTER TABLE sales ADD COLUMN mobile_count integer DEFAULT 0 NOT NULL CHECK (mobile_count >= 0);
    COMMENT ON COLUMN sales.mobile_count IS 'Número de linhas móveis contratadas';
  END IF;
END $$;

-- Enable RLS on manager_objectives
ALTER TABLE manager_objectives ENABLE ROW LEVEL SECURITY;

-- RLS Policies for manager_objectives

-- Admins can do everything
CREATE POLICY "Admins can manage all objectives"
  ON manager_objectives
  FOR ALL
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

-- Managers can view their own objectives
CREATE POLICY "Managers can view own objectives"
  ON manager_objectives
  FOR SELECT
  TO authenticated
  USING (
    manager_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'bo')
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_manager_objectives_manager ON manager_objectives(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_objectives_period ON manager_objectives(year, month);
CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_manager_objectives_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_manager_objectives_updated_at ON manager_objectives;
CREATE TRIGGER trigger_update_manager_objectives_updated_at
  BEFORE UPDATE ON manager_objectives
  FOR EACH ROW
  EXECUTE FUNCTION update_manager_objectives_updated_at();
