/*
  # Add Refidelizado Tracking to Sales

  1. Modified Tables
    - `sales`
      - `refidelizado` (boolean, default false): Whether this sale has been refidelized (manually or automatically)
      - `refidelizado_at` (timestamptz, nullable): When the sale was marked as refidelized
      - `refidelizado_por` (uuid, nullable): Who manually marked it as refidelized (null if automatic)
      - `refidelizado_sale_id` (uuid, nullable): The newer sale that triggered automatic refidelization

  2. Notes
    - A sale is excluded from the refidelization listing when refidelizado = true
    - Automatic detection: when a new active sale is created with the same NIF (and same CPE/CUI for energy),
      older sales for that client are marked as refidelized automatically
    - Manual: admin/BO can mark a sale as refidelized from the refidelization listing
*/

ALTER TABLE sales ADD COLUMN IF NOT EXISTS refidelizado boolean DEFAULT false;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS refidelizado_at timestamptz;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS refidelizado_por uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS refidelizado_sale_id uuid REFERENCES sales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_refidelizado ON sales(refidelizado) WHERE refidelizado = false;
CREATE INDEX IF NOT EXISTS idx_sales_client_nif_status ON sales(client_nif, status);
