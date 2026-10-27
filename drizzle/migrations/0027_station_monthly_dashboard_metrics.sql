CREATE TABLE public.station_metric_versions (
  upazila_id text NOT NULL,
  station_id text NOT NULL,
  version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (upazila_id, station_id),
  FOREIGN KEY (upazila_id, station_id)
    REFERENCES public.administrative_stations(upazila_id, station_id)
    ON DELETE CASCADE
);

INSERT INTO public.station_metric_versions (upazila_id, station_id)
SELECT upazila_id, station_id
FROM public.administrative_stations
ON CONFLICT (upazila_id, station_id) DO NOTHING;

ALTER TABLE public.station_metric_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.station_metric_versions FROM PUBLIC, anon;
GRANT SELECT ON public.station_metric_versions TO authenticated;

CREATE POLICY "station staff read their metric version"
ON public.station_metric_versions
FOR SELECT TO authenticated
USING (
  public.mfa_ok()
  AND upazila_id = public.current_upazila()
  AND station_id = public.current_station()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'worker')
    OR public.has_role(auth.uid(), 'police')
  )
);

CREATE OR REPLACE FUNCTION public.bump_station_metric_version(
  _upazila_id text,
  _station_id text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.station_metric_versions (upazila_id, station_id, version, updated_at)
  VALUES (_upazila_id, _station_id, 1, now())
  ON CONFLICT (upazila_id, station_id) DO UPDATE
    SET version = station_metric_versions.version + 1,
        updated_at = EXCLUDED.updated_at
$$;

REVOKE ALL ON FUNCTION public.bump_station_metric_version(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_station_case_metric_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM public.bump_station_metric_version(OLD.upazila_id, OLD.station_id);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM public.bump_station_metric_version(NEW.upazila_id, NEW.station_id);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER notify_station_case_metric_change
AFTER INSERT OR UPDATE OR DELETE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.notify_station_case_metric_change();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'station_metric_versions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.station_metric_versions;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.station_monthly_dashboard_metrics(_month_year date)
RETURNS TABLE (
  birth_target integer,
  death_target integer,
  birth_pending_count bigint,
  birth_progress_count bigint,
  birth_completed_count bigint,
  birth_total_count bigint,
  death_pending_count bigint,
  death_progress_count bigint,
  death_completed_count bigint,
  death_total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_upazila_id text;
  assigned_station_id text;
  month_start timestamptz;
  month_end timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.mfa_ok() THEN
    RAISE EXCEPTION 'Authentication and required MFA are required';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'worker')
    OR public.has_role(auth.uid(), 'police')
  ) THEN
    RAISE EXCEPTION 'Station staff role is required';
  END IF;

  SELECT profile.upazila_id, profile.station_id
  INTO assigned_upazila_id, assigned_station_id
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid()
    AND profile.active;

  IF assigned_upazila_id IS NULL OR assigned_station_id IS NULL THEN
    RAISE EXCEPTION 'An active station assignment is required';
  END IF;
  IF _month_year IS NULL OR _month_year <> date_trunc('month', _month_year)::date THEN
    RAISE EXCEPTION 'Month must be the first day of a valid month';
  END IF;

  month_start := _month_year::timestamp AT TIME ZONE 'Asia/Dhaka';
  month_end := (_month_year + interval '1 month')::timestamp AT TIME ZONE 'Asia/Dhaka';

  RETURN QUERY
  SELECT
    COALESCE(max(target.birth_target), 0)::integer,
    COALESCE(max(target.death_target), 0)::integer,
    count(*) FILTER (WHERE registration.type = 'birth' AND registration.status = 'pending'),
    count(*) FILTER (WHERE registration.type = 'birth' AND registration.status = 'progress'),
    count(*) FILTER (WHERE registration.type = 'birth' AND registration.status = 'completed'),
    count(*) FILTER (WHERE registration.type = 'birth'),
    count(*) FILTER (WHERE registration.type = 'death' AND registration.status = 'pending'),
    count(*) FILTER (WHERE registration.type = 'death' AND registration.status = 'progress'),
    count(*) FILTER (WHERE registration.type = 'death' AND registration.status = 'completed'),
    count(*) FILTER (WHERE registration.type = 'death')
  FROM (SELECT 1) AS singleton
  LEFT JOIN public.registration_targets AS target
    ON target.upazila_id = assigned_upazila_id
    AND target.union_id = assigned_station_id
    AND target.month_year = _month_year
    AND target.status = 'submitted'
  LEFT JOIN public.cases AS registration
    ON registration.upazila_id = assigned_upazila_id
    AND registration.station_id = assigned_station_id
    AND registration.created_at >= month_start
    AND registration.created_at < month_end;
END
$$;

REVOKE ALL ON FUNCTION public.station_monthly_dashboard_metrics(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.station_monthly_dashboard_metrics(date) TO authenticated;
