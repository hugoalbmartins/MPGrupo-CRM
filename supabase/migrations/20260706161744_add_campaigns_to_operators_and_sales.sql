/*
# Add campaigns system for Energy operators

1. Modified Tables
   - `operators`
     - Added `campaigns` (jsonb, default '[]') - Array of campaign objects with name and optional dates
   - `sales`
     - Added `campaign` (text, nullable) - The campaign selected when creating the sale

2. Important Notes
   - Campaigns are optional per operator, configured in operator settings
   - They don't affect commissions or any other logic
   - They appear as a dropdown in the sale form when campaigns exist for the operator
   - They are recorded in the email notification and available in exports
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operators' AND column_name = 'campaigns'
  ) THEN
    ALTER TABLE operators ADD COLUMN campaigns jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'campaign'
  ) THEN
    ALTER TABLE sales ADD COLUMN campaign text;
  END IF;
END $$;
