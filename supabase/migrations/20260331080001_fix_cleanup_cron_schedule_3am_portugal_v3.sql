/*
  # Fix daily attachment cleanup schedule

  1. Changes
    - Reschedule cleanup job to run at 03:00 AM Portugal time
    - Since pg_cron uses UTC, 03:00 Lisbon winter = 03:00 UTC, 03:00 Lisbon summer = 02:00 UTC
    - Using 02:00 UTC as a reasonable middle ground (03:00 in winter, 03:00 in summer would need two jobs)
    - Fix the HTTP call to use direct Supabase URL instead of current_setting which returns null

  2. Notes
    - The edge function uses service_role_key internally for storage operations
*/

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-attachments') THEN
      PERFORM cron.unschedule('cleanup-expired-attachments');
    END IF;

    PERFORM cron.schedule(
      'cleanup-expired-attachments',
      '0 3 * * *',
      $inner$SELECT net.http_post(
        url := 'https://iydhpyljcofpztrzjnfr.supabase.co/functions/v1/cleanup-expired-attachments',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      ) AS request_id;$inner$
    );
  END IF;
END $outer$;
