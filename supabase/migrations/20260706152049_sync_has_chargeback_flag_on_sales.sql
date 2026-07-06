/*
# Sync has_chargeback flag on sales table

1. Data Fix
   - Updates `has_chargeback` to true and sets `chargeback_id` for all sales
     that have existing chargebacks but were not flagged.

2. Important Notes
   - There are 18 sales with chargebacks where has_chargeback was incorrectly false.
   - This ensures the chargeback filter in the sales list works correctly.
*/

UPDATE sales
SET has_chargeback = true,
    chargeback_id = (SELECT id FROM chargebacks WHERE chargebacks.sale_id = sales.id ORDER BY created_at DESC LIMIT 1)
WHERE id IN (SELECT DISTINCT sale_id FROM chargebacks)
  AND (has_chargeback = false OR has_chargeback IS NULL);
