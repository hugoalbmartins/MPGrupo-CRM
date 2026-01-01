/*
  # Corrigir constraint UNIQUE da tabela commission_configurations
  
  1. Problema Identificado
    - A constraint UNIQUE atual apenas considera: operator_id, partner_type, client_type, service_type, min_sales
    - Mas o sistema agora suporta múltiplas configurações diferenciadas por:
      - activation_type (M2, M3, M4) para NI/MC
      - refid_operation_type (upsell, downsell, both) para REFID
      - tier_mode (by_quantity vs by_monthly_value)
      - monthly_value_min e monthly_value_max (quando tier_mode = by_monthly_value)
    
  2. Solução
    - Remove constraint UNIQUE antiga
    - Cria índice UNIQUE usando expressão para normalizar valores NULL
    - Permite múltiplas configurações diferenciadas por activation_type e refid_operation_type
  
  3. Exemplos de Configurações Válidas Agora Permitidas
    - NI Particular D2D com M2 = 50€
    - NI Particular D2D com M3 = 60€
    - NI Particular D2D com M4 = 70€
    - REFID Particular D2D upsell = 30€
    - REFID Particular D2D downsell = 20€
    - MC Empresarial Rev by_quantity 0-50 vendas = 40€
    - MC Empresarial Rev by_quantity 50+ vendas = 50€
    - MC Empresarial Rev by_monthly_value 0-30€ = 45€
    - MC Empresarial Rev by_monthly_value 30-60€ = 55€
*/

-- Remove constraint UNIQUE antiga
ALTER TABLE commission_configurations
DROP CONSTRAINT IF EXISTS unique_commission_config;

-- Remove possíveis constraints antigas com outros nomes
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'commission_configurations'::regclass 
        AND contype = 'u'
        AND conname LIKE '%operator_id%'
        AND conname LIKE '%service_type%'
    LOOP
        EXECUTE 'ALTER TABLE commission_configurations DROP CONSTRAINT IF EXISTS ' || constraint_name;
    END LOOP;
END $$;

-- Remove índice único antigo se existir
DROP INDEX IF EXISTS unique_commission_config_complete;

-- Cria índice UNIQUE usando expressão para tratar NULL values
-- Converte NULL em string vazia para garantir unicidade
CREATE UNIQUE INDEX unique_commission_config_complete ON commission_configurations (
  operator_id, 
  partner_type, 
  client_type, 
  service_type, 
  tier_mode,
  min_sales,
  COALESCE(monthly_value_min, 0),
  COALESCE(monthly_value_max, 0),
  COALESCE(activation_type, ''),
  COALESCE(refid_operation_type, '')
);

-- Adicionar comentário explicativo
COMMENT ON INDEX unique_commission_config_complete IS 
'Garante que cada combinação única de operadora, tipo de parceiro, tipo de cliente, tipo de serviço, modo de patamar, patamar, tipo de ativação e tipo de operação REFID tem apenas uma configuração. NULL values são tratados como string vazia para garantir unicidade.';
