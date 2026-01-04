/*
  # Sistema de Vendas Multi-Ponto para Energia

  ## Descrição
  Adiciona suporte para vendas de energia com múltiplos CPE (Código do Ponto de Entrega) 
  e/ou CUI (Código Universal de Instalação). Cada venda pode ter vários pontos, cada um 
  com estado de ativação, data e informação de pagamento independentes.

  ## Alterações

  1. **Nova Tabela: sales_energy_points**
     - `id` (uuid, chave primária) - Identificador único
     - `sale_id` (uuid, foreign key) - Referência à venda
     - `point_type` (text) - Tipo: 'cpe' ou 'cui'
     - `point_code` (text) - Código do CPE ou CUI
     - `power_kva` (numeric) - Potência em kVA (apenas para CPE)
     - `tier` (text) - Escalão (apenas para CUI)
     - `activation_status` (text) - Estado: 'pending', 'active', 'cancelled', 'rejected'
     - `activation_date` (date) - Data de ativação
     - `operator_paid` (boolean) - Se é pago pelo operador
     - `created_at` (timestamptz) - Data de criação
     - `updated_at` (timestamptz) - Data de atualização

  2. **Alteração na tabela sales**
     - `is_multipoint` (boolean) - Flag para indicar se é venda multi-ponto
     - `multipoint_count` (integer) - Quantidade total de pontos

  3. **Segurança**
     - Políticas RLS para controlar acesso aos pontos de energia
     - Apenas utilizadores autorizados podem visualizar e editar

  4. **Triggers**
     - Atualizar contador de pontos automaticamente
     - Atualizar data de modificação

  ## Notas Importantes
     - Cada CPE/CUI conta como uma unidade para comissões e objetivos
     - Na exportação, cada ponto gera uma linha separada
     - Na listagem, aparece como venda única com informação agregada
*/

-- Criar tabela para pontos de energia (CPE/CUI)
CREATE TABLE IF NOT EXISTS sales_energy_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  point_type text NOT NULL CHECK (point_type IN ('cpe', 'cui')),
  point_code text NOT NULL,
  power_kva numeric(10,2),
  tier text,
  activation_status text NOT NULL DEFAULT 'pending' CHECK (activation_status IN ('pending', 'active', 'cancelled', 'rejected')),
  activation_date date,
  operator_paid boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Adicionar campos na tabela sales para multi-ponto
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'is_multipoint'
  ) THEN
    ALTER TABLE sales ADD COLUMN is_multipoint boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'multipoint_count'
  ) THEN
    ALTER TABLE sales ADD COLUMN multipoint_count integer DEFAULT 0;
  END IF;
END $$;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_sales_energy_points_sale_id ON sales_energy_points(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_energy_points_type ON sales_energy_points(point_type);
CREATE INDEX IF NOT EXISTS idx_sales_energy_points_status ON sales_energy_points(activation_status);
CREATE INDEX IF NOT EXISTS idx_sales_is_multipoint ON sales(is_multipoint);

-- Trigger para atualizar data de modificação
CREATE OR REPLACE FUNCTION update_sales_energy_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_sales_energy_points_updated_at ON sales_energy_points;
CREATE TRIGGER trigger_update_sales_energy_points_updated_at
  BEFORE UPDATE ON sales_energy_points
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_energy_points_updated_at();

-- Função para atualizar contador de pontos na venda
CREATE OR REPLACE FUNCTION update_sale_multipoint_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE sales
    SET 
      multipoint_count = (
        SELECT COUNT(*) 
        FROM sales_energy_points 
        WHERE sale_id = NEW.sale_id
      ),
      is_multipoint = (
        SELECT COUNT(*) > 1
        FROM sales_energy_points 
        WHERE sale_id = NEW.sale_id
      )
    WHERE id = NEW.sale_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE sales
    SET 
      multipoint_count = (
        SELECT COUNT(*) 
        FROM sales_energy_points 
        WHERE sale_id = OLD.sale_id
      ),
      is_multipoint = (
        SELECT COUNT(*) > 1
        FROM sales_energy_points 
        WHERE sale_id = OLD.sale_id
      )
    WHERE id = OLD.sale_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_sale_multipoint_count ON sales_energy_points;
CREATE TRIGGER trigger_update_sale_multipoint_count
  AFTER INSERT OR UPDATE OR DELETE ON sales_energy_points
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_multipoint_count();

-- Habilitar RLS
ALTER TABLE sales_energy_points ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: SELECT
CREATE POLICY "Users can view energy points of their sales"
  ON sales_energy_points
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sales_energy_points.sale_id
      AND (
        s.created_by_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'financial_manager', 'commercial_manager')
        )
      )
    )
  );

-- Políticas RLS: INSERT
CREATE POLICY "Users can insert energy points for their sales"
  ON sales_energy_points
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sales_energy_points.sale_id
      AND (
        s.created_by_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'financial_manager', 'commercial_manager')
        )
      )
    )
  );

-- Políticas RLS: UPDATE
CREATE POLICY "Users can update energy points of their sales"
  ON sales_energy_points
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sales_energy_points.sale_id
      AND (
        s.created_by_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'financial_manager', 'commercial_manager')
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sales_energy_points.sale_id
      AND (
        s.created_by_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'financial_manager', 'commercial_manager')
        )
      )
    )
  );

-- Políticas RLS: DELETE
CREATE POLICY "Users can delete energy points of their sales"
  ON sales_energy_points
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sales_energy_points.sale_id
      AND (
        s.created_by_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'financial_manager', 'commercial_manager')
        )
      )
    )
  );

-- Comentários nas tabelas e colunas
COMMENT ON TABLE sales_energy_points IS 'Pontos de energia (CPE/CUI) para vendas multi-ponto';
COMMENT ON COLUMN sales_energy_points.point_type IS 'Tipo de ponto: cpe ou cui';
COMMENT ON COLUMN sales_energy_points.point_code IS 'Código do CPE ou CUI';
COMMENT ON COLUMN sales_energy_points.power_kva IS 'Potência em kVA (apenas para CPE)';
COMMENT ON COLUMN sales_energy_points.tier IS 'Escalão de energia (apenas para CUI)';
COMMENT ON COLUMN sales_energy_points.activation_status IS 'Estado de ativação do ponto';
COMMENT ON COLUMN sales_energy_points.operator_paid IS 'Indica se o ponto é pago pelo operador';
COMMENT ON COLUMN sales.is_multipoint IS 'Indica se a venda tem múltiplos pontos de energia';
COMMENT ON COLUMN sales.multipoint_count IS 'Quantidade total de pontos de energia na venda';
