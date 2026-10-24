CREATE TABLE public.union_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  union_id text NOT NULL,
  union_name text NOT NULL CHECK (char_length(btrim(union_name)) BETWEEN 1 AND 160),
  birth_target integer NOT NULL DEFAULT 56 CHECK (birth_target >= 0),
  death_target integer NOT NULL DEFAULT 18 CHECK (death_target >= 0),
  month_year date NOT NULL CHECK (month_year = date_trunc('month', month_year)::date),
  UNIQUE (union_id, month_year)
);

CREATE INDEX union_targets_month_union_idx ON public.union_targets (month_year, union_id);
GRANT SELECT, INSERT, UPDATE ON public.union_targets TO authenticated;
GRANT ALL ON public.union_targets TO service_role;
ALTER TABLE public.union_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read scoped union targets" ON public.union_targets
FOR SELECT TO authenticated USING (
  public.mfa_ok()
  AND (
    public.has_role(auth.uid(), 'super')
    OR (
      public.has_role(auth.uid(), 'district')
      AND EXISTS (
        SELECT 1
        FROM public.upazilas AS upazila
        CROSS JOIN LATERAL jsonb_array_elements(upazila.unions) AS area(value)
        WHERE upazila.district_en = public.current_district()
          AND area.value ->> 'id' = union_targets.union_id
      )
    )
    OR (
      public.has_role(auth.uid(), 'uno')
      AND EXISTS (
        SELECT 1
        FROM public.upazilas AS upazila
        CROSS JOIN LATERAL jsonb_array_elements(upazila.unions) AS area(value)
        WHERE upazila.id = public.current_upazila()
          AND area.value ->> 'id' = union_targets.union_id
      )
    )
    OR (
      union_id = public.current_union()
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'worker')
        OR public.has_role(auth.uid(), 'police')
      )
    )
  )
);

CREATE POLICY "manage own union targets" ON public.union_targets
FOR INSERT TO authenticated WITH CHECK (
  public.mfa_ok()
  AND (
    (public.has_role(auth.uid(), 'super'))
    OR (
      public.has_role(auth.uid(), 'admin')
      AND union_id = public.current_union()
    )
    OR (
      public.has_role(auth.uid(), 'uno')
      AND EXISTS (
        SELECT 1
        FROM public.upazilas AS upazila
        CROSS JOIN LATERAL jsonb_array_elements(upazila.unions) AS area(value)
        WHERE upazila.id = public.current_upazila()
          AND area.value ->> 'id' = union_targets.union_id
      )
    )
  )
);

CREATE POLICY "update own union targets" ON public.union_targets
FOR UPDATE TO authenticated
USING (
  public.mfa_ok()
  AND (
    public.has_role(auth.uid(), 'super')
    OR (
      public.has_role(auth.uid(), 'admin')
      AND union_id = public.current_union()
    )
    OR (
      public.has_role(auth.uid(), 'uno')
      AND EXISTS (
        SELECT 1
        FROM public.upazilas AS upazila
        CROSS JOIN LATERAL jsonb_array_elements(upazila.unions) AS area(value)
        WHERE upazila.id = public.current_upazila()
          AND area.value ->> 'id' = union_targets.union_id
      )
    )
  )
)
WITH CHECK (
  public.mfa_ok()
  AND (
    public.has_role(auth.uid(), 'super')
    OR (
      public.has_role(auth.uid(), 'admin')
      AND union_id = public.current_union()
    )
    OR (
      public.has_role(auth.uid(), 'uno')
      AND EXISTS (
        SELECT 1
        FROM public.upazilas AS upazila
        CROSS JOIN LATERAL jsonb_array_elements(upazila.unions) AS area(value)
        WHERE upazila.id = public.current_upazila()
          AND area.value ->> 'id' = union_targets.union_id
      )
    )
  )
);

CREATE POLICY "union target mfa gate"
ON public.union_targets AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.mfa_ok())
WITH CHECK (public.mfa_ok());

INSERT INTO public.union_targets (union_id, union_name, birth_target, death_target, month_year)
SELECT
  area.value ->> 'id',
  COALESCE(NULLIF(area.value ->> 'bn', ''), area.value ->> 'en', area.value ->> 'id'),
  56,
  18,
  date_trunc('month', now() AT TIME ZONE 'Asia/Dhaka')::date
FROM public.upazilas AS upazila
CROSS JOIN LATERAL jsonb_array_elements(upazila.unions) AS area(value)
WHERE NULLIF(area.value ->> 'id', '') IS NOT NULL
ON CONFLICT (union_id, month_year) DO NOTHING;
