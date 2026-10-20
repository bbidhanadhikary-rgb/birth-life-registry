ALTER TABLE public.cases ALTER COLUMN nid DROP NOT NULL;
ALTER TABLE public.cases DROP CONSTRAINT cases_nid_check;
ALTER TABLE public.cases ADD CONSTRAINT cases_nid_valid_by_type CHECK (
  (type = 'death' AND nid ~ '^(\d{10}|\d{13}|\d{17})$')
  OR (type = 'birth' AND (nid IS NULL OR nid ~ '^(\d{10}|\d{13}|\d{17})$'))
);

CREATE UNIQUE INDEX cases_birth_no_nid_unique
  ON public.cases (
    upazila_id,
    union_id,
    ward,
    lower(name_bn),
    lower(name_en),
    dob,
    lower(father_bn),
    lower(father_en),
    lower(mother_bn),
    lower(mother_en),
    coalesce(child_order, '')
  )
  WHERE type = 'birth' AND nid IS NULL;