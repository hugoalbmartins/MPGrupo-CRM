/*
  # Create Storage Bucket for Operator Logos
  
  Creates a public storage bucket for storing operator logos with appropriate access policies.
  
  ## Storage
  - Bucket: `operadoras-logos` (public)
  - Allows image uploads (jpg, jpeg, png, webp, svg)
  - Authenticated users can read
  - Only admins can upload/update/delete
*/

-- Create storage bucket for operator logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'operadoras-logos',
  'operadoras-logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for operadoras-logos bucket
-- Anyone can read (public bucket)
CREATE POLICY "Public can read operator logos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'operadoras-logos');

-- Only admin can upload logos
CREATE POLICY "Admin can upload operator logos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'operadoras-logos' 
    AND (auth.jwt() ->> 'email') IN (
      SELECT email FROM users WHERE role = 'admin'
    )
  );

-- Only admin can update logos
CREATE POLICY "Admin can update operator logos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'operadoras-logos'
    AND (auth.jwt() ->> 'email') IN (
      SELECT email FROM users WHERE role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'operadoras-logos'
    AND (auth.jwt() ->> 'email') IN (
      SELECT email FROM users WHERE role = 'admin'
    )
  );

-- Only admin can delete logos
CREATE POLICY "Admin can delete operator logos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'operadoras-logos'
    AND (auth.jwt() ->> 'email') IN (
      SELECT email FROM users WHERE role = 'admin'
    )
  );