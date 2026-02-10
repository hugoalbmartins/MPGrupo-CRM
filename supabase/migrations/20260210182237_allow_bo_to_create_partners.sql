/*
  # Permitir BO Criar Parceiros

  1. Alterações
    - Atualizar política INSERT de parceiros para permitir que usuários BO criem parceiros
    - Manter as demais políticas inalteradas

  2. Security
    - BO pode criar parceiros
    - Admin pode criar parceiros
    - Outras políticas permanecem as mesmas
*/

-- Remover a política INSERT antiga
DROP POLICY IF EXISTS "Partners can insert own record" ON partners;
DROP POLICY IF EXISTS "Admins can insert partners" ON partners;
DROP POLICY IF EXISTS "BO can insert partners" ON partners;

-- Criar nova política INSERT que permite Admin e BO
CREATE POLICY "Admins and BO can insert partners"
  ON partners
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'bo')
    )
  );

COMMENT ON POLICY "Admins and BO can insert partners" ON partners IS
'Permite que administradores e backoffice criem novos parceiros';
