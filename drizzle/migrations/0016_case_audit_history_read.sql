CREATE FUNCTION public.case_history(p_case_id uuid)
RETURNS TABLE (
  at timestamptz,
  id bigint,
  action text,
  user_id uuid,
  role text,
  status_from text,
  status_to text,
  client_hint text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.cases c
    WHERE c.id = p_case_id
      AND (
        public.has_role(auth.uid(), 'super')
        OR (
          public.has_role(auth.uid(), 'district')
          AND EXISTS (
            SELECT 1
            FROM public.upazilas u
            WHERE u.id = c.upazila_id
              AND u.district_en = public.current_district()
          )
        )
        OR (
          c.upazila_id = public.current_upazila()
          AND (
            public.has_role(auth.uid(), 'uno')
            OR (
              c.union_id = public.current_union()
              AND (
                public.has_role(auth.uid(), 'admin')
                OR (
                  public.has_role(auth.uid(), 'police')
                  AND c.ward = public.current_ward()
                )
                OR c.created_by = auth.uid()
              )
            )
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Not authorized to read this case history';
  END IF;

  RETURN QUERY
  SELECT
    a.at,
    a.id,
    a.action,
    a.user_id,
    a.details ->> 'role',
    a.details -> 'status' ->> 0,
    a.details -> 'status' ->> 1,
    a.details ->> 'client_hint'
  FROM public.audit_logs a
  WHERE a.case_id = p_case_id
    AND (
      a.action IN ('update', 'remark')
      OR a.action LIKE 'create:%'
    )
  ORDER BY a.at;
END;
$$;

REVOKE ALL ON FUNCTION public.case_history(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.case_history(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_case()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  field_changes jsonb;
  request_headers jsonb :=
    COALESCE(NULLIF(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  user_agent text := lower(COALESCE(request_headers ->> 'user-agent', ''));
  client_hint text;
BEGIN
  client_hint := CASE
    WHEN user_agent ~ '(android|iphone|ipod|mobile)' THEN 'Mobile web'
    WHEN user_agent ~ '(ipad|tablet)' THEN 'Tablet web'
    ELSE 'Web browser'
  END;

  IF TG_TABLE_NAME = 'cases' AND TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs(user_id, action, case_id, details)
    VALUES (
      auth.uid(),
      'create:' || NEW.type,
      NEW.id,
      jsonb_build_object('client_hint', client_hint)
    );
  ELSIF TG_TABLE_NAME = 'cases' THEN
    SELECT COALESCE(
      jsonb_object_agg(
        old_field.key,
        jsonb_build_object('old', old_field.value, 'new', new_field.value)
      ),
      '{}'::jsonb
    )
    INTO field_changes
    FROM jsonb_each(to_jsonb(OLD)) AS old_field(key, value)
    JOIN jsonb_each(to_jsonb(NEW)) AS new_field(key, value)
      USING (key)
    WHERE old_field.value IS DISTINCT FROM new_field.value
      AND old_field.key IN (
        'name_bn', 'name_en', 'father_bn', 'father_en', 'mother_bn', 'mother_en',
        'nid', 'parent_mobile', 'gender', 'dob', 'child_order', 'dod',
        'cause_bn', 'cause_en', 'village_id', 'details', 'status', 'reg_no',
        'police_task'
      );

    INSERT INTO public.audit_logs(user_id, action, case_id, details)
    VALUES (
      auth.uid(),
      'update',
      NEW.id,
      jsonb_build_object(
        'status', jsonb_build_array(OLD.status, NEW.status),
        'reg_no', NEW.reg_no,
        'police_task', NEW.police_task,
        'changes', field_changes,
        'client_hint', client_hint
      )
    );
  ELSE
    INSERT INTO public.audit_logs(user_id, action, case_id, details)
    VALUES (
      auth.uid(),
      'remark',
      NEW.case_id,
      jsonb_build_object('role', NEW.role, 'client_hint', client_hint)
    );
  END IF;
  RETURN NEW;
END
$$;
