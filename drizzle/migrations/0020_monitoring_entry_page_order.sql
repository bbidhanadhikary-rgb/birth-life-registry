ALTER TABLE public.monitoring_entry_pages
  ADD COLUMN page_number integer,
  ADD COLUMN page_type text NOT NULL DEFAULT 'custom';

WITH numbered_pages AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY owner_id ORDER BY created_at, id)::integer + 5 AS page_number
  FROM public.monitoring_entry_pages
)
UPDATE public.monitoring_entry_pages AS page
SET page_number = numbered_pages.page_number
FROM numbered_pages
WHERE page.id = numbered_pages.id;

ALTER TABLE public.monitoring_entry_pages
  ALTER COLUMN page_number SET NOT NULL,
  ADD CONSTRAINT monitoring_entry_pages_number_check CHECK (page_number > 0),
  ADD CONSTRAINT monitoring_entry_pages_type_check CHECK (page_type IN ('notice', 'custom', 'targets'));

CREATE UNIQUE INDEX monitoring_entry_pages_owner_number_idx
  ON public.monitoring_entry_pages (owner_id, page_number);