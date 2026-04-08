
-- Allow users to delete their own creative requests
CREATE POLICY "Users can delete own creative requests"
ON public.creative_requests
FOR DELETE
TO public
USING (auth.uid() = user_id);

-- Allow users to delete their own carousel requests
CREATE POLICY "Users can delete own carousel requests"
ON public.carousel_requests
FOR DELETE
TO public
USING (auth.uid() = user_id);

-- Allow users to delete their own generated creatives
CREATE POLICY "Users can delete own generated creatives"
ON public.generated_creatives
FOR DELETE
TO public
USING (auth.uid() = user_id);
