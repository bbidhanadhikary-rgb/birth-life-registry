ALTER TABLE public.profiles
  ADD COLUMN district_id text;

CREATE OR REPLACE FUNCTION public.current_district() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT district_id FROM public.profiles WHERE id = auth.uid() AND active
$$;

CREATE OR REPLACE FUNCTION public.mfa_ok() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin','district','uno','super')
  ) OR coalesce(auth.jwt()->>'aal','aal1') = 'aal2'
$$;

DROP POLICY "scoped profiles" ON public.profiles;
CREATE POLICY "scoped profiles" ON public.profiles FOR SELECT TO authenticated USING (
  id = auth.uid()
  OR public.has_role(auth.uid(),'super')
  OR (
    public.has_role(auth.uid(),'district')
    AND district_id = public.current_district()
  )
  OR (public.has_role(auth.uid(),'uno') AND upazila_id = public.current_upazila())
  OR (
    public.has_role(auth.uid(),'admin')
    AND upazila_id = public.current_upazila()
    AND union_id = public.current_union()
  )
);

DROP POLICY "scoped roles" ON public.user_roles;
CREATE POLICY "scoped roles" ON public.user_roles FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(),'super')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
      AND (
        (public.has_role(auth.uid(),'district') AND p.district_id = public.current_district())
        OR (public.has_role(auth.uid(),'uno') AND p.upazila_id = public.current_upazila())
        OR (
          public.has_role(auth.uid(),'admin')
          AND p.upazila_id = public.current_upazila()
          AND p.union_id = public.current_union()
        )
      )
  )
);

DROP POLICY "scoped case read" ON public.cases;
CREATE POLICY "scoped case read" ON public.cases FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'super')
  OR (
    public.has_role(auth.uid(),'district')
    AND EXISTS (
      SELECT 1 FROM public.upazilas u
      WHERE u.id = cases.upazila_id
        AND u.district_en = public.current_district()
    )
  )
  OR (
    upazila_id = public.current_upazila()
    AND (
      public.has_role(auth.uid(),'uno')
      OR (
        union_id = public.current_union()
        AND (
          public.has_role(auth.uid(),'admin')
          OR (
            public.has_role(auth.uid(),'police')
            AND ward = public.current_ward()
            AND police_task IS NOT NULL
          )
          OR created_by = auth.uid()
        )
      )
    )
  )
);

CREATE TABLE public.upazila_announcements (
  upazila_id text PRIMARY KEY REFERENCES public.upazilas(id) ON DELETE CASCADE,
  notice_bn text NOT NULL DEFAULT '' CHECK (char_length(notice_bn) <= 500),
  notice_en text NOT NULL DEFAULT '' CHECK (char_length(notice_en) <= 500),
  active boolean NOT NULL DEFAULT true,
  updated_by uuid NOT NULL REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.upazila_announcements ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.upazila_announcements TO anon, authenticated;
GRANT INSERT, UPDATE ON public.upazila_announcements TO authenticated;
GRANT ALL ON public.upazila_announcements TO service_role;

CREATE POLICY "read active scoped announcements" ON public.upazila_announcements
FOR SELECT TO anon, authenticated USING (
  active = true
  OR (
    auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(),'super')
      OR (
        public.has_role(auth.uid(),'uno')
        AND upazila_id = public.current_upazila()
      )
    )
  )
);
CREATE POLICY "uno creates own announcement" ON public.upazila_announcements
FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'uno')
  AND upazila_id = public.current_upazila()
  AND updated_by = auth.uid()
);
CREATE POLICY "uno updates own announcement" ON public.upazila_announcements
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'uno')
  AND upazila_id = public.current_upazila()
)
WITH CHECK (
  public.has_role(auth.uid(),'uno')
  AND upazila_id = public.current_upazila()
  AND updated_by = auth.uid()
);

CREATE OR REPLACE FUNCTION public.touch_upazila_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER upazila_announcement_updated_at
BEFORE UPDATE ON public.upazila_announcements
FOR EACH ROW EXECUTE FUNCTION public.touch_upazila_announcement();

CREATE POLICY "mfa gate" ON public.upazila_announcements
AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.mfa_ok());
CREATE POLICY "mfa gate update" ON public.upazila_announcements
AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.mfa_ok()) WITH CHECK (public.mfa_ok());
