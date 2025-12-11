/*
  # Add Admin Delete Policy for Sales

  1. Changes
    - Add DELETE policy for sales table allowing only admin users to delete sales
    
  2. Security
    - Only users with role 'admin' can delete sales
    - Uses has_role() function for role checking
*/

CREATE POLICY "Admins can delete sales"
  ON sales
  FOR DELETE
  TO authenticated
  USING (
    has_role('admin')
  );