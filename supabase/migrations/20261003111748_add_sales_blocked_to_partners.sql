/*
# Add sales_blocked column to partners

## Summary
Adds a `sales_blocked` boolean to the `partners` table. When true, all sales
submitted by this partner are automatically flagged as pending validation,
requiring BO or admin approval before being fully processed.

## Changes to `partners` table
- `sales_blocked` (boolean, default false): when true, sales from this partner
  are held for validation

## Notes
- No data is lost; existing partners default to false (unchanged behavior)
- RLS policies are not modified; the column inherits existing partner policies
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'sales_blocked') THEN
    ALTER TABLE partners ADD COLUMN sales_blocked boolean DEFAULT false;
  END IF;
END $$;
