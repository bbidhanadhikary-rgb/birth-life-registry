CREATE TYPE public.app_role AS ENUM ('worker','admin','police','uno','super');

-- Areas
CREATE TABLE public.upazilas (
  id text PRIMARY KEY,
  bn text NOT NULL, en text NOT NULL,
  district_bn text NOT NULL, district_en text NOT NULL,
  division_bn text NOT NULL DEFAULT '', division_en text NOT NULL DEFAULT '',
  unions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.upazilas TO authenticated;
GRANT ALL ON public.upazilas TO service_role;
ALTER TABLE public.upazilas ENABLE ROW LEVEL SECURITY;

-- Staff profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name_bn text NOT NULL, name_en text NOT NULL,
  mobile text, email text,
  upazila_id text REFERENCES public.upazilas(id),
  union_id text, ward int,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.current_upazila() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT upazila_id FROM public.profiles WHERE id = auth.uid() AND active
$$;
CREATE OR REPLACE FUNCTION public.current_union() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT union_id FROM public.profiles WHERE id = auth.uid() AND active
$$;
CREATE OR REPLACE FUNCTION public.current_ward() RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ward FROM public.profiles WHERE id = auth.uid() AND active
$$;

CREATE POLICY "read areas" ON public.upazilas FOR SELECT TO authenticated USING (true);
CREATE POLICY "super adds areas" ON public.upazilas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'super'));
CREATE POLICY "super edits areas" ON public.upazilas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'super'));

CREATE POLICY "scoped profiles" ON public.profiles FOR SELECT TO authenticated USING (
  id = auth.uid()
  OR public.has_role(auth.uid(),'super')
  OR (public.has_role(auth.uid(),'uno') AND upazila_id = public.current_upazila())
  OR (public.has_role(auth.uid(),'admin') AND upazila_id = public.current_upazila() AND union_id = public.current_union())
);
CREATE POLICY "scoped roles" ON public.user_roles FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(),'super')
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_roles.user_id AND p.upazila_id = public.current_upazila()
     AND (public.has_role(auth.uid(),'uno') OR (public.has_role(auth.uid(),'admin') AND p.union_id = public.current_union())))
);

-- Registration records
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text UNIQUE,
  type text NOT NULL CHECK (type IN ('birth','death')),
  name_bn text NOT NULL, name_en text NOT NULL,
  father_bn text NOT NULL, father_en text NOT NULL,
  mother_bn text NOT NULL, mother_en text NOT NULL,
  nid text NOT NULL CHECK (nid ~ '^(\d{10}|\d{13}|\d{17})$'),
  gender text NOT NULL CHECK (gender IN ('male','female','other')),
  dob date NOT NULL, child_order text, dod date, cause_bn text, cause_en text,
  village_id text NOT NULL,
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  files_purged boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','progress','completed')),
  reg_no text,
  police_task jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  upazila_id text NOT NULL, union_id text NOT NULL, ward int NOT NULL DEFAULT 1,
  sms_sent boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE UNIQUE INDEX cases_birth_unique ON public.cases (nid, coalesce(child_order,'')) WHERE type = 'birth';
CREATE UNIQUE INDEX cases_death_unique ON public.cases (nid) WHERE type = 'death';
CREATE INDEX cases_scope_idx ON public.cases (upazila_id, union_id, ward);
GRANT SELECT, INSERT, UPDATE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoped case read" ON public.cases FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'super')
  OR (upazila_id = public.current_upazila() AND (
       public.has_role(auth.uid(),'uno')
    OR (union_id = public.current_union() AND (
         public.has_role(auth.uid(),'admin')
      OR (public.has_role(auth.uid(),'police') AND ward = public.current_ward() AND police_task IS NOT NULL)
      OR created_by = auth.uid())))));
CREATE POLICY "workers create" ON public.cases FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'worker') AND created_by = auth.uid()
  AND upazila_id = public.current_upazila() AND union_id = public.current_union() AND ward = public.current_ward()
  AND status = 'pending' AND reg_no IS NULL AND police_task IS NULL);
CREATE POLICY "admin or police update" ON public.cases FOR UPDATE TO authenticated USING (
  upazila_id = public.current_upazila() AND union_id = public.current_union() AND (
    public.has_role(auth.uid(),'admin')
    OR (public.has_role(auth.uid(),'police') AND ward = public.current_ward() AND police_task IS NOT NULL)));

