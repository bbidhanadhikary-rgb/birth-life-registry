CREATE TABLE public.monitoring_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upazila_id text NOT NULL REFERENCES public.upazilas(id) ON DELETE CASCADE,
  union_id text,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 180),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 5000),
  kind text NOT NULL DEFAULT 'notice' CHECK (kind IN ('notice', 'message', 'directive')),
  published_at timestamptz NOT NULL DEFAULT now(),
  CHECK (union_id IS NULL OR char_length(btrim(union_id)) BETWEEN 1 AND 160)
);

CREATE INDEX monitoring_notices_upazila_published_idx
  ON public.monitoring_notices (upazila_id, published_at DESC);
CREATE INDEX monitoring_notices_union_published_idx
  ON public.monitoring_notices (union_id, published_at DESC);

GRANT SELECT, INSERT, DELETE ON public.monitoring_notices TO authenticated;
GRANT ALL ON public.monitoring_notices TO service_role;
ALTER TABLE public.monitoring_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read published scoped monitoring notices"
ON public.monitoring_notices
FOR SELECT TO authenticated
USING (
  public.mfa_ok()
  AND (
    public.has_role(auth.uid(), 'super')
    OR (
      public.has_role(auth.uid(), 'district')
      AND EXISTS (
        SELECT 1 FROM public.upazilas AS upazila
        WHERE upazila.id = monitoring_notices.upazila_id
          AND upazila.district_en = public.current_district()
      )
    )
    OR (
      public.has_role(auth.uid(), 'uno')
      AND monitoring_notices.upazila_id = public.current_upazila()
    )
    OR (
      public.has_role(auth.uid(), 'admin')
      AND monitoring_notices.upazila_id = public.current_upazila()
      AND (monitoring_notices.union_id IS NULL OR monitoring_notices.union_id = public.current_union())
    )
    OR (
      (public.has_role(auth.uid(), 'worker') OR public.has_role(auth.uid(), 'police'))
      AND monitoring_notices.upazila_id = public.current_upazila()
      AND (monitoring_notices.union_id IS NULL OR monitoring_notices.union_id = public.current_union())
    )
  )
);

CREATE POLICY "publish scoped monitoring notices"
ON public.monitoring_notices
FOR INSERT TO authenticated
WITH CHECK (
  public.mfa_ok()
  AND author_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'super')
    OR (
      public.has_role(auth.uid(), 'district')
      AND union_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.upazilas AS upazila
        WHERE upazila.id = monitoring_notices.upazila_id
          AND upazila.district_en = public.current_district()
      )
    )
    OR (
      public.has_role(auth.uid(), 'uno')
      AND upazila_id = public.current_upazila()
      AND union_id IS NULL
    )
    OR (
      public.has_role(auth.uid(), 'admin')
      AND upazila_id = public.current_upazila()
      AND union_id = public.current_union()
    )
  )
);

CREATE POLICY "authors delete scoped monitoring notices"
ON public.monitoring_notices
FOR DELETE TO authenticated
USING (
  public.mfa_ok()
  AND author_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'super')
    OR (public.has_role(auth.uid(), 'uno') AND upazila_id = public.current_upazila() AND union_id IS NULL)
    OR (public.has_role(auth.uid(), 'admin') AND upazila_id = public.current_upazila() AND union_id = public.current_union())
    OR (
      public.has_role(auth.uid(), 'district')
      AND union_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.upazilas AS upazila
        WHERE upazila.id = monitoring_notices.upazila_id
          AND upazila.district_en = public.current_district()
      )
    )
  )
);