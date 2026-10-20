CREATE TABLE public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  upazila_id text NOT NULL REFERENCES public.upazilas(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('complaint', 'suggestion')),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 160),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 4000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_requests_area_created_idx
  ON public.support_requests (upazila_id, created_at DESC);

GRANT SELECT, INSERT ON public.support_requests TO authenticated;
GRANT ALL ON public.support_requests TO service_role;

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support requests scoped read" ON public.support_requests
FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR (upazila_id = public.current_upazila() AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'uno')
  ))
  OR public.has_role(auth.uid(), 'super')
);

CREATE POLICY "users create own support requests" ON public.support_requests
FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND upazila_id = public.current_upazila()
  AND public.mfa_ok()
);