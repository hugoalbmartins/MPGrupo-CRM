/*
  # Corrigir constraint UNIQUE para incluir d2d_level e rev_level
  
  1. Problema Identificado
    - A constraint UNIQUE não inclui d2d_level e rev_level
    - Isso impede a criação de múltiplos patamares para o mesmo serviço dentro do mesmo nível
    - Exemplo: MEO, D2D Nv1, Particular, NI não pode ter patamares em 0 e 5 vendas
  
  2. Solução
    - Remove constraint UNIQUE antiga
    - Cria nova constraint incluindo d2d_level e rev_level
    - Isso permite múltiplos patamares diferenciados por min_sales
  
  3. Exemplos de Configurações Agora Permitidas
    - MEO, D2D Nv1, Particular, NI, 0 vendas = 50€
    - MEO, D2D Nv1, Particular, NI, 5 vendas = 60€
    - MEO, D2D Nv1, Particular, NI, 10 vendas = 70€
    - MEO, D2D Nv2, Particular, NI, 0 vendas = 55€
*/

-- Remove índice único antigo
DROP INDEX IF EXISTS unique_commission_config_complete;

-- Cria novo índice UNIQUE incluindo d2d_level e rev_level
CREATE UNIQUE INDEX unique_commission_config_complete ON commission_configurations (
  operator_id, 
  partner_type, 
  COALESCE(d2d_level, ''),
  COALESCE(rev_level::text, ''),
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
'Garante que cada combinação única de operadora, tipo de parceiro, nível D2D/REV, tipo de cliente, tipo de serviço, modo de patamar, patamar, tipo de ativação e tipo de operação REFID tem apenas uma configuração. NULL values são tratados como string vazia para garantir unicidade.';
