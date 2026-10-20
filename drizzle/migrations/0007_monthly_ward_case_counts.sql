CREATE OR REPLACE FUNCTION public.monthly_ward_case_counts()
RETURNS TABLE (
  pending_count bigint,
  progress_count bigint,
  completed_count bigint,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE c.status = 'pending'),
    count(*) FILTER (WHERE c.status = 'progress'),
    count(*) FILTER (WHERE c.status = 'completed'),
    count(*)
  FROM public.cases AS c
  WHERE c.created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Dhaka') AT TIME ZONE 'Asia/Dhaka'
    AND c.created_at < (date_trunc('month', now() AT TIME ZONE 'Asia/Dhaka') + interval '1 month') AT TIME ZONE 'Asia/Dhaka'
    AND public.mfa_ok()
    AND (
      (public.has_role(auth.uid(), 'uno') AND c.upazila_id = public.current_upazila())
      OR (
        public.has_role(auth.uid(), 'admin')
        AND c.upazila_id = public.current_upazila()
        AND c.union_id = public.current_union()
      )
      OR (
        (public.has_role(auth.uid(), 'worker') OR public.has_role(auth.uid(), 'police'))
        AND c.upazila_id = public.current_upazila()
        AND c.union_id = public.current_union()
        AND c.ward = public.current_ward()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.monthly_ward_case_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.monthly_ward_case_counts() TO authenticated;