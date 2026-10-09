-- Privileged roles must hold an aal2 (2-step verified) session to touch data
CREATE OR REPLACE FUNCTION public.mfa_ok() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','uno','super'))
      OR coalesce(auth.jwt()->>'aal','aal1') = 'aal2'
$$;
CREATE POLICY "mfa gate" ON public.cases AS RESTRICTIVE FOR ALL TO authenticated USING (public.mfa_ok()) WITH CHECK (public.mfa_ok());
CREATE POLICY "mfa gate" ON public.case_remarks AS RESTRICTIVE FOR ALL TO authenticated USING (public.mfa_ok()) WITH CHECK (public.mfa_ok());
CREATE POLICY "mfa gate" ON public.audit_logs AS RESTRICTIVE FOR ALL TO authenticated USING (public.mfa_ok());
CREATE POLICY "mfa gate" ON public.login_attempts AS RESTRICTIVE FOR ALL TO authenticated USING (public.mfa_ok());
CREATE POLICY "mfa gate write" ON public.upazilas AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.mfa_ok());
CREATE POLICY "mfa gate" ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated USING (id = auth.uid() OR public.mfa_ok());
CREATE POLICY "mfa gate" ON public.user_roles AS RESTRICTIVE FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.mfa_ok());

-- One-time recovery codes (hashed; server-only access)
CREATE TABLE public.mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mfa_recovery_user_idx ON public.mfa_recovery_codes (user_id);
GRANT ALL ON public.mfa_recovery_codes TO service_role;
ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Session review / revoke for the signed-in user only
CREATE OR REPLACE FUNCTION public.list_my_sessions()
RETURNS TABLE (id uuid, created_at timestamptz, updated_at timestamptz, user_agent text, ip text, aal text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT s.id, s.created_at, s.updated_at, s.user_agent, host(s.ip)::text, s.aal::text
  FROM auth.sessions s WHERE s.user_id = auth.uid() ORDER BY s.updated_at DESC NULLS LAST
$$;
CREATE OR REPLACE FUNCTION public.revoke_my_session(_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  DELETE FROM auth.sessions WHERE id = _session_id AND user_id = auth.uid();
  INSERT INTO public.audit_logs(user_id, action, details) VALUES (auth.uid(), 'session:revoke', jsonb_build_object('session', _session_id));
END $$;
REVOKE ALL ON FUNCTION public.list_my_sessions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_my_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_my_session(uuid) TO authenticated;