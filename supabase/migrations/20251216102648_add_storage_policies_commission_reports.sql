/*
  # Add Storage Policies for Commission Reports Bucket

  1. Purpose
    - Allow authenticated users with admin or backoffice roles to upload commission report PDFs
    - Allow authenticated users (admin, backoffice, partner) to read commission reports
    - Partners can only read their own reports
    - Only admins can delete reports

  2. Security
    - Upload policy: Only admin and backoffice users can upload
    - Read policy: 
      - Admins and backoffice can read all reports
      - Partners can only read reports in their own folder (partnerId/)
    - Delete policy: Only admins can delete reports
*/

-- Policy for uploading commission reports (admin and backoffice only)
CREATE POLICY "Admin and backoffice can upload commission reports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'commission-reports'
  AND (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'backoffice')
    )
  )
);

-- Policy for reading commission reports
CREATE POLICY "Users can read commission reports based on role"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'commission-reports'
  AND (
    -- Admins and backoffice can read all reports
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'backoffice')
    )
    OR
    -- Partners can only read their own reports (path starts with their partner_id)
    EXISTS (
      SELECT 1 FROM users u
      JOIN partners p ON u.partner_id = p.id
      WHERE u.id = auth.uid()
      AND u.role = 'partner'
      AND storage.objects.name LIKE (p.id::text || '/%')
    )
  )
);

-- Policy for deleting commission reports (admin only)
CREATE POLICY "Admin can delete commission reports"
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

-- Policy for updating commission reports (admin only)
CREATE POLICY "Admin can update commission reports"
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