
CREATE TABLE public.carousel_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  main_promise TEXT NOT NULL,
  pain_points TEXT NOT NULL,
  benefits TEXT NOT NULL,
  objections TEXT,
  carousel_objective TEXT NOT NULL,
  creative_style TEXT,
  extra_context TEXT,
  slides_count INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'pending',
  result_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.carousel_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own carousel requests" ON public.carousel_requests FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own carousel requests" ON public.carousel_requests FOR SELECT TO public USING (auth.uid() = user_id);
CREATE POLICY "Users can update own carousel requests" ON public.carousel_requests FOR UPDATE TO public USING (auth.uid() = user_id);
