/*
  # Adicionar campos em falta à tabela commission_configurations

  1. Novos Campos
    - partner_type: Tipo de parceiro (D2D, Rev, Rev+)
    - client_type: Tipo de cliente (particular, empresarial)
    - min_sales: Mínimo de vendas para este patamar (tier system)
    
  2. Alterações
    - Remove constraint único antigo se existir
    - Adiciona novo constraint único incluindo os novos campos
    - Atualiza comentários
    
  3. Notas
    - Mantém compatibilidade com dados existentes
    - Permite patamares por tipo de cliente e parceiro
*/

-- Adicionar partner_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_configurations' AND column_name = 'partner_type'
  ) THEN
    ALTER TABLE commission_configurations 
    ADD COLUMN partner_type text NOT NULL DEFAULT 'D2D' CHECK (partner_type IN ('D2D', 'Rev', 'Rev+'));
  END IF;
END $$;

-- Adicionar client_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_configurations' AND column_name = 'client_type'
  ) THEN
    ALTER TABLE commission_configurations 
    ADD COLUMN client_type text NOT NULL DEFAULT 'particular' CHECK (client_type IN ('particular', 'empresarial'));
  END IF;
END $$;

-- Adicionar min_sales (para sistema de patamares)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_configurations' AND column_name = 'min_sales'
  ) THEN
    ALTER TABLE commission_configurations 
    ADD COLUMN min_sales integer NOT NULL DEFAULT 0 CHECK (min_sales >= 0);
  END IF;
END $$;

-- Atualizar service_type para incluir M3 e M4 (telecomunicações)
DO $$
BEGIN
  ALTER TABLE commission_configurations 
  DROP CONSTRAINT IF EXISTS commission_configurations_service_type_check;
  
  ALTER TABLE commission_configurations
  ADD CONSTRAINT commission_configurations_service_type_check 
  CHECK (service_type IN ('NI', 'MC', 'REFID', 'M3', 'M4', 'eletricidade', 'gas', 'dual'));
END $$;

-- Criar índice para lookups otimizados
CREATE INDEX IF NOT EXISTS idx_commission_config_lookup 
ON commission_configurations(operator_id, partner_type, client_type, service_type, min_sales);

-- Adicionar constraint único para evitar duplicados
DO $$
BEGIN
  ALTER TABLE commission_configurations
  DROP CONSTRAINT IF EXISTS unique_commission_config;
  
  ALTER TABLE commission_configurations
  ADD CONSTRAINT unique_commission_config 
  UNIQUE(operator_id, partner_type, client_type, service_type, min_sales);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- Comentários
COMMENT ON COLUMN commission_configurations.partner_type IS 'Tipo de parceiro: D2D, Rev ou Rev+';
COMMENT ON COLUMN commission_configurations.client_type IS 'Tipo de cliente: particular ou empresarial';
COMMENT ON COLUMN commission_configurations.min_sales IS 'Número mínimo de vendas para este patamar (tier). 0 = patamar base';
COMMENT ON COLUMN commission_configurations.service_type IS 'Tipo de serviço: NI, MC, REFID, M3, M4 (telecom) ou eletricidade, gas, dual (energia)';