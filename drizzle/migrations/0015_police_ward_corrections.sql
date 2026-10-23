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
        union_id = public.current_union()
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

CREATE POLICY "police correct pending cases in assigned ward" ON public.cases
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'police')
    AND upazila_id = public.current_upazila()
    AND union_id = public.current_union()
    AND ward = public.current_ward()
    AND status NOT IN ('completed', 'rejected')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'police')
    AND upazila_id = public.current_upazila()
    AND union_id = public.current_union()
    AND ward = public.current_ward()
    AND status NOT IN ('completed', 'rejected')
  );

CREATE OR REPLACE FUNCTION public.guard_case_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(), 'worker') THEN
    IF OLD.created_by <> auth.uid() OR OLD.status IN ('completed', 'rejected') THEN
      RAISE EXCEPTION 'Workers may only correct their own unregistered entries';
    END IF;
    IF (NEW.status, NEW.reg_no, NEW.completed_at, NEW.police_task, NEW.files_purged, NEW.created_by, NEW.upazila_id, NEW.union_id, NEW.ward, NEW.created_at, NEW.client_id)
       IS DISTINCT FROM
       (OLD.status, OLD.reg_no, OLD.completed_at, OLD.police_task, OLD.files_purged, OLD.created_by, OLD.upazila_id, OLD.union_id, OLD.ward, OLD.created_at, OLD.client_id) THEN
      RAISE EXCEPTION 'Workers may only correct registration entry fields';
    END IF;
  ELSIF public.has_role(auth.uid(), 'police') THEN
    IF OLD.upazila_id <> public.current_upazila()
      OR OLD.union_id <> public.current_union()
      OR OLD.ward <> public.current_ward()
      OR OLD.status IN ('completed', 'rejected')
    THEN
      RAISE EXCEPTION 'Village police may only correct open cases in their assigned ward';
    END IF;
    IF (NEW.status, NEW.reg_no, NEW.completed_at, NEW.police_task, NEW.files_purged, NEW.created_by, NEW.upazila_id, NEW.union_id, NEW.ward, NEW.created_at, NEW.client_id)
       IS DISTINCT FROM
       (OLD.status, OLD.reg_no, OLD.completed_at, OLD.police_task, OLD.files_purged, OLD.created_by, OLD.upazila_id, OLD.union_id, OLD.ward, OLD.created_at, OLD.client_id) THEN
      RAISE EXCEPTION 'Village police may only correct case details';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.upazilas u
      CROSS JOIN LATERAL jsonb_array_elements(u.unions) AS assigned_union(value)
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(assigned_union.value -> 'villages', '[]'::jsonb)) AS assigned_village(value)
      WHERE u.id = NEW.upazila_id
        AND assigned_union.value ->> 'id' = NEW.union_id
        AND assigned_village.value ->> 'id' = NEW.village_id
        AND (assigned_village.value ->> 'ward')::integer = public.current_ward()
    ) THEN
      RAISE EXCEPTION 'Village police may only select a village in their assigned ward';
    END IF;
  ELSE
    IF (NEW.type, NEW.name_bn, NEW.name_en, NEW.father_bn, NEW.father_en, NEW.mother_bn, NEW.mother_en, NEW.nid, NEW.gender, NEW.dob,
        NEW.child_order, NEW.dod, NEW.cause_bn, NEW.cause_en, NEW.village_id, NEW.parent_mobile, NEW.files, NEW.files_purged, NEW.created_by,
        NEW.upazila_id, NEW.union_id, NEW.ward, NEW.created_at, NEW.client_id, NEW.details)
       IS DISTINCT FROM
       (OLD.type, OLD.name_bn, OLD.name_en, OLD.father_bn, OLD.father_en, OLD.mother_bn, OLD.mother_en, OLD.nid, OLD.gender, OLD.dob,
        OLD.child_order, OLD.dod, OLD.cause_bn, OLD.cause_en, OLD.village_id, OLD.parent_mobile, OLD.files, OLD.files_purged, OLD.created_by,
        OLD.upazila_id, OLD.union_id, OLD.ward, OLD.created_at, OLD.client_id, OLD.details) THEN
      RAISE EXCEPTION 'Original worker inputs cannot be modified by this role';
    END IF;
    IF NOT public.has_role(auth.uid(), 'admin') AND (NEW.status, NEW.reg_no, NEW.completed_at) IS DISTINCT FROM (OLD.status, OLD.reg_no, OLD.completed_at) THEN
      RAISE EXCEPTION 'Only administrative officers can change registration status';
    END IF;
  END IF;
  IF NEW.status = 'completed' THEN
    IF NEW.reg_no IS NULL OR NEW.reg_no !~ '^\d{17}$' THEN
      RAISE EXCEPTION 'A 17-digit government registration number is required';
    END IF;
    IF OLD.status <> 'completed' THEN NEW.completed_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;

DROP POLICY "police upload own area case files" ON storage.objects;
CREATE POLICY "police upload own ward correction files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'case-files'
    AND public.has_role(auth.uid(), 'police')
    AND (storage.foldername(name))[1] = public.current_upazila()
    AND (storage.foldername(name))[2] = public.current_union()
    AND EXISTS (
      SELECT 1
      FROM public.cases c
      WHERE c.id::text = (storage.foldername(name))[3]
        AND c.upazila_id = public.current_upazila()
        AND c.union_id = public.current_union()
        AND c.ward = public.current_ward()
        AND c.status NOT IN ('completed', 'rejected')
    )
  );

CREATE POLICY "police replace attachments in assigned ward" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'case-files'
    AND public.has_role(auth.uid(), 'police')
    AND (storage.foldername(name))[1] = public.current_upazila()
    AND (storage.foldername(name))[2] = public.current_union()
    AND EXISTS (
      SELECT 1
      FROM public.cases c
      WHERE c.id::text = (storage.foldername(name))[3]
        AND c.upazila_id = public.current_upazila()
        AND c.union_id = public.current_union()
        AND c.ward = public.current_ward()
        AND c.status NOT IN ('completed', 'rejected')
    )
  );
