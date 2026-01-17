-- Create storage bucket for certificates
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificados',
  'certificados',
  false,
  5242880, -- 5MB limit
  ARRAY['application/x-pkcs12', 'application/octet-stream']
);

-- RLS policies for certificates bucket
CREATE POLICY "Users can upload certificates for their companies"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'certificados' AND
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.user_id = auth.uid()
    AND e.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can view certificates for their companies"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'certificados' AND
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.user_id = auth.uid()
    AND e.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can delete certificates for their companies"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'certificados' AND
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.user_id = auth.uid()
    AND e.id::text = (storage.foldername(name))[1]
  )
);