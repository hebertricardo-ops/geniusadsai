
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- User credits table
CREATE TABLE public.user_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_balance INTEGER NOT NULL DEFAULT 10,
  credits_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own credits" ON public.user_credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own credits" ON public.user_credits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own credits" ON public.user_credits FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_user_credits_updated_at BEFORE UPDATE ON public.user_credits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create credits on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, credits_balance, credits_used) VALUES (NEW.id, 10, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created_credits AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();

-- Credit transactions
CREATE TABLE public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('usage', 'purchase', 'bonus')),
  amount INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.credit_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Creative requests
CREATE TABLE public.creative_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  promise TEXT NOT NULL,
  pains TEXT NOT NULL,
  benefits TEXT NOT NULL,
  objections TEXT,
  cta TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.creative_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own requests" ON public.creative_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own requests" ON public.creative_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own requests" ON public.creative_requests FOR UPDATE USING (auth.uid() = user_id);

-- Generated creatives
CREATE TABLE public.generated_creatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.creative_requests(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  copy_data JSONB,
  credits_used INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.generated_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own creatives" ON public.generated_creatives FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own creatives" ON public.generated_creatives FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('creative-uploads', 'creative-uploads', false);
CREATE POLICY "Users can upload own images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'creative-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own uploaded images" ON storage.objects FOR SELECT USING (bucket_id = 'creative-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own uploaded images" ON storage.objects FOR DELETE USING (bucket_id = 'creative-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

INSERT INTO storage.buckets (id, name, public) VALUES ('generated-creatives', 'generated-creatives', true);
CREATE POLICY "Generated creatives publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'generated-creatives');
CREATE POLICY "Backend can upload generated creatives" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'generated-creatives');
