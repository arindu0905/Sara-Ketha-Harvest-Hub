-- RUN_4: inspection evidence photos (E2-US6)
-- The table from migration 022 does not exist in this database yet, so evidence photos could not be saved.
-- Run this once in the Supabase SQL editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.inspection_evidence_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id   UUID NOT NULL REFERENCES public.quality_inspections(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,
  file_name       TEXT NOT NULL DEFAULT 'evidence',
  caption         TEXT,
  image_type      TEXT NOT NULL DEFAULT 'general'
                    CHECK (image_type IN ('general','defect','label','packaging','rejected_area')),
  sort_order      INT  NOT NULL DEFAULT 0,
  uploaded_by     UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_evidence_inspection_id
  ON public.inspection_evidence_images(inspection_id);

-- All access goes through the backend (service role); RLS on with no policies blocks direct access.
ALTER TABLE public.inspection_evidence_images ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.inspection_evidence_images TO postgres, service_role;

-- Public bucket for the photos (the report shows them through their public URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence-images', 'evidence-images', true)
ON CONFLICT (id) DO NOTHING;

-- Make PostgREST see the new table immediately
NOTIFY pgrst, 'reload schema';
