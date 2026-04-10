/*
  # Add activation_date column to sales table

  1. New Columns
    - `activation_date` (date, nullable) - Stores the date a sale was activated (when status changes to "Ativo")

  2. Notes
    - This date is required when changing a sale's status to "Ativo"
    - Used for commission report (autos) month filtering
    - Exported in sales Excel export
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'activation_date'
  ) THEN
    ALTER TABLE sales ADD COLUMN activation_date date;
  END IF;
END $$;
