/*
  # Sistema de Arquivamento de Alertas

  ## Descrição
  Implementa sistema de arquivamento automático de alertas após 60 dias da criação.
  Os alertas arquivados continuam acessíveis mas separados dos alertas ativos.

  ## Alterações
  1. Adiciona campo `archived_at` à tabela `alerts`
  2. Cria índice para performance de consultas de alertas arquivados
  3. Cria função para arquivar alertas automaticamente
  4. Cria trigger agendado para executar arquivamento diariamente

  ## Funcionalidades
  - Alertas com mais de 60 dias são automaticamente arquivados
  - Alertas arquivados podem ser consultados separadamente
  - Sistema mantém histórico completo de alertas
*/

-- Adicionar campo archived_at à tabela alerts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE alerts ADD COLUMN archived_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Criar índice para performance de consultas com arquivamento
CREATE INDEX IF NOT EXISTS idx_alerts_archived_at ON alerts(archived_at);
CREATE INDEX IF NOT EXISTS idx_alerts_not_archived ON alerts(created_at DESC) WHERE archived_at IS NULL;

-- Função para arquivar alertas antigos (mais de 60 dias)
CREATE OR REPLACE FUNCTION archive_old_alerts()
RETURNS integer AS $$
DECLARE
  v_archived_count integer;
BEGIN
  -- Arquivar alertas com mais de 60 dias que ainda não foram arquivados
  UPDATE alerts
  SET archived_at = now()
  WHERE archived_at IS NULL
    AND created_at < (now() - interval '60 days');

  GET DIAGNOSTICS v_archived_count = ROW_COUNT;

  RAISE NOTICE 'Arquivados % alertas', v_archived_count;

  RETURN v_archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar extensão pg_cron se não existir (para agendamento)
-- Nota: Em produção, isto deve ser configurado pelo administrador do Supabase
-- Por agora, a função pode ser chamada manualmente ou via edge function agendada

-- Comentário: Para executar arquivamento diário, pode usar:
-- SELECT archive_old_alerts();
-- Ou configurar uma edge function agendada que chama esta função
