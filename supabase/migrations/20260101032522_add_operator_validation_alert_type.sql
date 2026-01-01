/*
  # Add operator_validation alert type

  1. Changes
    - Update `alerts` table type constraint to include 'operator_validation'
    - This allows the system to send alerts when operator validations are completed
  
  2. Notes
    - The operator_validation alert type is used when Excel validation files are processed
    - These alerts notify admins and back office staff about unmatched records
*/

-- Drop the existing constraint
ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_type_check;

-- Add the new constraint with operator_validation included
ALTER TABLE public.alerts ADD CONSTRAINT alerts_type_check 
  CHECK (type = ANY (ARRAY['new_sale'::text, 'status_change'::text, 'note_added'::text, 'operator_validation'::text]));
