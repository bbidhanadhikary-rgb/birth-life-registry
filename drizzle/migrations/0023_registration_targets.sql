ALTER TABLE public.union_targets RENAME TO registration_targets;

ALTER TABLE public.registration_targets
  ADD COLUMN upazila_id text;

UPDATE public.registration_targets AS target
SET upazila_id = upazila.id
FROM public.upazilas AS upazila
CROSS JOIN LATERAL jsonb_array_elements(upazila.unions) AS area(value)
WHERE area.value ->> 'id' = target.union_id;

ALTER TABLE public.registration_targets
  ALTER COLUMN upazila_id SET NOT NULL,
  ADD CONSTRAINT registration_targets_upazila_id_fkey
    FOREIGN KEY (upazila_id) REFERENCES public.upazilas(id) ON DELETE CASCADE;

DROP POLICY "read scoped union targets" ON public.registration_targets;
DROP POLICY "manage own union targets" ON public.registration_targets;
DROP POLICY "update own union targets" ON public.registration_targets;
DROP POLICY "union target mfa gate" ON public.registration_targets;

ALTER TABLE public.registration_targets
  DROP CONSTRAINT union_targets_union_month_status_key,
  RENAME CONSTRAINT union_targets_status_check TO registration_targets_status_check,
  ADD CONSTRAINT registration_targets_upazila_union_month_status_key
    UNIQUE (upazila_id, union_id, month_year, status);

DROP INDEX public.union_targets_month_union_idx;
CREATE INDEX registration_targets_month_scope_idx
  ON public.registration_targets (upazila_id, month_year, union_id);

CREATE POLICY "read scoped registration targets"
ON public.registration_targets
FOR SELECT TO authenticated
USING (
  public.mfa_ok()
  AND (
    public.has_role(auth.uid(), 'super')
    OR (
      public.has_role(auth.uid(), 'district')
      AND EXISTS (
        SELECT 1
        FROM public.upazilas AS upazila
        WHERE upazila.id = registration_targets.upazila_id
          AND upazila.district_en = public.current_district()
      )
    )
    OR (
      public.has_role(auth.uid(), 'uno')
      AND registration_targets.upazila_id = public.current_upazila()
    )
    OR (
      registration_targets.upazila_id = public.current_upazila()
      AND registration_targets.union_id = public.current_union()
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'worker')
        OR public.has_role(auth.uid(), 'police')
      )
    )
  )
);

CREATE POLICY "uno manages scoped registration targets"
ON public.registration_targets
FOR INSERT TO authenticated
WITH CHECK (
  public.mfa_ok()
  AND (
    public.has_role(auth.uid(), 'super')
    OR (
      public.has_role(auth.uid(), 'uno')
      AND registration_targets.upazila_id = public.current_upazila()
      AND EXISTS (
        SELECT 1
        FROM public.upazilas AS upazila
        CROSS JOIN LATERAL jsonb_array_elements(upazila.unions) AS area(value)
        WHERE upazila.id = registration_targets.upazila_id
          AND area.value ->> 'id' = registration_targets.union_id
      )
    )
  )
);

CREATE POLICY "uno updates scoped registration targets"
ON public.registration_targets
FOR UPDATE TO authenticated
USING (
  public.mfa_ok()
  AND (
    public.has_role(auth.uid(), 'super')
    OR (
      public.has_role(auth.uid(), 'uno')
      AND registration_targets.upazila_id = public.current_upazila()
    )
  )
)
WITH CHECK (
  public.mfa_ok()
  AND (
    public.has_role(auth.uid(), 'super')
    OR (
      public.has_role(auth.uid(), 'uno')
      AND registration_targets.upazila_id = public.current_upazila()
      AND EXISTS (
        SELECT 1
        FROM public.upazilas AS upazila
        CROSS JOIN LATERAL jsonb_array_elements(upazila.unions) AS area(value)
        WHERE upazila.id = registration_targets.upazila_id
          AND area.value ->> 'id' = registration_targets.union_id
      )
    )
  )
);

CREATE POLICY "registration target mfa gate"
ON public.registration_targets AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.mfa_ok())
WITH CHECK (public.mfa_ok());
