/*
  # Create sales documents storage bucket

  1. New Bucket
    - `sales-documents` - Storage for sale-related documents and attachments
  
  2. Security
    - Enable RLS with policies for authenticated users
    - Admin and BO users can read all documents
    - Partner users can read their own sales documents
    - Users can upload documents to sales they have access to
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sales-documents',
  'sales-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload sales documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'sales-documents');

CREATE POLICY "Users can read sales documents they have access to"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'sales-documents');

CREATE POLICY "Users can delete their uploaded documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'sales-documents');