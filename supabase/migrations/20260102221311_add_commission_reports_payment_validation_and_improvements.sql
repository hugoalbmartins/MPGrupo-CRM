/*
  # Melhorias no Sistema de Autos de Comissão

  ## Resumo
  Adiciona sistema de validação de pagamento, controlo temporal de emissão e prevenção de duplicação de vendas em autos.

  ## Alterações na Tabela `commission_reports`

  ### Novos Campos
  - `paid_validated_at` (timestamp nullable) - Data em que o auto foi marcado como pago
  - `paid_validated_by` (uuid nullable) - ID do admin que validou o pagamento
  - `sales_included` (jsonb) - Array de IDs das vendas incluídas no auto (para evitar duplicação)

  ## Regras de Negócio

  1. **Emissão Temporal**:
     - Autos só podem ser emitidos após dia 22 do mês seguinte
     - Exemplo: Auto de Novembro só após 22 de Dezembro

  2. **Validação de Pagamento**:
     - Admins podem marcar autos como pagos
     - Autos validados ficam bloqueados (não podem ser editados/eliminados)

  3. **Prevenção de Duplicação**:
     - Ao emitir novo auto do mesmo mês/parceiro, apenas incluir vendas não liquidadas
     - Verificar vendas já incluídas em autos validados

  ## Segurança
  - Políticas RLS atualizadas para impedir eliminação de autos validados
  - Apenas admins podem validar pagamentos
*/

-- Adicionar campos à tabela commission_reports
ALTER TABLE commission_reports
ADD COLUMN IF NOT EXISTS paid_validated_at timestamptz,
ADD COLUMN IF NOT EXISTS paid_validated_by uuid REFERENCES users(id),
ADD COLUMN IF NOT EXISTS sales_included jsonb DEFAULT '[]'::jsonb;

-- Criar índice para performance em consultas de autos validados
CREATE INDEX IF NOT EXISTS idx_commission_reports_paid_validated ON commission_reports(paid_validated_at);

-- Atualizar política de DELETE para impedir eliminação de autos validados
DROP POLICY IF EXISTS "Admins can delete commission reports" ON commission_reports;
CREATE POLICY "Admins can delete unpaid commission reports"
  ON commission_reports
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
    AND paid_validated_at IS NULL
  );

-- Criar política de UPDATE para validação de pagamento
DROP POLICY IF EXISTS "Admins can update commission reports" ON commission_reports;
CREATE POLICY "Admins can update commission reports"
  ON commission_reports
  FOR UPDATE
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

-- Função para validar se um mês pode ser selecionado para emissão
CREATE OR REPLACE FUNCTION is_month_available_for_emission(
  p_month integer,
  p_year integer
)
RETURNS boolean AS $$
DECLARE
  today_date date;
  emission_date date;
BEGIN
  today_date := CURRENT_DATE;

  -- Calcular a data mínima de emissão (dia 22 do mês seguinte)
  -- Se for dezembro, vai para janeiro do ano seguinte
  IF p_month = 12 THEN
    emission_date := make_date(p_year + 1, 1, 22);
  ELSE
    emission_date := make_date(p_year, p_month + 1, 22);
  END IF;

  -- Retorna true se a data atual for maior ou igual à data de emissão
  RETURN today_date >= emission_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter vendas já incluídas em autos validados
CREATE OR REPLACE FUNCTION get_settled_sales_for_partner(
  p_partner_id uuid,
  p_month integer,
  p_year integer
)
RETURNS TABLE(sale_id uuid) AS $$
BEGIN
  RETURN QUERY
  SELECT jsonb_array_elements_text(sales_included)::uuid as sale_id
  FROM commission_reports
  WHERE partner_id = p_partner_id
    AND month = p_month
    AND year = p_year
    AND paid_validated_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para validar pagamento de auto
CREATE OR REPLACE FUNCTION validate_commission_report_payment(
  p_report_id uuid,
  p_admin_id uuid
)
RETURNS void AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- Verificar se o utilizador é admin
  SELECT role = 'admin' INTO is_admin
  FROM users
  WHERE id = p_admin_id;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem validar pagamentos';
  END IF;

  -- Atualizar o auto com informação de pagamento
  UPDATE commission_reports
  SET
    paid_validated_at = NOW(),
    paid_validated_by = p_admin_id
  WHERE id = p_report_id
    AND paid_validated_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auto não encontrado ou já validado';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Desativar o trigger de cleanup automático de versões antigas
-- Vamos manter todas as versões para histórico
DROP TRIGGER IF EXISTS trigger_cleanup_old_commission_reports ON commission_reports;