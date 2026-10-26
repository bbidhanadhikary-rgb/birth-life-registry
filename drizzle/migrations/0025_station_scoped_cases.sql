CREATE OR REPLACE FUNCTION public.current_station()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT station_id
  FROM public.profiles
  WHERE id = auth.uid() AND active
$$;

DROP POLICY "scoped case read" ON public.cases;
CREATE POLICY "scoped case read" ON public.cases FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'super')
  OR (
    public.has_role(auth.uid(), 'district')
    AND EXISTS (
      SELECT 1
      FROM public.upazilas u
      WHERE u.id = cases.upazila_id
        AND u.district_en = public.current_district()
    )
  )
  OR (
    upazila_id = public.current_upazila()
    AND (
      public.has_role(auth.uid(), 'uno')
      OR (
        station_id = public.current_station()
        AND union_id = public.current_station()
        AND (
          public.has_role(auth.uid(), 'admin')
          OR (
            public.has_role(auth.uid(), 'police')
            AND ward = public.current_ward()
          )
          OR created_by = auth.uid()
        )
      )
    )
  )
);

DROP POLICY "workers create" ON public.cases;
CREATE POLICY "workers create" ON public.cases FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'worker')
  AND created_by = auth.uid()
  AND upazila_id = public.current_upazila()
  AND station_id = public.current_station()
  AND union_id = public.current_station()
  AND ward = public.current_ward()
  AND status = 'pending'
  AND reg_no IS NULL
  AND police_task IS NULL
);

DROP POLICY "police create own area cases" ON public.cases;
CREATE POLICY "police create own area cases" ON public.cases
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'police')
    AND created_by = auth.uid()
    AND upazila_id = public.current_upazila()
    AND station_id = public.current_station()
    AND union_id = public.current_station()
    AND ward = public.current_ward()
    AND status = 'pending'
    AND reg_no IS NULL
    AND police_task IS NULL
  );

DROP POLICY "admin or police update" ON public.cases;
CREATE POLICY "admin or police update" ON public.cases FOR UPDATE TO authenticated
  USING (
    upazila_id = public.current_upazila()
    AND station_id = public.current_station()
    AND union_id = public.current_station()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (public.has_role(auth.uid(), 'police') AND ward = public.current_ward() AND police_task IS NOT NULL)
    )
  )
  WITH CHECK (
    upazila_id = public.current_upazila()
    AND station_id = public.current_station()
    AND union_id = public.current_station()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (public.has_role(auth.uid(), 'police') AND ward = public.current_ward() AND police_task IS NOT NULL)
    )
  );

DROP POLICY "workers correct own pending cases" ON public.cases;
CREATE POLICY "workers correct own pending cases" ON public.cases FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'worker')
    AND created_by = auth.uid()
    AND upazila_id = public.current_upazila()
    AND station_id = public.current_station()
    AND union_id = public.current_station()
    AND status NOT IN ('completed', 'rejected')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'worker')
    AND created_by = auth.uid()
    AND upazila_id = public.current_upazila()
    AND station_id = public.current_station()
    AND union_id = public.current_station()
    AND ward = public.current_ward()
    AND status NOT IN ('completed', 'rejected')
  );

DROP POLICY "police correct pending cases in assigned ward" ON public.cases;
CREATE POLICY "police correct pending cases in assigned ward" ON public.cases
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'police')
    AND upazila_id = public.current_upazila()
    AND station_id = public.current_station()
    AND union_id = public.current_station()
    AND ward = public.current_ward()
    AND status NOT IN ('completed', 'rejected')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'police')
    AND upazila_id = public.current_upazila()
    AND station_id = public.current_station()
    AND union_id = public.current_station()
    AND ward = public.current_ward()
    AND status NOT IN ('completed', 'rejected')
  );