-- Column-level guard: original worker inputs are immutable; each role may change only its fields
CREATE OR REPLACE FUNCTION public.guard_case_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF; -- system/service maintenance
  IF (NEW.type, NEW.name_bn, NEW.name_en, NEW.father_bn, NEW.father_en, NEW.mother_bn, NEW.mother_en, NEW.nid, NEW.gender,
      NEW.dob, NEW.child_order, NEW.dod, NEW.cause_bn, NEW.cause_en, NEW.village_id, NEW.files, NEW.files_purged,
      NEW.created_by, NEW.upazila_id, NEW.union_id, NEW.ward, NEW.created_at, NEW.client_id)
     IS DISTINCT FROM
     (OLD.type, OLD.name_bn, OLD.name_en, OLD.father_bn, OLD.father_en, OLD.mother_bn, OLD.mother_en, OLD.nid, OLD.gender,
      OLD.dob, OLD.child_order, OLD.dod, OLD.cause_bn, OLD.cause_en, OLD.village_id, OLD.files, OLD.files_purged,
      OLD.created_by, OLD.upazila_id, OLD.union_id, OLD.ward, OLD.created_at, OLD.client_id) THEN
    RAISE EXCEPTION 'Original entry fields cannot be modified';
  END IF;
  IF NOT public.has_role(auth.uid(),'admin') THEN
    IF (NEW.status, NEW.reg_no, NEW.completed_at) IS DISTINCT FROM (OLD.status, OLD.reg_no, OLD.completed_at) THEN
      RAISE EXCEPTION 'Only administrative officers can change status';
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
CREATE TRIGGER cases_guard BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.guard_case_update();

-- Remarks
CREATE TABLE public.case_remarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  author uuid NOT NULL DEFAULT auth.uid(),
  role public.app_role NOT NULL,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.case_remarks TO authenticated;
GRANT ALL ON public.case_remarks TO service_role;
ALTER TABLE public.case_remarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read remarks of visible cases" ON public.case_remarks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id));
CREATE POLICY "admin/uno add remarks" ON public.case_remarks FOR INSERT TO authenticated WITH CHECK (
  author = auth.uid() AND role IN ('admin','uno') AND public.has_role(auth.uid(), role)
  AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id));

-- Audit trail (invisible to everyone except super admin)
CREATE TABLE public.audit_logs (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  user_id uuid, action text NOT NULL, case_id uuid, details jsonb
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super reads audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'super'));

CREATE OR REPLACE FUNCTION public.audit_case() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'cases' AND TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs(user_id, action, case_id) VALUES (auth.uid(), 'create:' || NEW.type, NEW.id);
  ELSIF TG_TABLE_NAME = 'cases' THEN
    INSERT INTO public.audit_logs(user_id, action, case_id, details) VALUES (auth.uid(), 'update', NEW.id,
      jsonb_build_object('status', jsonb_build_array(OLD.status, NEW.status), 'reg_no', NEW.reg_no, 'police_task', NEW.police_task));
  ELSE
    INSERT INTO public.audit_logs(user_id, action, case_id, details) VALUES (auth.uid(), 'remark', NEW.case_id, jsonb_build_object('role', NEW.role));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cases_audit AFTER INSERT OR UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.audit_case();
CREATE TRIGGER remarks_audit AFTER INSERT ON public.case_remarks FOR EACH ROW EXECUTE FUNCTION public.audit_case();

-- Sign-in attempts (server-only writes)
CREATE TABLE public.login_attempts (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  identifier text NOT NULL, method text NOT NULL, ip text,
  success boolean NOT NULL, reason text
);
CREATE INDEX login_attempts_idx ON public.login_attempts (identifier, at DESC);
CREATE INDEX login_attempts_ip_idx ON public.login_attempts (ip, at DESC);
GRANT SELECT ON public.login_attempts TO authenticated;
GRANT ALL ON public.login_attempts TO service_role;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super reads attempts" ON public.login_attempts FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'super'));

-- Attachments storage policies (bucket created separately): path = upazila/union/case_id/file
CREATE POLICY "workers upload own area" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'case-files' AND public.has_role(auth.uid(),'worker')
  AND (storage.foldername(name))[1] = public.current_upazila()
  AND (storage.foldername(name))[2] = public.current_union());
CREATE POLICY "read files of visible cases" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'case-files' AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id::text = (storage.foldername(name))[3]));