/*
  # Adicionar tipos de serviço M2, M3, M4 e patamares por valor de mensalidade

  1. Alterações
    - Atualiza operators.activation_types para incluir M2, M3, M4
    - Modifica commission_configurations.service_type para aceitar M2, M3, M4
    - Adiciona service_types (array) para permitir múltiplas seleções de tipos de serviço
    - Adiciona tier_mode para distinguir entre patamar por quantidade vs por valor de mensalidade
    - Adiciona monthly_value_min e monthly_value_max para definir intervalos de mensalidade
  
  2. Notas
    - Os tipos M2, M3, M4 aplicam-se apenas a telecomunicações
    - Patamares por valor de mensalidade permitem comissões baseadas no intervalo do valor mensal do serviço
    - service_types permite configurar regras para múltiplos tipos em conjunto (ex: NI + M3 + M4)
*/

-- Adicionar tier_mode para distinguir tipo de patamar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_configurations' AND column_name = 'tier_mode'
  ) THEN
    ALTER TABLE commission_configurations 
    ADD COLUMN tier_mode text NOT NULL DEFAULT 'by_quantity' 
    CHECK (tier_mode IN ('by_quantity', 'by_monthly_value'));
  END IF;
END $$;

-- Adicionar campos para intervalo de valor de mensalidade
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_configurations' AND column_name = 'monthly_value_min'
  ) THEN
    ALTER TABLE commission_configurations 
    ADD COLUMN monthly_value_min numeric(10,2) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_configurations' AND column_name = 'monthly_value_max'
  ) THEN
    ALTER TABLE commission_configurations 
    ADD COLUMN monthly_value_max numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Adicionar service_types como array para permitir seleção múltipla
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_configurations' AND column_name = 'service_types'
  ) THEN
    ALTER TABLE commission_configurations 
    ADD COLUMN service_types text[] DEFAULT '{}';
  END IF;
END $$;

-- Atualizar service_types com base no service_type existente
UPDATE commission_configurations 
SET service_types = ARRAY[service_type]
WHERE service_types = '{}' OR service_types IS NULL;

-- Remover constraint antiga de service_type se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'commission_configurations' 
    AND column_name = 'service_type'
  ) THEN
    ALTER TABLE commission_configurations DROP CONSTRAINT IF EXISTS commission_configurations_service_type_check;
  END IF;
END $$;

-- Adicionar nova constraint para service_type incluindo M2, M3, M4
ALTER TABLE commission_configurations 
ADD CONSTRAINT commission_configurations_service_type_check 
CHECK (service_type IN ('NI', 'MC', 'REFID', 'M2', 'M3', 'M4', 'eletricidade', 'gas', 'default'));

-- Criar índice para melhor performance em queries
CREATE INDEX IF NOT EXISTS idx_commission_configurations_service_types 
ON commission_configurations USING GIN (service_types);

CREATE INDEX IF NOT EXISTS idx_commission_configurations_tier_mode 
ON commission_configurations (tier_mode);

-- Adicionar comentários para documentação
COMMENT ON COLUMN commission_configurations.tier_mode IS 'Modo de patamar: by_quantity (por número de vendas) ou by_monthly_value (por valor de mensalidade)';
COMMENT ON COLUMN commission_configurations.monthly_value_min IS 'Valor mínimo de mensalidade para este patamar (aplicável quando tier_mode = by_monthly_value)';
COMMENT ON COLUMN commission_configurations.monthly_value_max IS 'Valor máximo de mensalidade para este patamar (aplicável quando tier_mode = by_monthly_value)';
COMMENT ON COLUMN commission_configurations.service_types IS 'Array de tipos de serviço aos quais esta configuração se aplica (permite agrupamento como NI + M3 + M4)';
