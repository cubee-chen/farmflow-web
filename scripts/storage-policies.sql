-- Create intake-images bucket (run in Supabase SQL Editor)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'intake-images',
  'intake-images',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- RLS policies for intake-images bucket
CREATE POLICY "farmer_uploads_own_intake_images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'intake-images'
    AND (storage.foldername(name))[1] = current_farmer_id()::text
  );

CREATE POLICY "farmer_reads_own_intake_images" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'intake-images'
    AND (storage.foldername(name))[1] = current_farmer_id()::text
  );

CREATE POLICY "farmer_deletes_own_intake_images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'intake-images'
    AND (storage.foldername(name))[1] = current_farmer_id()::text
  );
