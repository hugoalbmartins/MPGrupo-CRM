-- Zero out commissions on all cancelled/refused sales
-- These sales should never have commission values as they don't pay commission
UPDATE sales
SET 
  calculated_commission = '0',
  manual_commission = NULL,
  direct_debit_value = NULL,
  electronic_invoice_value = NULL
WHERE status IN ('Cancelado', 'Recusado');

-- Ensure cancelled_at is set for all cancelled sales that don't have it
UPDATE sales
SET cancelled_at = updated_at
WHERE status = 'Cancelado' AND cancelled_at IS NULL AND updated_at IS NOT NULL;

UPDATE sales
SET cancelled_at = created_at
WHERE status = 'Cancelado' AND cancelled_at IS NULL;