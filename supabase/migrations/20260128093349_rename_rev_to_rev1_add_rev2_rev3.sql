/*
  # Rename Rev to Rev1 and Add Rev2 and Rev3 Partner Types

  1. Changes
    - Update existing 'Rev' partner type to 'Rev1'
    - Update partner_type constraint to include Rev1, Rev2, Rev3
    - Update commission_configurations table partner_type

  2. Security
    - No changes to RLS policies
*/

-- Drop old constraint on partners table FIRST
ALTER TABLE partners
DROP CONSTRAINT IF EXISTS partners_partner_type_check;

-- Update existing partners with type 'Rev' to 'Rev1'
UPDATE partners
SET partner_type = 'Rev1'
WHERE partner_type = 'Rev';

-- Add new constraint with Rev1, Rev2, Rev3
ALTER TABLE partners
ADD CONSTRAINT partners_partner_type_check
CHECK (partner_type IN ('D2D', 'Rev1', 'Rev2', 'Rev3', 'Rev+'));

-- Drop old constraint on commission_configurations table if exists
ALTER TABLE commission_configurations
DROP CONSTRAINT IF EXISTS commission_configurations_partner_type_check;

-- Update existing commission configurations with type 'Rev' to 'Rev1'
UPDATE commission_configurations
SET partner_type = 'Rev1'
WHERE partner_type = 'Rev';

-- Add new constraint with Rev1, Rev2, Rev3
ALTER TABLE commission_configurations
ADD CONSTRAINT commission_configurations_partner_type_check
CHECK (partner_type IN ('D2D', 'Rev1', 'Rev2', 'Rev3', 'Rev+'));

-- Add comment explaining the partner types
COMMENT ON COLUMN partners.partner_type IS 'Partner type: D2D (Door to Door), Rev1/Rev2/Rev3 (Revenue sharing levels), Rev+ (Premium revenue sharing)';
