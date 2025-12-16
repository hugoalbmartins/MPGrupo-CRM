/*
  # Fix Commission Reports Storage Policies

  1. Purpose
    - Remove duplicate and conflicting policies
    - Create clean, simple policies for commission reports storage
    - Use correct role names: 'admin' and 'bo' (not 'backoffice')

  2. Security
    - Upload: Admin and BO users can upload PDFs
    - Read: Admin and BO can read all, partners can read their own
    - Delete/Update: Only admins
*/

-- Drop all existing commission-reports storage policies
DROP POLICY IF EXISTS "Admin and backoffice can upload commission reports" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete commission reports" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update commission reports" ON storage.objects;
DROP POLICY IF EXISTS "Admins and BO can upload commission reports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete commission reports" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update commission reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can download commission reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can read commission reports based on role" ON storage.objects;

-- Create new clean policies

-- Allow admin and bo to upload
CREATE POLICY "Allow admin and bo to upload commission reports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'commission-reports'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'bo')
  )
);

-- Allow users to read based on role
CREATE POLICY "Allow users to read commission reports"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'commission-reports'
  AND (
    -- Admin and BO can read all
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'bo')
    )
    OR
    -- Partners can read their own (files in their partnerId folder)
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('partner', 'partner_commercial')
      AND u.partner_id IS NOT NULL
      AND storage.objects.name LIKE (u.partner_id::text || '/%')
    )
  )
);

-- Allow only admin to delete
CREATE POLICY "Allow admin to delete commission reports"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'commission-reports'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Allow only admin to update
CREATE POLICY "Allow admin to update commission reports"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'commission-reports'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'commission-reports'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);