/*
  # Add tratar_oop to sales

  Adds a boolean column `tratar_oop` to the `sales` table to indicate
  whether the disconnection of the OOP (previous operator) should be handled.
  Defaults to false.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'tratar_oop'
  ) THEN
    ALTER TABLE sales ADD COLUMN tratar_oop boolean DEFAULT false;
  END IF;
END $$;
