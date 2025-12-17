/*
  # Adicionar Validação de Autos pela Operadora

  1. Alterações na Tabela `sales`
    - `operator_doc_file` (text, nullable) - Caminho do ficheiro do auto da operadora
    - `operator_doc_uploaded_at` (timestamp, nullable) - Data de upload do documento
    - `operator_doc_uploaded_by` (uuid, nullable) - ID do utilizador que fez upload
    - `operator_validated` (boolean, default false) - Se a venda foi validada pela operadora
    - `operator_validation_date` (timestamp, nullable) - Data da validação

  2. Índices
    - Adicionar índice em `operator_validated` para queries rápidas

  3. Storage Bucket
    - Criar bucket para armazenar documentos de validação da operadora

  4. Políticas RLS
    - Admins e BO podem fazer upload e visualizar documentos
    - Parceiros só podem visualizar documentos das suas vendas
*/

-- Adicionar campos à tabela sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'operator_doc_file'
  ) THEN
    ALTER TABLE sales ADD COLUMN operator_doc_file text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'operator_doc_uploaded_at'
  ) THEN
    ALTER TABLE sales ADD COLUMN operator_doc_uploaded_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'operator_doc_uploaded_by'
  ) THEN
    ALTER TABLE sales ADD COLUMN operator_doc_uploaded_by uuid REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'operator_validated'
  ) THEN
    ALTER TABLE sales ADD COLUMN operator_validated boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'operator_validation_date'
  ) THEN
    ALTER TABLE sales ADD COLUMN operator_validation_date timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_operator_validated ON sales(operator_validated);

INSERT INTO storage.buckets (id, name, public)
VALUES ('operator-validations', 'operator-validations', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admin e BO podem fazer upload de documentos de validação" ON storage.objects;
CREATE POLICY "Admin e BO podem fazer upload de documentos de validação"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'operator-validations' AND
  (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'bo')
    )
  )
);

DROP POLICY IF EXISTS "Admin e BO podem atualizar documentos de validação" ON storage.objects;
CREATE POLICY "Admin e BO podem atualizar documentos de validação"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'operator-validations' AND
  (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'bo')
    )
  )
);

DROP POLICY IF EXISTS "Utilizadores podem ver documentos de validação" ON storage.objects;
CREATE POLICY "Utilizadores podem ver documentos de validação"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'operator-validations' AND
  (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'bo', 'partner', 'partner_commercial')
    )
  )
);

DROP POLICY IF EXISTS "Admin e BO podem eliminar documentos de validação" ON storage.objects;
CREATE POLICY "Admin e BO podem eliminar documentos de validação"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'operator-validations' AND
  (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'bo')
    )
  )
);

COMMENT ON COLUMN sales.operator_doc_file IS 'Caminho do ficheiro do auto/documento de validação da operadora';
COMMENT ON COLUMN sales.operator_doc_uploaded_at IS 'Data e hora de upload do documento da operadora';
COMMENT ON COLUMN sales.operator_doc_uploaded_by IS 'ID do utilizador que fez upload do documento';
COMMENT ON COLUMN sales.operator_validated IS 'Indica se a venda foi validada pela operadora com documento';
COMMENT ON COLUMN sales.operator_validation_date IS 'Data em que a venda foi validada pela operadora';
