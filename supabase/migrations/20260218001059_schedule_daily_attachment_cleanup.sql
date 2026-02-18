/*
  # Schedule daily attachment cleanup job

  ## Summary
  Sets up a pg_cron scheduled job that calls the cleanup-expired-attachments
  edge function every day at 02:00 UTC. This ensures attachments older than
  60 days are removed from storage and marked as expired in the JSONB metadata.

  ## Notes
  - Uses pg_cron extension (must be enabled)
  - Runs daily at 02:00 UTC to minimise load during peak hours
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-attachments') THEN
      PERFORM cron.unschedule('cleanup-expired-attachments');
    END IF;

    PERFORM cron.schedule(
      'cleanup-expired-attachments',
      '0 2 * * *',
      'SELECT net.http_post(url := current_setting(''app.supabase_url'') || ''/functions/v1/cleanup-expired-attachments'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer '' || current_setting(''app.supabase_service_role_key'')), body := ''{}''::jsonb) AS request_id;'
    );
  END IF;
END $$;
