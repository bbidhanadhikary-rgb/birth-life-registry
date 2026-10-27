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
  death_total_count bigint,
  target_present boolean
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
    COALESCE((SELECT target.birth_target FROM public.registration_targets target
      WHERE target.upazila_id = assigned_upazila_id AND target.union_id = assigned_station_id
        AND target.month_year = _month_year AND target.status = 'submitted'), 0)::integer,
    COALESCE((SELECT target.death_target FROM public.registration_targets target
      WHERE target.upazila_id = assigned_upazila_id AND target.union_id = assigned_station_id
        AND target.month_year = _month_year AND target.status = 'submitted'), 0)::integer,
    (SELECT count(*) FROM public.cases registration
      WHERE registration.upazila_id = assigned_upazila_id AND registration.station_id = assigned_station_id
        AND registration.created_at >= month_start AND registration.created_at < month_end
        AND registration.type = 'birth' AND registration.status = 'pending'),
    (SELECT count(*) FROM public.cases registration
      WHERE registration.upazila_id = assigned_upazila_id AND registration.station_id = assigned_station_id
        AND registration.created_at >= month_start AND registration.created_at < month_end
        AND registration.type = 'birth' AND registration.status = 'progress'),
    (SELECT count(*) FROM public.cases completed_registration
      WHERE completed_registration.upazila_id = assigned_upazila_id AND completed_registration.station_id = assigned_station_id
        AND completed_registration.status = 'completed' AND completed_registration.type = 'birth'
        AND COALESCE(completed_registration.completed_at, completed_registration.created_at) >= month_start
        AND COALESCE(completed_registration.completed_at, completed_registration.created_at) < month_end),
    (SELECT count(*) FROM public.cases registration
      WHERE registration.upazila_id = assigned_upazila_id AND registration.station_id = assigned_station_id
        AND registration.created_at >= month_start AND registration.created_at < month_end
        AND registration.type = 'birth'),
    (SELECT count(*) FROM public.cases registration
      WHERE registration.upazila_id = assigned_upazila_id AND registration.station_id = assigned_station_id
        AND registration.created_at >= month_start AND registration.created_at < month_end
        AND registration.type = 'death' AND registration.status = 'pending'),
    (SELECT count(*) FROM public.cases registration
      WHERE registration.upazila_id = assigned_upazila_id AND registration.station_id = assigned_station_id
        AND registration.created_at >= month_start AND registration.created_at < month_end
        AND registration.type = 'death' AND registration.status = 'progress'),
    (SELECT count(*) FROM public.cases completed_registration
      WHERE completed_registration.upazila_id = assigned_upazila_id AND completed_registration.station_id = assigned_station_id
        AND completed_registration.status = 'completed' AND completed_registration.type = 'death'
        AND COALESCE(completed_registration.completed_at, completed_registration.created_at) >= month_start
        AND COALESCE(completed_registration.completed_at, completed_registration.created_at) < month_end),
    (SELECT count(*) FROM public.cases registration
      WHERE registration.upazila_id = assigned_upazila_id AND registration.station_id = assigned_station_id
        AND registration.created_at >= month_start AND registration.created_at < month_end
        AND registration.type = 'death'),
    EXISTS (SELECT 1 FROM public.registration_targets target
      WHERE target.upazila_id = assigned_upazila_id AND target.union_id = assigned_station_id
        AND target.month_year = _month_year AND target.status = 'submitted');
END
$$;

REVOKE ALL ON FUNCTION public.station_monthly_dashboard_metrics(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.station_monthly_dashboard_metrics(date) TO authenticated;
