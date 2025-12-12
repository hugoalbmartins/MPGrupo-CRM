/*
  # Sistema de Autos de Comissão

  ## Resumo
  Cria sistema completo para gestão de autos de comissão emitidos para parceiros.

  ## Novas Tabelas
  
  ### `commission_reports`
  Tabela para armazenar informações sobre autos de comissão emitidos
  - `id` (uuid, primary key) - Identificador único
  - `partner_id` (uuid, foreign key) - Referência ao parceiro
  - `month` (integer) - Mês do auto (1-12)
  - `year` (integer) - Ano do auto
  - `version` (integer) - Versão do auto (incrementa se gerar novo auto do mesmo mês)
  - `file_name` (text) - Nome do ficheiro PDF
  - `file_path` (text) - Caminho no storage
  - `created_at` (timestamp) - Data de criação
  - `created_by` (uuid) - ID do utilizador que criou
  - `emailed_at` (timestamp nullable) - Data de envio do email

  ## Segurança
  - RLS ativado para proteger dados
  - Parceiros podem ver apenas seus próprios autos
  - Admins e BO podem ver e criar autos
  - Trigger para garantir apenas última versão

  ## Notas Importantes
  - Quando novo auto é criado para mesmo mês/ano/parceiro, versões antigas são eliminadas
  - Email é enviado automaticamente ao parceiro quando auto é emitido
  - Autos são armazenados no storage bucket 'commission-reports'
*/

-- Criar tabela de autos de comissão
CREATE TABLE IF NOT EXISTS commission_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL CHECK (year >= 2000 AND year <= 2100),
  version integer NOT NULL DEFAULT 1,
  file_name text NOT NULL,
  file_path text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL REFERENCES users(id),
  emailed_at timestamptz,
  
  UNIQUE(partner_id, month, year, version)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_commission_reports_partner ON commission_reports(partner_id);
CREATE INDEX IF NOT EXISTS idx_commission_reports_year ON commission_reports(year);
CREATE INDEX IF NOT EXISTS idx_commission_reports_created_at ON commission_reports(created_at DESC);

-- Ativar RLS
ALTER TABLE commission_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Parceiros podem ver apenas seus próprios autos
CREATE POLICY "Partners can view own commission reports"
  ON commission_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM partners
      WHERE partners.id = commission_reports.partner_id
      AND partners.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'bo')
    )
  );

-- Policy: Apenas admins e BO podem criar autos
CREATE POLICY "Admins and BO can create commission reports"
  ON commission_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'bo')
    )
  );

-- Policy: Apenas admins podem deletar autos (para cleanup de versões antigas)
CREATE POLICY "Admins can delete commission reports"
  ON commission_reports
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Função para limpar versões antigas quando nova é criada
CREATE OR REPLACE FUNCTION cleanup_old_commission_report_versions()
RETURNS TRIGGER AS $$
BEGIN
  -- Deletar versões antigas do mesmo mês/ano/parceiro
  DELETE FROM commission_reports
  WHERE partner_id = NEW.partner_id
    AND month = NEW.month
    AND year = NEW.year
    AND id != NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para executar cleanup após insert
DROP TRIGGER IF EXISTS trigger_cleanup_old_commission_reports ON commission_reports;
CREATE TRIGGER trigger_cleanup_old_commission_reports
  AFTER INSERT ON commission_reports
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_old_commission_report_versions();

-- Função para calcular próxima versão
CREATE OR REPLACE FUNCTION get_next_commission_report_version(
  p_partner_id uuid,
  p_month integer,
  p_year integer
)
RETURNS integer AS $$
DECLARE
  max_version integer;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1
  INTO max_version
  FROM commission_reports
  WHERE partner_id = p_partner_id
    AND month = p_month
    AND year = p_year;
  
  RETURN max_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
