/*
  # Add attachments field to sales table

  1. Changes
    - Add `attachments` jsonb column to sales table to store file references
    - Default to empty array
  
  2. Purpose
    - Allow sales to have multiple document attachments stored in sales-documents bucket
    - Each attachment will have: id, filename, path, uploaded_at, uploaded_by
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'attachments'
  ) THEN
    ALTER TABLE sales ADD COLUMN attachments jsonb DEFAULT '[]';
  END IF;
END $$;
