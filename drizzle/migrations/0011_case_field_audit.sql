CREATE OR REPLACE FUNCTION public.audit_case() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  field_changes jsonb;
BEGIN
  IF TG_TABLE_NAME = 'cases' AND TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs(user_id, action, case_id)
    VALUES (auth.uid(), 'create:' || NEW.type, NEW.id);
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
        'changes', field_changes
      )
    );
  ELSE
    INSERT INTO public.audit_logs(user_id, action, case_id, details)
    VALUES (auth.uid(), 'remark', NEW.case_id, jsonb_build_object('role', NEW.role));
  END IF;
  RETURN NEW;
END
$$;
