/*
  # Enable pg_net extension

  1. Changes
    - Enables the `pg_net` extension which provides async HTTP request capabilities
    - Required by existing triggers on the `alerts` table (`send_push_notification_for_alert`)
      and `create_new_sale_alert_with_email` function that use `net.http_post()`
    - Without this extension, any sale edit/create fails with "schema net does not exist"

  2. Impact
    - Fixes 400 Bad Request errors when editing or creating sales
    - Allows push notification and email triggers to function correctly
*/

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
