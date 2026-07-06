/*
# Add chargeback_status to sales for quick filtering

1. Modified Tables
   - `sales`
     - Added `chargeback_status` (text, nullable) - Values: 'pending' (has unsettled chargebacks),
       'settled' (all chargebacks included in reports), null (no chargebacks)

2. Data Fix
   - Sets chargeback_status for all existing sales with chargebacks

3. Important Notes
   - 'pending' means at least one chargeback on this sale hasn't been included in a commission report
   - 'settled' means all chargebacks have been deducted/included in reports
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'chargeback_status'
  ) THEN
    ALTER TABLE sales ADD COLUMN chargeback_status text;
  END IF;
END $$;

UPDATE sales
SET chargeback_status = CASE
  WHEN EXISTS (
    SELECT 1 FROM chargebacks
    WHERE chargebacks.sale_id = sales.id AND chargebacks.commission_report_id IS NULL
  ) THEN 'pending'
  ELSE 'settled'
END
WHERE has_chargeback = true;
