/*
  # Allow Access to Unknown Partner
  
  1. Purpose
    - Adds RLS policy to allow all authenticated users to view the "Parceiro desconhecido"
    - Required for sales import functionality when partner is not found
    - Ensures import process can assign sales to unknown partner
  
  2. Security
    - Policy only allows SELECT access
    - Only applies to the specific partner with code 'DESCONHECIDO'
    - All other partner restrictions remain in place
  
  3. Notes
    - This policy must exist for the import functionality to work correctly
    - Without it, users cannot access the unknown partner during imports
*/

-- Create policy to allow all authenticated users to view the unknown partner
CREATE POLICY "All authenticated users can view unknown partner"
  ON partners
  FOR SELECT
  TO authenticated
  USING (partner_code = 'DESCONHECIDO');
