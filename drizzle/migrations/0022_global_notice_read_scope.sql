DROP POLICY IF EXISTS "read published scoped monitoring notices"
ON public.monitoring_notices;

CREATE POLICY "read published scoped monitoring notices"
ON public.monitoring_notices
FOR SELECT TO authenticated
USING (
  public.mfa_ok()
  AND (
    public.has_role(auth.uid(), 'super')
    OR public.has_role(auth.uid(), 'district')
    OR (
      monitoring_notices.upazila_id = public.current_upazila()
      AND (
        public.has_role(auth.uid(), 'uno')
        OR (
          public.has_role(auth.uid(), 'admin')
          AND (monitoring_notices.union_id IS NULL OR monitoring_notices.union_id = public.current_union())
        )
        OR (
          (public.has_role(auth.uid(), 'worker') OR public.has_role(auth.uid(), 'police'))
          AND (monitoring_notices.union_id IS NULL OR monitoring_notices.union_id = public.current_union())
        )
      )
    )
  )
);