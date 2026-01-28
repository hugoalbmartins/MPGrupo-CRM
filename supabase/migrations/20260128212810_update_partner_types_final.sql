/*
  # Atualizar Tipos de Partner para Sistema Final

  1. Alterações
    - Rev1 → REV
    - Remover Rev2 e Rev3 (converter para REV)
    - D2D → D2D_1
    - Adicionar D2D_2 e D2D_3

  2. Migração de Dados
    - Atualiza todos os parceiros existentes
    - Atualiza todas as configurações de comissão

  3. Segurança
    - Sem alterações nas políticas RLS
*/

-- Step 1: Drop constraints
ALTER TABLE partners
DROP CONSTRAINT IF EXISTS partners_partner_type_check;

ALTER TABLE commission_configurations
DROP CONSTRAINT IF EXISTS commission_configurations_partner_type_check;

-- Step 2: Update existing data in partners table
UPDATE partners SET partner_type = 'REV' WHERE partner_type IN ('Rev1', 'Rev2', 'Rev3');
UPDATE partners SET partner_type = 'D2D_1' WHERE partner_type = 'D2D';

-- Step 3: Update existing data in commission_configurations table
UPDATE commission_configurations SET partner_type = 'REV' WHERE partner_type IN ('Rev1', 'Rev2', 'Rev3');
UPDATE commission_configurations SET partner_type = 'D2D_1' WHERE partner_type = 'D2D';

-- Step 4: Add new constraints with updated types
ALTER TABLE partners
ADD CONSTRAINT partners_partner_type_check
CHECK (partner_type IN ('D2D_1', 'D2D_2', 'D2D_3', 'REV', 'Rev+'));

ALTER TABLE commission_configurations
ADD CONSTRAINT commission_configurations_partner_type_check
CHECK (partner_type IN ('D2D_1', 'D2D_2', 'D2D_3', 'REV', 'Rev+'));

-- Step 5: Update comments
COMMENT ON COLUMN partners.partner_type IS 'Tipo de parceiro: D2D_1/D2D_2/D2D_3 (Door to Door níveis 1, 2 e 3), REV (Revenue sharing), Rev+ (Premium revenue sharing)';
COMMENT ON COLUMN commission_configurations.partner_type IS 'Tipo de parceiro: D2D_1/D2D_2/D2D_3 (Door to Door níveis 1, 2 e 3), REV (Revenue sharing), Rev+ (Premium revenue sharing)';