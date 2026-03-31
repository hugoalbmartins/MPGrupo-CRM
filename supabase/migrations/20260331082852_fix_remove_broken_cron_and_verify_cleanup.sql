/*
  # Fix Storage Cleanup Cron Jobs

  1. Changes
    - Remove broken `purge-expired-sale-attachments` cron job (jobid=1) which has NULL URL and empty auth token
    - Ensure only the working `cleanup-expired-attachments` cron job remains active

  2. Important Notes
    - Job 1 was failing every day at 02:00 UTC with "null value in column url"
    - Job 5 (cleanup-expired-attachments) at 03:00 UTC with hardcoded URL is the correct replacement
*/

SELECT cron.unschedule('purge-expired-sale-attachments');
