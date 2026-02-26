/*
  # Add autoriza_documentos field to sales table

  ## Summary
  Adds a new required field to track whether a customer has authorized copies of their
  personal documents to be made during the sales process.

  ## Changes
  ### Modified Tables
  - `sales`
    - `autoriza_documentos` (text, nullable) - Stores customer's answer: 'Sim.' or 'Nao.'

  ## Notes
  - Nullable to allow existing records to remain unaffected
  - New sales will require this field to be filled (enforced at application level)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'autoriza_documentos'
  ) THEN
    ALTER TABLE sales ADD COLUMN autoriza_documentos text;
  END IF;
END $$;
