/*
  # Enable Realtime for Alerts Table and Fix Notification System

  1. Changes
    - Enable Realtime publication for the `alerts` table so frontend can receive live updates
    - This is required for the Supabase Realtime channel subscription to work in the frontend

  2. Important Notes
    - Without this, the postgres_changes subscription in the frontend receives NO events
    - This was the root cause of in-app notifications not appearing
*/

ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
