/*
  # Add telecom portability and mobile number fields to sales table

  ## Summary
  Extends the sales table with new fields required for telecom sales:

  ## New Columns

  ### Fix/LR portability:
  - `fix_ported` (boolean) - whether the fixed line is being ported
  - `fix_number` (text) - fixed line number to port
  - `fix_operator` (text) - current operator of fixed line (MEO, Vodafone, NOS, Digi, Outro)
  - `fix_cvp` (text, max 12 chars) - CVP code for fixed line porting

  ### Mobile lines (M4 activation):
  - `mobile_numbers` (jsonb) - array of mobile line objects, each containing:
    { number: string (9 digits), ported: boolean, cvp: string (optional, max 12 chars) }

  ## Notes
  - All columns are nullable (backwards compatible)
  - mobile_numbers defaults to empty array
  - fix_cvp and mobile cvp: valid formats are either 7 digits + 4 letters + 1 digit (12 chars) or 12 digits
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'fix_ported'
  ) THEN
    ALTER TABLE sales ADD COLUMN fix_ported boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'fix_number'
  ) THEN
    ALTER TABLE sales ADD COLUMN fix_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'fix_operator'
  ) THEN
    ALTER TABLE sales ADD COLUMN fix_operator text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'fix_cvp'
  ) THEN
    ALTER TABLE sales ADD COLUMN fix_cvp text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'mobile_numbers'
  ) THEN
    ALTER TABLE sales ADD COLUMN mobile_numbers jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
