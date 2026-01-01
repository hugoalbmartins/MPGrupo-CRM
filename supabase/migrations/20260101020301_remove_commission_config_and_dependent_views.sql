/*
  # Remover campo commission_config e views dependentes

  1. Alterações
    - Remove a view gestor_comercial_dashboard que depende do campo commission_config
    - Remove o campo commission_config da tabela operators

  2. Notas
    - A view gestor_comercial_dashboard usava o antigo sistema de comissões em JSON
    - Com a nova estrutura na tabela commission_configurations, esta view pode ser recriada se necessário
    - Por agora, removemos para limpar o sistema antigo
*/

-- Remover a view que depende do campo commission_config
DROP VIEW IF EXISTS gestor_comercial_dashboard CASCADE;

-- Remover o campo commission_config da tabela operators
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'commission_config'
  ) THEN
    ALTER TABLE operators DROP COLUMN commission_config;
  END IF;
END $$;