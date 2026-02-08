/*
  # Complete Energy Simulator Schema
  
  Creates a comprehensive energy simulator system for comparing electricity and gas operators.
  
  ## New Tables
  
  ### `operadoras`
  - `id` (uuid, primary key)
  - `nome` (text) - Operator name
  - `logotipo_url` (text, nullable) - Logo URL from storage
  - `tipos_energia` (text[]) - Array with 'eletricidade', 'gas', or both
  - `ciclos_disponiveis` (text[]) - Array with 'simples', 'bi-horario', 'tri-horario'
  - `tarifas` (jsonb) - Tariff structure by cycle and energy type
  - `ativa` (boolean) - If operator is active
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  Tariff JSONB structure stores:
  - Power prices for 13 kVA levels: 1.15, 2.3, 3.45, 4.6, 5.75, 6.9, 10.35, 13.8, 17.25, 20.7, 27.6, 34.5, 41.4
  - Energy prices per cycle (simples/bi_horario/tri_horario)
  - Gas prices per tier (4 tiers)
  
  ### `configuracoes_descontos`
  - `id` (uuid, primary key)
  - `operadora_id` (uuid, FK to operadoras, UNIQUE)
  - `tipo_energia` (text) - 'eletricidade', 'gas', or 'dual'
  - Discount levels (4 types, all decimal 5,2):
    - Base (no DD, no FE): `desconto_base_potencia`, `desconto_base_energia`
    - DD only: `desconto_dd_potencia`, `desconto_dd_energia`
    - FE only: `desconto_fe_potencia`, `desconto_fe_energia`
    - DD+FE: `desconto_dd_fe_potencia`, `desconto_dd_fe_energia`
  - Temporary campaigns:
    - `desconto_mensal_temporario` (decimal) - Fixed monthly discount in EUR
    - `duracao_meses_desconto` (integer) - Campaign duration in months
    - `descricao_desconto_temporario` (text) - Campaign description
    - `desconto_temp_requer_dd` (boolean) - Requires direct debit
    - `desconto_temp_requer_fe` (boolean) - Requires electronic invoice
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ## Security
  - Enable RLS on both tables
  - Authenticated users can read
  - Only admin users (checked via email in auth.jwt()) can write
  
  ## Notes
  - One operator can have multiple discount records (one for electricity, one for gas)
  - All discount percentages are stored as decimal(5,2) for precision
  - JSONB tariffs allow flexible pricing structure
*/

-- Create operadoras table
CREATE TABLE IF NOT EXISTS operadoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  logotipo_url text,
  tipos_energia text[] NOT NULL DEFAULT '{}',
  ciclos_disponiveis text[] NOT NULL DEFAULT '{}',
  tarifas jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create configuracoes_descontos table
CREATE TABLE IF NOT EXISTS configuracoes_descontos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operadora_id uuid NOT NULL REFERENCES operadoras(id) ON DELETE CASCADE,
  tipo_energia text NOT NULL CHECK (tipo_energia IN ('eletricidade', 'gas', 'dual')),
  
  -- Base discounts (no DD, no FE)
  desconto_base_potencia decimal(5,2) DEFAULT 0,
  desconto_base_energia decimal(5,2) DEFAULT 0,
  
  -- DD discounts
  desconto_dd_potencia decimal(5,2) DEFAULT 0,
  desconto_dd_energia decimal(5,2) DEFAULT 0,
  
  -- FE discounts
  desconto_fe_potencia decimal(5,2) DEFAULT 0,
  desconto_fe_energia decimal(5,2) DEFAULT 0,
  
  -- DD + FE discounts
  desconto_dd_fe_potencia decimal(5,2) DEFAULT 0,
  desconto_dd_fe_energia decimal(5,2) DEFAULT 0,
  
  -- Temporary campaign
  desconto_mensal_temporario decimal(10,2) DEFAULT 0,
  duracao_meses_desconto integer DEFAULT 0,
  descricao_desconto_temporario text,
  desconto_temp_requer_dd boolean DEFAULT false,
  desconto_temp_requer_fe boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- One operator can have multiple discount configs (e.g., one for electricity, one for gas)
  UNIQUE(operadora_id, tipo_energia)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_operadoras_ativa ON operadoras(ativa);
CREATE INDEX IF NOT EXISTS idx_operadoras_tipos_energia ON operadoras USING gin(tipos_energia);
CREATE INDEX IF NOT EXISTS idx_configuracoes_descontos_operadora ON configuracoes_descontos(operadora_id);
CREATE INDEX IF NOT EXISTS idx_configuracoes_descontos_tipo_energia ON configuracoes_descontos(tipo_energia);

-- Enable RLS
ALTER TABLE operadoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes_descontos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for operadoras
-- Anyone authenticated can read active operators
CREATE POLICY "Authenticated users can read operators"
  ON operadoras
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admin can insert operators
CREATE POLICY "Only admin can insert operators"
  ON operadoras
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'email') IN (
      SELECT email FROM users WHERE role = 'admin'
    )
  );

-- Only admin can update operators
CREATE POLICY "Only admin can update operators"
  ON operadoras
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN (
      SELECT email FROM users WHERE role = 'admin'
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') IN (
      SELECT email FROM users WHERE role = 'admin'
    )
  );

-- Only admin can delete operators
CREATE POLICY "Only admin can delete operators"
  ON operadoras
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN (
      SELECT email FROM users WHERE role = 'admin'
    )
  );

-- RLS Policies for configuracoes_descontos
-- Anyone authenticated can read discounts
CREATE POLICY "Authenticated users can read discounts"
  ON configuracoes_descontos
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admin can insert discounts
CREATE POLICY "Only admin can insert discounts"
  ON configuracoes_descontos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'email') IN (
      SELECT email FROM users WHERE role = 'admin'
    )
  );

-- Only admin can update discounts
CREATE POLICY "Only admin can update discounts"
  ON configuracoes_descontos
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN (
      SELECT email FROM users WHERE role = 'admin'
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') IN (
      SELECT email FROM users WHERE role = 'admin'
    )
  );

-- Only admin can delete discounts
CREATE POLICY "Only admin can delete discounts"
  ON configuracoes_descontos
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') IN (
      SELECT email FROM users WHERE role = 'admin'
    )
  );

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_operadoras_updated_at ON operadoras;
CREATE TRIGGER update_operadoras_updated_at
  BEFORE UPDATE ON operadoras
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_configuracoes_descontos_updated_at ON configuracoes_descontos;
CREATE TRIGGER update_configuracoes_descontos_updated_at
  BEFORE UPDATE ON configuracoes_descontos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();