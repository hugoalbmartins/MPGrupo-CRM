/*
  # Storage para Autos de Comissão

  ## Resumo
  Cria bucket de storage para armazenar arquivos PDF dos autos de comissão.

  ## Storage Bucket
  - Nome: `commission-reports`
  - Público: Não (apenas autenticados)
  - Tipos permitidos: application/pdf

  ## Políticas de Segurança
  - Parceiros podem fazer download dos seus próprios autos
  - Admins e BO podem fazer upload e download de todos os autos
  - Admins podem deletar autos
*/

-- Criar bucket de storage (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('commission-reports', 'commission-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Admins e BO podem fazer upload
CREATE POLICY "Admins and BO can upload commission reports"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'commission-reports'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'bo')
    )
  );

-- Policy: Parceiros podem fazer download dos seus próprios autos
-- Admins e BO podem fazer download de todos
CREATE POLICY "Authenticated users can download commission reports"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'commission-reports'
    AND (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'bo')
      )
      OR
      EXISTS (
        SELECT 1 FROM commission_reports cr
        JOIN partners p ON p.id = cr.partner_id
        WHERE p.user_id = auth.uid()
        AND storage.objects.name LIKE '%' || p.name || '%'
      )
    )
  );

-- Policy: Apenas admins podem deletar
CREATE POLICY "Admins can delete commission reports"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'commission-reports'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Admins podem atualizar
CREATE POLICY "Admins can update commission reports"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'commission-reports'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
