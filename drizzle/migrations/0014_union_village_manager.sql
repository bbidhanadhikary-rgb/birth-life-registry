CREATE OR REPLACE FUNCTION public.save_union_villages(_union_id text, _villages jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_villages jsonb;
  updated_rows integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin')
    OR NOT public.mfa_ok()
    OR _union_id IS DISTINCT FROM public.current_union()
  THEN
    RAISE EXCEPTION 'Not authorized to manage villages for this union';
  END IF;

  IF _villages IS NULL OR jsonb_typeof(_villages) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Village list must be a JSON array';
  END IF;

  IF jsonb_array_length(_villages) < 1 OR jsonb_array_length(_villages) > 500 THEN
    RAISE EXCEPTION 'Village list must contain between 1 and 500 villages';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_villages) AS village(value)
    WHERE jsonb_typeof(village.value) <> 'object'
      OR length(btrim(COALESCE(village.value ->> 'id', ''))) NOT BETWEEN 1 AND 100
      OR length(btrim(COALESCE(village.value ->> 'bn', ''))) NOT BETWEEN 1 AND 160
      OR length(btrim(COALESCE(village.value ->> 'en', ''))) NOT BETWEEN 1 AND 160
      OR length(btrim(COALESCE(village.value ->> 'poBn', ''))) NOT BETWEEN 1 AND 160
      OR length(btrim(COALESCE(village.value ->> 'poEn', ''))) NOT BETWEEN 1 AND 160
      OR COALESCE(village.value ->> 'ward', '') !~ '^[1-9][0-9]?$'
  ) THEN
    RAISE EXCEPTION 'Village details are invalid';
  END IF;

  IF EXISTS (
    SELECT village.value ->> 'id'
    FROM jsonb_array_elements(_villages) AS village(value)
    GROUP BY village.value ->> 'id'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Village IDs must be unique';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', btrim(village.value ->> 'id'),
      'bn', btrim(village.value ->> 'bn'),
      'en', btrim(village.value ->> 'en'),
      'ward', (village.value ->> 'ward')::integer,
      'poBn', btrim(village.value ->> 'poBn'),
      'poEn', btrim(village.value ->> 'poEn')
    )
    ORDER BY village.ordinality
  )
  INTO normalized_villages
  FROM jsonb_array_elements(_villages) WITH ORDINALITY AS village(value, ordinality);

  UPDATE public.upazilas AS upazila
  SET unions = (
    SELECT jsonb_agg(
      CASE
        WHEN item.value ->> 'id' = _union_id
          THEN jsonb_set(item.value, '{villages}', normalized_villages, true)
        ELSE item.value
      END
      ORDER BY item.ordinality
    )
    FROM jsonb_array_elements(upazila.unions) WITH ORDINALITY AS item(value, ordinality)
  )
  WHERE upazila.id = public.current_upazila()
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(upazila.unions) AS assigned_union(value)
      WHERE assigned_union.value ->> 'id' = _union_id
    );

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> 1 THEN
    RAISE EXCEPTION 'Assigned union was not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_union_villages(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_union_villages(text, jsonb) TO authenticated;
