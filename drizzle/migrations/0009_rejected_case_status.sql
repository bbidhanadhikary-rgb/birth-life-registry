ALTER TABLE public.cases DROP CONSTRAINT cases_status_check;
ALTER TABLE public.cases
  ADD CONSTRAINT cases_status_check
  CHECK (status IN ('pending', 'progress', 'completed', 'rejected'));

DROP POLICY "workers correct own pending cases" ON public.cases;
CREATE POLICY "workers correct own pending cases" ON public.cases FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'worker')
    AND created_by = auth.uid()
    AND status NOT IN ('completed', 'rejected')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'worker')
    AND created_by = auth.uid()
    AND upazila_id = public.current_upazila()
    AND union_id = public.current_union()
    AND ward = public.current_ward()
    AND status NOT IN ('completed', 'rejected')
  );