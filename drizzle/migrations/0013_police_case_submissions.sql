CREATE POLICY "police create own area cases" ON public.cases
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'police')
    AND created_by = auth.uid()
    AND upazila_id = public.current_upazila()
    AND union_id = public.current_union()
    AND ward = public.current_ward()
    AND status = 'pending'
    AND reg_no IS NULL
    AND police_task IS NULL
  );

CREATE POLICY "police upload own area case files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'case-files'
    AND public.has_role(auth.uid(), 'police')
    AND (storage.foldername(name))[1] = public.current_upazila()
    AND (storage.foldername(name))[2] = public.current_union()
  );
