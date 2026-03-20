/*
  # Add Multiponto/Multilocal Sale Types

  ## Summary
  Reformulates the energy multi-point sales system to support two distinct types:
  - Multiponto: Multiple CPEs for electricity only, one record per CPE
  - Multilocal: Multiple locations (electricity/gas/dual), one record per CPE or CUI

  ## Changes

  ### sales table
  - Add `sale_type` column: 'normal' | 'multiponto' | 'multilocal'
  - Add `parent_sale_id` column: links child sales back to the first sale of a group
  - Add index on `cpe` for fast CPE search
  - Add index on `cui` for fast CUI search
  - Add index on `parent_sale_id` for grouping queries
  - Add index on `sale_type` for filtering

  ### sales_energy_points table
  - Add `installation_address` column for Multilocal per-point installation address
  - Add `billing_address` column for Multilocal per-point billing address

  ## Notes
  - Existing records default to sale_type = 'normal'
  - parent_sale_id is NULL for normal sales and the first sale of a group
  - All child sales in a multiponto/multilocal group share client data but have their own sale_code
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'sale_type'
  ) THEN
    ALTER TABLE sales ADD COLUMN sale_type text DEFAULT 'normal' CHECK (sale_type IN ('normal', 'multiponto', 'multilocal'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'parent_sale_id'
  ) THEN
    ALTER TABLE sales ADD COLUMN parent_sale_id uuid REFERENCES sales(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_cpe ON sales(cpe) WHERE cpe IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_cui ON sales(cui) WHERE cui IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_sale_type ON sales(sale_type);
CREATE INDEX IF NOT EXISTS idx_sales_parent_sale_id ON sales(parent_sale_id) WHERE parent_sale_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_energy_points' AND column_name = 'installation_address'
  ) THEN
    ALTER TABLE sales_energy_points ADD COLUMN installation_address text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_energy_points' AND column_name = 'billing_address'
  ) THEN
    ALTER TABLE sales_energy_points ADD COLUMN billing_address text;
  END IF;
END $$;
