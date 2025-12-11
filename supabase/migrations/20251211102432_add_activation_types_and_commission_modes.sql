/*
  Adicionar tipos de ativação e modos de comissão

  Alterações na tabela operators:
  1. Adiciona campo activation_types (text array)
     - Para operadoras de telecomunicações
     - Tipos possíveis: NI, REFID Emp, MC
     - Permite múltiplas seleções
  
  2. Adiciona campo commission_mode (text)
     - tier: Usa patamares configuráveis (padrão)
     - manual: Comissão definida manualmente na edição da venda
     - value: Patamares baseados em valor de mensalidade (telecom)
  
  Alterações na tabela sales:
  1. Adiciona campo activation_type (text)
     - Para vendas de telecomunicações
     - Guarda o tipo de ativação escolhido
  
  2. Adiciona campo manual_commission (numeric)
     - Para operadoras com commission_mode=manual
     - Permite definir comissão manualmente

  Notas:
  - Operadoras existentes ficam com commission_mode=tier (padrão)
  - Para telecomunicações, tier_mode pode ser quantity ou value
  - Para energia/solar com commission_mode=manual, não há patamares
*/

-- Adicionar campos à tabela operators
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'activation_types'
  ) THEN
    ALTER TABLE operators ADD COLUMN activation_types text[] DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'commission_mode'
  ) THEN
    ALTER TABLE operators ADD COLUMN commission_mode text DEFAULT 'tier' CHECK (commission_mode IN ('tier', 'manual', 'value'));
  END IF;
END $$;

-- Adicionar campos à tabela sales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'activation_type'
  ) THEN
    ALTER TABLE sales ADD COLUMN activation_type text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'manual_commission'
  ) THEN
    ALTER TABLE sales ADD COLUMN manual_commission numeric(10, 2);
  END IF;
END $$;
