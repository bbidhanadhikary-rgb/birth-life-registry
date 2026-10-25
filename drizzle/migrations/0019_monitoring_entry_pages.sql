CREATE TABLE public.monitoring_entry_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  entries jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(entries) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX monitoring_entry_pages_owner_updated_idx
  ON public.monitoring_entry_pages (owner_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_entry_pages TO authenticated;
ALTER TABLE public.monitoring_entry_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manage own executive monitoring pages"
ON public.monitoring_entry_pages
FOR ALL TO authenticated
USING (
  public.mfa_ok()
  AND owner_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'uno')
    OR public.has_role(auth.uid(), 'district')
    OR public.has_role(auth.uid(), 'super')
  )
)
WITH CHECK (
  public.mfa_ok()
  AND owner_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'uno')
    OR public.has_role(auth.uid(), 'district')
    OR public.has_role(auth.uid(), 'super')
  )
);

CREATE POLICY "executive monitoring pages require MFA"
ON public.monitoring_entry_pages AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.mfa_ok())
WITH CHECK (public.mfa_ok());