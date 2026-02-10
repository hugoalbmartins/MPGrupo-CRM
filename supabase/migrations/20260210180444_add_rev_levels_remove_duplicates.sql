/*
  # Adicionar Níveis REV/Rev+ e Remover Duplicados

  1. Alterações na tabela partners
    - Adicionar campo `rev_level` para parceiros REV e Rev+
    - Valores possíveis: 1, 2, 3, 4, 5
    - Padrão: 1

  2. Alterações na tabela commission_configurations
    - Adicionar campo `rev_level` para configurações de parceiros REV/Rev+
    - Remover registos duplicados mantendo apenas o mais recente
    - Atualizar constraint único para incluir rev_level

  3. Dados
    - Atualizar configurações existentes para nível 1
    - Manter compatibilidade com dados existentes

  4. Security
    - Manter políticas RLS existentes
*/

-- Adicionar campo rev_level à tabela partners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'rev_level'
  ) THEN
    ALTER TABLE partners ADD COLUMN rev_level INTEGER DEFAULT 1;
    COMMENT ON COLUMN partners.rev_level IS 'Nível de comissionamento para parceiros REV e Rev+ (1-5). Padrão: 1';
  END IF;
END $$;

-- Adicionar constraint para validar o nível
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partners_rev_level_check'
  ) THEN
    ALTER TABLE partners ADD CONSTRAINT partners_rev_level_check
    CHECK (rev_level >= 1 AND rev_level <= 5);
  END IF;
END $$;

-- Adicionar campo rev_level à tabela commission_configurations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_configurations' AND column_name = 'rev_level'
  ) THEN
    ALTER TABLE commission_configurations ADD COLUMN rev_level INTEGER;
    COMMENT ON COLUMN commission_configurations.rev_level IS 'Nível de comissionamento REV/Rev+ (null = todos os níveis)';
  END IF;
END $$;

-- Remover duplicados, mantendo apenas o registo mais recente de cada grupo
DELETE FROM commission_configurations
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY operator_id, partner_type, d2d_level, client_type, service_types, refid_operation_type
             ORDER BY updated_at DESC, created_at DESC
           ) as rn
    FROM commission_configurations
  ) t
  WHERE t.rn > 1
);

-- Atualizar todas as configurações existentes de parceiros REV e Rev+ para nível 1
UPDATE commission_configurations
SET rev_level = 1
WHERE partner_type IN ('REV', 'Rev+')
  AND rev_level IS NULL;

-- Criar índice para melhorar performance de queries com rev_level
CREATE INDEX IF NOT EXISTS idx_partners_rev_level
ON partners(partner_type, rev_level)
WHERE partner_type IN ('REV', 'Rev+');

CREATE INDEX IF NOT EXISTS idx_commission_configurations_rev_level
ON commission_configurations(partner_type, rev_level)
WHERE partner_type IN ('REV', 'Rev+');

-- Atualizar constraint único para incluir rev_level em REV/Rev+
-- Primeiro, remover o constraint antigo se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'commission_configurations_unique_key'
  ) THEN
    ALTER TABLE commission_configurations
    DROP CONSTRAINT commission_configurations_unique_key;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'commission_configurations_unique_key_v2'
  ) THEN
    ALTER TABLE commission_configurations
    DROP CONSTRAINT commission_configurations_unique_key_v2;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'commission_configurations_unique_key_v3'
  ) THEN
    ALTER TABLE commission_configurations
    DROP CONSTRAINT commission_configurations_unique_key_v3;
  END IF;
END $$;

-- Criar novo constraint único que considera rev_level para REV/Rev+
ALTER TABLE commission_configurations
ADD CONSTRAINT commission_configurations_unique_key_v4
UNIQUE NULLS NOT DISTINCT (
  operator_id,
  partner_type,
  d2d_level,
  rev_level,
  client_type,
  service_types,
  refid_operation_type
);

COMMENT ON CONSTRAINT commission_configurations_unique_key_v4
ON commission_configurations IS
'Garante que cada combinação de operadora, tipo de parceiro, nível (D2D/REV), tipo de cliente, serviços e operação REFID é única';
