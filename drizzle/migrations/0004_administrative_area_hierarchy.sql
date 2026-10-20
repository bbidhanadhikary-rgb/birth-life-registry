CREATE TABLE public.administrative_areas (
  id text PRIMARY KEY,
  level text NOT NULL CHECK (level IN ('division','city_corporation','district','municipality','upazila','union','ward')),
  name_bn text NOT NULL,
  name_en text NOT NULL,
  parent_id text REFERENCES public.administrative_areas(id) ON DELETE CASCADE,
  division_id text REFERENCES public.administrative_areas(id) ON DELETE CASCADE,
  district_id text REFERENCES public.administrative_areas(id) ON DELETE CASCADE,
  city_corporation_id text REFERENCES public.administrative_areas(id) ON DELETE CASCADE,
  municipality_id text REFERENCES public.administrative_areas(id) ON DELETE CASCADE,
  upazila_id text REFERENCES public.upazilas(id) ON DELETE CASCADE,
  union_id text,
  ward_number integer CHECK (ward_number BETWEEN 1 AND 99),
  CHECK ((level = 'division' AND parent_id IS NULL) OR (level <> 'division' AND parent_id IS NOT NULL)),
  CHECK ((level = 'ward') = (ward_number IS NOT NULL)),
  CHECK (
    (level IN ('union', 'municipality') AND union_id IS NOT NULL)
    OR (level NOT IN ('union', 'municipality') AND level <> 'ward' AND union_id IS NULL)
    OR level = 'ward'
  )
);

CREATE INDEX administrative_areas_level_parent_idx ON public.administrative_areas (level, parent_id);
CREATE INDEX administrative_areas_geo_idx ON public.administrative_areas (division_id, district_id, city_corporation_id, municipality_id, upazila_id, union_id, ward_number);

GRANT SELECT ON public.administrative_areas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.administrative_areas TO authenticated;
GRANT ALL ON public.administrative_areas TO service_role;
ALTER TABLE public.administrative_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read administrative area catalog"
  ON public.administrative_areas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "super manages administrative area catalog"
  ON public.administrative_areas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super'))
  WITH CHECK (public.has_role(auth.uid(), 'super'));

