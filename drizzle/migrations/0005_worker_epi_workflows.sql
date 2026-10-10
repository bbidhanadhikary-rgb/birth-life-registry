ALTER TABLE public.cases
  ADD COLUMN parent_mobile text
    CHECK (parent_mobile IS NULL OR parent_mobile ~ '^01[3-9][0-9]{8}$');

CREATE TABLE public.epi_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name_bn text NOT NULL CHECK (char_length(child_name_bn) BETWEEN 1 AND 100),
  child_name_en text NOT NULL CHECK (char_length(child_name_en) BETWEEN 1 AND 100),
  parent_mobile text NOT NULL CHECK (parent_mobile ~ '^01[3-9][0-9]{8}$'),
  village_id text NOT NULL,
  upazila_id text NOT NULL,
  union_id text NOT NULL,
  ward integer NOT NULL,
  attended_at timestamptz NOT NULL DEFAULT now(),
  registration_case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX epi_visits_worker_pending_idx
  ON public.epi_visits (created_by, attended_at DESC)
  WHERE registration_case_id IS NULL;

ALTER TABLE public.epi_visits ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.epi_visits TO authenticated;
GRANT ALL ON public.epi_visits TO service_role;
CREATE POLICY "epi visit privileged mfa gate"
  ON public.epi_visits AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.mfa_ok())
  WITH CHECK (public.mfa_ok());

CREATE POLICY "scoped epi visit read"
  ON public.epi_visits FOR SELECT TO authenticated USING (
    (public.has_role(auth.uid(), 'worker') AND created_by = auth.uid())
    OR (upazila_id = public.current_upazila() AND (
      public.has_role(auth.uid(), 'uno')
      OR (union_id = public.current_union() AND public.has_role(auth.uid(), 'admin'))
    ))
  );

CREATE POLICY "workers record epi visits"
  ON public.epi_visits FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'worker')
    AND created_by = auth.uid()
    AND upazila_id = public.current_upazila()
    AND union_id = public.current_union()
    AND ward = public.current_ward()
    AND registration_case_id IS NULL
  );

CREATE OR REPLACE FUNCTION public.guard_assigned_village()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.upazilas u
    CROSS JOIN LATERAL jsonb_array_elements(u.unions) AS assigned_union(value)
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(assigned_union.value -> 'villages', '[]'::jsonb)
    ) AS assigned_village(value)
    WHERE u.id = NEW.upazila_id
      AND assigned_union.value ->> 'id' = NEW.union_id
      AND assigned_village.value ->> 'id' = NEW.village_id
  ) THEN
    RAISE EXCEPTION 'Village must belong to the assigned union and upazila';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER cases_validate_assigned_village
BEFORE INSERT OR UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.guard_assigned_village();

CREATE TRIGGER epi_visits_validate_assigned_village
BEFORE INSERT ON public.epi_visits
FOR EACH ROW EXECUTE FUNCTION public.guard_assigned_village();

CREATE POLICY "workers replace attachments on own pending cases"
  ON storage.objects FOR DELETE TO authenticated USING (
    bucket_id = 'case-files'
    AND public.has_role(auth.uid(), 'worker')
    AND (storage.foldername(name))[1] = public.current_upazila()
    AND (storage.foldername(name))[2] = public.current_union()
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id::text = (storage.foldername(name))[3]
        AND c.created_by = auth.uid()
        AND c.status <> 'completed'
    )
  );

CREATE OR REPLACE FUNCTION public.guard_case_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'worker') THEN
    IF OLD.created_by <> auth.uid() OR OLD.status = 'completed' THEN
      RAISE EXCEPTION 'Workers may only correct their own unregistered entries';
    END IF;
    IF (NEW.status, NEW.reg_no, NEW.completed_at, NEW.police_task,
        NEW.files_purged, NEW.created_by, NEW.upazila_id, NEW.union_id,
        NEW.ward, NEW.created_at, NEW.client_id)
       IS DISTINCT FROM
       (OLD.status, OLD.reg_no, OLD.completed_at, OLD.police_task,
        OLD.files_purged, OLD.created_by, OLD.upazila_id, OLD.union_id,
        OLD.ward, OLD.created_at, OLD.client_id) THEN
      RAISE EXCEPTION 'Workers may only correct registration entry fields';
    END IF;
  ELSE
    IF (NEW.type, NEW.name_bn, NEW.name_en, NEW.father_bn, NEW.father_en,
        NEW.mother_bn, NEW.mother_en, NEW.nid, NEW.gender, NEW.dob,
        NEW.child_order, NEW.dod, NEW.cause_bn, NEW.cause_en, NEW.village_id,
        NEW.parent_mobile, NEW.files, NEW.files_purged, NEW.created_by,
        NEW.upazila_id, NEW.union_id, NEW.ward, NEW.created_at, NEW.client_id)
       IS DISTINCT FROM
       (OLD.type, OLD.name_bn, OLD.name_en, OLD.father_bn, OLD.father_en,
        OLD.mother_bn, OLD.mother_en, OLD.nid, OLD.gender, OLD.dob,
        OLD.child_order, OLD.dod, OLD.cause_bn, OLD.cause_en, OLD.village_id,
        OLD.parent_mobile, OLD.files, OLD.files_purged, OLD.created_by,
        OLD.upazila_id, OLD.union_id, OLD.ward, OLD.created_at, OLD.client_id) THEN
      RAISE EXCEPTION 'Original worker inputs cannot be modified by this role';
    END IF;
    IF NOT public.has_role(auth.uid(), 'admin')
       AND (NEW.status, NEW.reg_no, NEW.completed_at)
           IS DISTINCT FROM (OLD.status, OLD.reg_no, OLD.completed_at) THEN
      RAISE EXCEPTION 'Only administrative officers can change registration status';
    END IF;
  END IF;

  IF NEW.status = 'completed' THEN
    IF NEW.reg_no IS NULL OR NEW.reg_no !~ '^\d{17}$' THEN
      RAISE EXCEPTION 'A 17-digit government registration number is required';
    END IF;
    IF OLD.status <> 'completed' THEN
      NEW.completed_at := now();
    END IF;
  END IF;

  RETURN NEW;
END
$$;

CREATE POLICY "workers correct own pending cases"
  ON public.cases FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'worker')
    AND created_by = auth.uid()
    AND status <> 'completed'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'worker')
    AND created_by = auth.uid()
    AND upazila_id = public.current_upazila()
    AND union_id = public.current_union()
    AND ward = public.current_ward()
    AND status <> 'completed'
  );

CREATE OR REPLACE FUNCTION public.link_epi_visits_to_birth_case()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'birth' AND NEW.parent_mobile IS NOT NULL THEN
    UPDATE public.epi_visits
    SET registration_case_id = NEW.id
    WHERE parent_mobile = NEW.parent_mobile
      AND upazila_id = NEW.upazila_id
      AND union_id = NEW.union_id
      AND (child_name_bn = NEW.name_bn OR lower(child_name_en) = lower(NEW.name_en))
      AND registration_case_id IS NULL;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER cases_link_epi_visits
AFTER INSERT OR UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.link_epi_visits_to_birth_case();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'case_remarks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.case_remarks;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cases'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cases;
  END IF;
END
$$;
