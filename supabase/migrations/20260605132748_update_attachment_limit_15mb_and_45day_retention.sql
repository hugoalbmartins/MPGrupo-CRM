-- Update the sales-documents bucket to allow 15MB files (was 10MB)
UPDATE storage.buckets
SET file_size_limit = 15728640
WHERE id = 'sales-documents';