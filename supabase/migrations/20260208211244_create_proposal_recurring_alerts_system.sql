/*
  # Create Proposal Recurring Alerts System

  Creates a system that generates alerts for proposals older than 7 days.
  
  ## New Functions
  - `check_and_create_proposal_alerts()` - Checks for proposals pending > 7 days
    and creates alerts for partners and admins
  - Only creates one alert per proposal per 7-day period (checks last alert date)

  ## Alert Recipients
  - All admin users
  - Partner associated with the proposal sale

  ## Notes
  - Can be triggered by pg_cron or an edge function on schedule
  - Avoids duplicate alerts by checking the last proposal_reminder alert date
*/

CREATE OR REPLACE FUNCTION check_and_create_proposal_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proposal RECORD;
  v_user_ids uuid[];
  v_admin_ids uuid[];
  v_partner_users uuid[];
  v_count int := 0;
  v_last_alert_date timestamptz;
BEGIN
  SELECT ARRAY_AGG(id) INTO v_admin_ids
  FROM users
  WHERE role = 'admin';

  FOR v_proposal IN
    SELECT 
      s.id,
      s.sale_code,
      s.client_name,
      s.operator_name,
      s.partner_id,
      s.created_by_user_id,
      s.created_at,
      s.date
    FROM sales s
    WHERE s.status = 'Em proposta'
      AND s.created_at < now() - interval '7 days'
    ORDER BY s.created_at ASC
  LOOP
    SELECT MAX(a.created_at) INTO v_last_alert_date
    FROM alerts a
    WHERE a.sale_id = v_proposal.id
      AND a.type = 'proposal_reminder';

    IF v_last_alert_date IS NOT NULL AND v_last_alert_date > now() - interval '7 days' THEN
      CONTINUE;
    END IF;

    v_user_ids := COALESCE(v_admin_ids, '{}');

    IF v_proposal.partner_id IS NOT NULL THEN
      SELECT ARRAY_AGG(u.id) INTO v_partner_users
      FROM users u
      LEFT JOIN partners p ON p.user_id = u.id
      WHERE (u.role = 'partner' AND p.id = v_proposal.partner_id)
         OR (u.id = v_proposal.created_by_user_id);

      IF v_partner_users IS NOT NULL THEN
        v_user_ids := v_user_ids || v_partner_users;
      END IF;
    END IF;

    SELECT ARRAY(SELECT DISTINCT unnest(v_user_ids)) INTO v_user_ids;

    INSERT INTO alerts (
      type, sale_id, sale_code, message, user_ids, created_by, created_by_name
    ) VALUES (
      'proposal_reminder',
      v_proposal.id,
      v_proposal.sale_code,
      'Proposta pendente ha mais de 7 dias: ' || v_proposal.sale_code || ' - Cliente: ' || COALESCE(v_proposal.client_name, 'N/A') || ' - Operadora: ' || COALESCE(v_proposal.operator_name, 'N/A'),
      v_user_ids,
      NULL,
      'Sistema'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('alerts_created', v_count);
END;
$$;

-- Schedule via pg_cron if available (runs daily at 9:00 AM UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'check-proposal-alerts',
      '0 9 * * *',
      'SELECT check_and_create_proposal_alerts()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available, schedule proposal alerts manually: %', SQLERRM;
END $$;
