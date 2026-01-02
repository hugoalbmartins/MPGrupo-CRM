/*
  # Add Proposal Tracking and Alerts System

  1. Changes
    - Add new alert type 'proposal_pending' for tracking proposals over time
    - Create function to calculate days since proposal creation
    - Create function to check and create alerts for old proposals
    - Add trigger to check proposals daily

  2. Alert Types
    - proposal_pending: For proposals that are pending for 7+ days
    - Alerts created at 7, 14, 21, 28+ day intervals

  3. Security
    - Maintain existing RLS policies
*/

-- Add new alert type to the constraint
DO $$
BEGIN
  -- Drop existing constraint
  ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_type_check;
  
  -- Add new constraint with proposal_pending included
  ALTER TABLE public.alerts ADD CONSTRAINT alerts_type_check 
    CHECK (type = ANY (ARRAY['new_sale'::text, 'status_change'::text, 'note_added'::text, 'operator_validation'::text, 'proposal_pending'::text]));
END $$;

-- Function to calculate days since sale creation
CREATE OR REPLACE FUNCTION get_days_since_creation(sale_date timestamptz)
RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXTRACT(DAY FROM (now() - sale_date))::integer;
END;
$$;

-- Function to check for old proposals and create alerts
CREATE OR REPLACE FUNCTION check_proposal_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  proposal RECORD;
  days_elapsed integer;
  alert_interval integer;
  last_alert_date timestamptz;
  should_alert boolean;
BEGIN
  -- Loop through all sales with status 'Em proposta'
  FOR proposal IN 
    SELECT s.*, u.name as creator_name, p.name as partner_name
    FROM sales s
    LEFT JOIN users u ON s.created_by_user_id = u.id
    LEFT JOIN partners p ON s.partner_id = p.id
    WHERE s.status = 'Em proposta'
  LOOP
    days_elapsed := get_days_since_creation(proposal.created_at);
    
    -- Check if proposal is at least 7 days old
    IF days_elapsed >= 7 THEN
      -- Determine which 7-day interval we're in
      alert_interval := (days_elapsed / 7) * 7;
      
      -- Check if we already sent an alert for this interval
      SELECT MAX(created_at) INTO last_alert_date
      FROM alerts
      WHERE sale_id = proposal.id
        AND type = 'proposal_pending'
        AND created_at >= proposal.created_at + (alert_interval || ' days')::interval - interval '1 day';
      
      -- If no alert was sent in this interval, create one
      should_alert := (last_alert_date IS NULL);
      
      IF should_alert THEN
        -- Create alert for admins and the creator
        INSERT INTO alerts (
          type,
          sale_id,
          sale_code,
          customer_name,
          message,
          metadata
        )
        VALUES (
          'proposal_pending',
          proposal.id,
          proposal.sale_code,
          proposal.client_name,
          CASE 
            WHEN days_elapsed >= 28 THEN 'Proposta pendente há mais de 28 dias'
            WHEN days_elapsed >= 21 THEN 'Proposta pendente há 21 dias'
            WHEN days_elapsed >= 14 THEN 'Proposta pendente há 14 dias'
            ELSE 'Proposta pendente há 7 dias'
          END,
          jsonb_build_object(
            'days_elapsed', days_elapsed,
            'partner_name', COALESCE(proposal.partner_name, 'Admin'),
            'operator_name', proposal.operator_name,
            'commission', COALESCE(proposal.manual_commission, proposal.calculated_commission, 0)
          )
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_proposal_alerts() TO authenticated;

-- Note: For automatic execution, you would need to set up a cron job or pg_cron extension
-- Since this might not be available, the function can be called manually or via edge function
COMMENT ON FUNCTION check_proposal_alerts() IS 'Call this function daily to check for proposals that need alerts. Can be triggered via edge function or cron job.';