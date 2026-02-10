/*
  # Adicionar activation_type a commission_configurations

  1. Alterações
    - Adiciona campo activation_type à tabela commission_configurations
    - Permite especificar o tipo de ativação (M2, M3, M4) para configurações de telecomunicações
  
  2. Notas
    - activation_type é opcional (nullable) pois apenas se aplica a tipos de serviço NI e MC
    - Campo pode ser null para configurações que não usam tipo de ativação
*/

-- Adicionar campo activation_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'commission_configurations' AND column_name = 'activation_type'
  ) THEN
    ALTER TABLE commission_configurations 
    ADD COLUMN activation_type text CHECK (activation_type IN ('M2', 'M3', 'M4') OR activation_type IS NULL);
  END IF;
END $$;

-- Adicionar comentário para documentação
COMMENT ON COLUMN commission_configurations.activation_type IS 'Tipo de ativação para serviços NI/MC: M2, M3, ou M4 (aplicável apenas a telecomunicações)';

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_commission_configurations_activation_type 
ON commission_configurations (activation_type) 
WHERE activation_type IS NOT NULL;
