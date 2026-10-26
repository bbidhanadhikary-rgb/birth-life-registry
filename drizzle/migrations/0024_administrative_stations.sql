CREATE TABLE public.administrative_stations (
  upazila_id text NOT NULL REFERENCES public.upazilas(id) ON DELETE CASCADE,
  station_id text NOT NULL,
  district_id text NOT NULL REFERENCES public.administrative_areas(id),
  name_bn text NOT NULL,
  name_en text NOT NULL,
  station_type text NOT NULL CHECK (station_type IN ('union', 'paurashava')),
  PRIMARY KEY (upazila_id, station_id)
);

CREATE INDEX administrative_stations_district_idx
  ON public.administrative_stations (district_id, upazila_id, station_type);

GRANT SELECT ON public.administrative_stations TO anon, authenticated;
GRANT ALL ON public.administrative_stations TO service_role;
ALTER TABLE public.administrative_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read administrative station catalog"
  ON public.administrative_stations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "super manages administrative station catalog"
  ON public.administrative_stations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super'))
  WITH CHECK (public.has_role(auth.uid(), 'super'));

CREATE OR REPLACE FUNCTION public.sync_upazila_stations(_upazila_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  area_row public.upazilas%ROWTYPE;
  district_area_id text;
  station jsonb;
  station_id_value text;
  station_name_bn text;
  station_name_en text;
  station_type_value text;
BEGIN
  SELECT * INTO area_row FROM public.upazilas WHERE id = _upazila_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT district_id INTO district_area_id
  FROM public.administrative_areas
  WHERE level = 'upazila' AND upazila_id = _upazila_id
  LIMIT 1;

  IF district_area_id IS NULL THEN
    RAISE EXCEPTION 'Administrative district mapping missing for upazila %', _upazila_id;
  END IF;

  FOR station IN SELECT value FROM jsonb_array_elements(area_row.unions) LOOP
    station_id_value := station ->> 'id';
    station_name_bn := station ->> 'bn';
    station_name_en := station ->> 'en';
    IF station_id_value IS NULL OR station_name_bn IS NULL OR station_name_en IS NULL THEN
      CONTINUE;
    END IF;

    station_type_value :=
      CASE
        WHEN station_name_bn LIKE '%পৌরসভা%' OR station_name_en ILIKE '%pourashava%'
          THEN 'paurashava'
        ELSE 'union'
      END;

    INSERT INTO public.administrative_stations (
      upazila_id, station_id, district_id, name_bn, name_en, station_type
    )
    VALUES (
      _upazila_id, station_id_value, district_area_id, station_name_bn, station_name_en, station_type_value
    )
    ON CONFLICT (upazila_id, station_id) DO UPDATE
      SET district_id = EXCLUDED.district_id,
          name_bn = EXCLUDED.name_bn,
          name_en = EXCLUDED.name_en,
          station_type = EXCLUDED.station_type;
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION public.sync_upazila_stations(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_upazila_stations(text) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_upazila_stations_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_upazila_stations(NEW.id);
  RETURN NEW;
END
$$;

CREATE TRIGGER sync_upazila_stations
AFTER INSERT OR UPDATE OF bn, en, district_bn, district_en, division_bn, division_en, unions
ON public.upazilas
FOR EACH ROW EXECUTE FUNCTION public.sync_upazila_stations_trigger();

DO $$
DECLARE area_row record;
BEGIN
  FOR area_row IN SELECT id FROM public.upazilas LOOP
    PERFORM public.sync_upazila_stations(area_row.id);
  END LOOP;
END
$$;

ALTER TABLE public.cases
  ADD COLUMN district_id text,
  ADD COLUMN station_id text;

UPDATE public.cases AS registration
SET station_id = registration.union_id,
    district_id = upazila_area.district_id
FROM public.administrative_areas AS upazila_area
WHERE upazila_area.level = 'upazila'
  AND upazila_area.upazila_id = registration.upazila_id;

ALTER TABLE public.cases
  ALTER COLUMN district_id SET NOT NULL,
  ALTER COLUMN station_id SET NOT NULL,
  ADD CONSTRAINT cases_district_id_fkey
    FOREIGN KEY (district_id) REFERENCES public.administrative_areas(id),
  ADD CONSTRAINT cases_station_scope_fkey
    FOREIGN KEY (upazila_id, station_id)
    REFERENCES public.administrative_stations(upazila_id, station_id),
  ADD CONSTRAINT cases_station_matches_union
    CHECK (station_id = union_id);

CREATE INDEX cases_geo_station_scope_idx
  ON public.cases (district_id, upazila_id, station_id, ward);

CREATE OR REPLACE FUNCTION public.set_case_station_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  station_district_id text;
BEGIN
  SELECT station.district_id INTO station_district_id
  FROM public.administrative_stations AS station
  WHERE station.upazila_id = NEW.upazila_id
    AND station.station_id = NEW.union_id;

  IF station_district_id IS NULL THEN
    RAISE EXCEPTION 'Station % is not registered in upazila %', NEW.union_id, NEW.upazila_id;
  END IF;

  NEW.station_id := NEW.union_id;
  NEW.district_id := station_district_id;
  RETURN NEW;
END
$$;

CREATE TRIGGER set_case_station_scope
BEFORE INSERT OR UPDATE OF upazila_id, union_id, station_id, district_id
ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.set_case_station_scope();

ALTER TABLE public.profiles ADD COLUMN station_id text;

UPDATE public.profiles
SET station_id = union_id
WHERE union_id IS NOT NULL AND upazila_id IS NOT NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_station_scope_fkey
    FOREIGN KEY (upazila_id, station_id)
    REFERENCES public.administrative_stations(upazila_id, station_id),
  ADD CONSTRAINT profiles_station_matches_union
    CHECK (station_id IS NOT DISTINCT FROM union_id);

CREATE INDEX profiles_station_scope_idx
  ON public.profiles (district_id, upazila_id, station_id);

CREATE OR REPLACE FUNCTION public.set_profile_station_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.station_id := NEW.union_id;
  RETURN NEW;
END
$$;

CREATE TRIGGER set_profile_station_scope
BEFORE INSERT OR UPDATE OF upazila_id, union_id, station_id
ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_profile_station_scope();