CREATE OR REPLACE FUNCTION public.administrative_area_slug(value text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path = public AS $$
  SELECT trim(both '-' from regexp_replace(lower(value), '[^a-z0-9]+', '-', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.sync_upazila_administrative_areas(_upazila_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  area_row public.upazilas%ROWTYPE;
  division_area_id text;
  district_area_id text;
  upazila_area_id text;
  local_area jsonb;
  local_area_id text;
  local_area_level text;
  local_area_name_bn text;
  local_area_name_en text;
  local_union_id text;
  ward integer;
BEGIN
  SELECT * INTO area_row FROM public.upazilas WHERE id = _upazila_id;
  IF NOT FOUND THEN RETURN; END IF;

  division_area_id := 'division:' || public.administrative_area_slug(area_row.division_en);
  district_area_id := 'district:' || public.administrative_area_slug(area_row.division_en) || ':' || public.administrative_area_slug(area_row.district_en);
  upazila_area_id := 'upazila:' || area_row.id;

  INSERT INTO public.administrative_areas (id, level, name_bn, name_en, parent_id, division_id)
  VALUES (division_area_id, 'division', area_row.division_bn, area_row.division_en, NULL, division_area_id)
  ON CONFLICT (id) DO UPDATE SET name_bn = EXCLUDED.name_bn, name_en = EXCLUDED.name_en;

  INSERT INTO public.administrative_areas (id, level, name_bn, name_en, parent_id, division_id, district_id)
  VALUES (district_area_id, 'district', area_row.district_bn, area_row.district_en, division_area_id, division_area_id, district_area_id)
  ON CONFLICT (id) DO UPDATE SET name_bn = EXCLUDED.name_bn, name_en = EXCLUDED.name_en, parent_id = EXCLUDED.parent_id, division_id = EXCLUDED.division_id;

  INSERT INTO public.administrative_areas (id, level, name_bn, name_en, parent_id, division_id, district_id, upazila_id)
  VALUES (upazila_area_id, 'upazila', area_row.bn, area_row.en, district_area_id, division_area_id, district_area_id, area_row.id)
  ON CONFLICT (id) DO UPDATE SET name_bn = EXCLUDED.name_bn, name_en = EXCLUDED.name_en, parent_id = EXCLUDED.parent_id,
    division_id = EXCLUDED.division_id, district_id = EXCLUDED.district_id, upazila_id = EXCLUDED.upazila_id;

  FOR local_area IN SELECT value FROM jsonb_array_elements(area_row.unions) LOOP
    local_union_id := local_area ->> 'id';
    local_area_name_bn := local_area ->> 'bn';
    local_area_name_en := local_area ->> 'en';
    IF local_union_id IS NULL OR local_area_name_bn IS NULL OR local_area_name_en IS NULL THEN CONTINUE; END IF;

    IF local_area_name_bn LIKE '%পৌরসভা%' OR local_area_name_en ILIKE '%pourashava%' THEN
      local_area_level := 'municipality';
      local_area_id := 'municipality:' || area_row.id || ':' || local_union_id;
    ELSE
      local_area_level := 'union';
      local_area_id := 'union:' || area_row.id || ':' || local_union_id;
    END IF;

    INSERT INTO public.administrative_areas (id, level, name_bn, name_en, parent_id, division_id, district_id, municipality_id, upazila_id, union_id)
    VALUES (local_area_id, local_area_level, local_area_name_bn, local_area_name_en, upazila_area_id, division_area_id, district_area_id,
      CASE WHEN local_area_level = 'municipality' THEN local_area_id ELSE NULL END, area_row.id, local_union_id)
    ON CONFLICT (id) DO UPDATE SET level = EXCLUDED.level, name_bn = EXCLUDED.name_bn, name_en = EXCLUDED.name_en,
      parent_id = EXCLUDED.parent_id, division_id = EXCLUDED.division_id, district_id = EXCLUDED.district_id,
      municipality_id = EXCLUDED.municipality_id, upazila_id = EXCLUDED.upazila_id, union_id = EXCLUDED.union_id;

    FOR ward IN 1..9 LOOP
      INSERT INTO public.administrative_areas (id, level, name_bn, name_en, parent_id, division_id, district_id, municipality_id, upazila_id, union_id, ward_number)
      VALUES ('ward:' || area_row.id || ':' || local_union_id || ':' || ward, 'ward', 'ওয়ার্ড ' || ward, 'Ward ' || ward, local_area_id,
        division_area_id, district_area_id, CASE WHEN local_area_level = 'municipality' THEN local_area_id ELSE NULL END,
        area_row.id, local_union_id, ward)
      ON CONFLICT (id) DO UPDATE SET name_bn = EXCLUDED.name_bn, name_en = EXCLUDED.name_en, parent_id = EXCLUDED.parent_id,
        division_id = EXCLUDED.division_id, district_id = EXCLUDED.district_id, municipality_id = EXCLUDED.municipality_id,
        upazila_id = EXCLUDED.upazila_id, union_id = EXCLUDED.union_id, ward_number = EXCLUDED.ward_number;
    END LOOP;
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION public.sync_upazila_administrative_areas(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_upazila_administrative_areas(text) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_upazila_administrative_areas_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_upazila_administrative_areas(NEW.id);
  RETURN NEW;
END
$$;

CREATE TRIGGER sync_upazila_administrative_areas
AFTER INSERT OR UPDATE OF bn, en, district_bn, district_en, division_bn, division_en, unions
ON public.upazilas
FOR EACH ROW EXECUTE FUNCTION public.sync_upazila_administrative_areas_trigger();

DO $$
DECLARE area_row record;
BEGIN
  FOR area_row IN SELECT id FROM public.upazilas LOOP
    PERFORM public.sync_upazila_administrative_areas(area_row.id);
  END LOOP;
END
$$;