ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.cases ADD CONSTRAINT cases_details_size CHECK (pg_column_size(details) < 8000);
CREATE OR REPLACE FUNCTION public.guard_case_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(), 'worker') THEN
    IF OLD.created_by <> auth.uid() OR OLD.status = 'completed' THEN
      RAISE EXCEPTION 'Workers may only correct their own unregistered entries';
    END IF;
    IF (NEW.status, NEW.reg_no, NEW.completed_at, NEW.police_task, NEW.files_purged, NEW.created_by, NEW.upazila_id, NEW.union_id, NEW.ward, NEW.created_at, NEW.client_id)
       IS DISTINCT FROM
       (OLD.status, OLD.reg_no, OLD.completed_at, OLD.police_task, OLD.files_purged, OLD.created_by, OLD.upazila_id, OLD.union_id, OLD.ward, OLD.created_at, OLD.client_id) THEN
      RAISE EXCEPTION 'Workers may only correct registration entry fields';
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