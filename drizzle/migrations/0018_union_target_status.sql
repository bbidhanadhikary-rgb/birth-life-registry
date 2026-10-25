ALTER TABLE public.union_targets
  ADD COLUMN status text NOT NULL DEFAULT 'submitted',
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT union_targets_status_check CHECK (status IN ('draft', 'submitted'));

ALTER TABLE public.union_targets
  DROP CONSTRAINT union_targets_union_id_month_year_key,
  ADD CONSTRAINT union_targets_union_month_status_key
    UNIQUE (union_id, month_year, status);