/*
  # Add Unknown Partner for Sales Imports
  
  1. Purpose
    - Creates a special "Parceiro desconhecido" (Unknown Partner) record
    - Used when importing sales with partners not found in the system
    - Allows sales to be registered without blocking the import process
  
  2. Details
    - Partner code: DESCONHECIDO
    - Partner type: Rev
    - All required fields filled with placeholder values
    - No user account associated (user_id is NULL)
  
  3. Notes
    - This partner should only be used during imports when the real partner cannot be found
    - Sales assigned to this partner should be reviewed and updated with correct partner information
*/

-- Insert the unknown partner if it doesn't already exist
INSERT INTO partners (
  partner_code,
  partner_type,
  name,
  email,
  phone,
  contact_person,
  street,
  door_number,
  postal_code,
  locality,
  nif
)
SELECT 
  'DESCONHECIDO',
  'Rev',
  'Parceiro desconhecido',
  'desconhecido@sistema.local',
  'N/A',
  'Sistema',
  'N/A',
  'N/A',
  '0000-000',
  'N/A',
  '999999990'
WHERE NOT EXISTS (
  SELECT 1 FROM partners WHERE partner_code = 'DESCONHECIDO'
);
