/*
  # Add is_commissioned field to users

  1. Changes
    - Add `is_commissioned` boolean field to `users` table
      - Defaults to `false`
      - Only applicable to users with role 'admin'
      - Commissioned admins can have sales registered under their name
      - They receive commissions using REV partner values
    
  2. Notes
    - Non-commissioned admins can still have sales but without commission calculations
    - All sales (commissioned or not) appear in reports and activation validations
    - This allows flexible commission structures for administrative sales staff
*/

-- Add is_commissioned field to users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'is_commissioned'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN is_commissioned boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add comment to document the field
COMMENT ON COLUMN public.users.is_commissioned IS 'Indicates if admin user receives commissions on sales. Uses REV partner commission values when true.';
