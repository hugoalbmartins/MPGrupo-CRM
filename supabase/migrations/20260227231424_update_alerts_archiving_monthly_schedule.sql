/*
  # Arquivamento Automático Mensal de Alertas

  ## Resumo
  Atualiza o sistema de arquivamento de alertas para seguir uma lógica mensal:
  - No dia 1 de cada mês, arquiva automaticamente os alertas anteriores ao penúltimo mês
  - Ficam disponíveis (não arquivados) apenas os alertas do mês corrente e do mês anterior
  - Alertas arquivados há mais de 2 meses são apagados permanentemente da base de dados

  ## Alterações
  1. Substitui a função `archive_old_alerts()` pela nova lógica mensal
  2. Cria função `delete_old_archived_alerts()` para apagar alertas arquivados há mais de 2 meses
  3. Cria função `run_monthly_alerts_maintenance()` que executa ambas as operações
  4. Agenda job pg_cron para correr no dia 1 de cada mês às 03:00 UTC

  ## Lógica de Negócio
  - Exemplo: a 1 de Março → arquiva alertas de Janeiro e anteriores (mantém Fevereiro + Março)
  - Exemplo: a 1 de Abril → arquiva alertas de Fevereiro e anteriores (mantém Março + Abril)
  - Arquivados há 2+ meses (archived_at <= início do mês corrente - 2 meses) são apagados

  ## Segurança
  - Funções com SECURITY DEFINER para ter permissões necessárias
*/

-- Função principal de arquivamento: arquiva alertas anteriores ao penúltimo mês
CREATE OR REPLACE FUNCTION archive_old_alerts()
RETURNS integer AS $$
DECLARE
  v_archived_count integer;
  v_cutoff_date timestamptz;
BEGIN
  -- Corte: início do mês anterior (mantém mês corrente + mês anterior, arquiva o resto)
  v_cutoff_date := date_trunc('month', now()) - interval '1 month';

  UPDATE alerts
  SET archived_at = now()
  WHERE archived_at IS NULL
    AND created_at < v_cutoff_date;

  GET DIAGNOSTICS v_archived_count = ROW_COUNT;

  RAISE NOTICE 'Arquivados % alertas (criados antes de %)', v_archived_count, v_cutoff_date;

  RETURN v_archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para apagar alertas arquivados há mais de 2 meses
CREATE OR REPLACE FUNCTION delete_old_archived_alerts()
RETURNS integer AS $$
DECLARE
  v_deleted_count integer;
  v_cutoff_date timestamptz;
BEGIN
  -- Apaga alertas que foram arquivados há mais de 2 meses
  v_cutoff_date := date_trunc('month', now()) - interval '2 months';

  DELETE FROM alerts
  WHERE archived_at IS NOT NULL
    AND archived_at < v_cutoff_date;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RAISE NOTICE 'Apagados % alertas arquivados antes de %', v_deleted_count, v_cutoff_date;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função combinada que executa arquivamento + limpeza
CREATE OR REPLACE FUNCTION run_monthly_alerts_maintenance()
RETURNS text AS $$
DECLARE
  v_archived integer;
  v_deleted integer;
BEGIN
  v_archived := archive_old_alerts();
  v_deleted := delete_old_archived_alerts();

  RETURN format('Manutenção mensal concluída: %s alertas arquivados, %s alertas apagados', v_archived, v_deleted);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Agendar job pg_cron no dia 1 de cada mês às 03:00 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-alerts-maintenance') THEN
      PERFORM cron.unschedule('monthly-alerts-maintenance');
    END IF;

    PERFORM cron.schedule(
      'monthly-alerts-maintenance',
      '0 3 1 * *',
      'SELECT run_monthly_alerts_maintenance();'
    );
  END IF;
END $$;
