ALTER TABLE public.creative_requests DROP CONSTRAINT IF EXISTS creative_requests_status_check;
ALTER TABLE public.creative_requests ADD CONSTRAINT creative_requests_status_check CHECK (status IN ('pending', 'processing', 'completed', 'error'));

ALTER TABLE public.carousel_requests DROP CONSTRAINT IF EXISTS carousel_requests_status_check;
ALTER TABLE public.carousel_requests ADD CONSTRAINT carousel_requests_status_check CHECK (status IN ('pending', 'processing', 'completed', 'error'));