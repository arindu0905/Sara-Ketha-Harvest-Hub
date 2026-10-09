-- ============================================================
-- Migration 022: Inspection Evidence Images
-- Stores evidence photos captured during quality inspections
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inspection_evidence_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id   UUID NOT NULL REFERENCES public.quality_inspections(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,               -- URL or storage bucket path
  file_name       TEXT NOT NULL DEFAULT 'evidence',
  caption         TEXT,                        -- Optional description e.g. "Top layer damage"
  image_type      TEXT NOT NULL DEFAULT 'general'  -- general | defect | label | packaging
                    CHECK (image_type IN ('general','defect','label','packaging','rejected_area')),
  sort_order      INT  NOT NULL DEFAULT 0,
  uploaded_by     UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by inspection
CREATE INDEX IF NOT EXISTS idx_inspection_evidence_inspection_id
  ON public.inspection_evidence_images(inspection_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.inspection_evidence_images ENABLE ROW LEVEL SECURITY;

-- Staff roles can insert evidence
CREATE POLICY "staff_insert_evidence" ON public.inspection_evidence_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('quality_inspector','collection_centre_officer','administrator','inventory_manager')
    )
  );

-- Anyone authenticated can view evidence (farmers & buyers can see inspection images)
CREATE POLICY "authenticated_view_evidence" ON public.inspection_evidence_images
  FOR SELECT
  TO authenticated
  USING (true);

-- Uploader or admin can delete
CREATE POLICY "uploader_delete_evidence" ON public.inspection_evidence_images
  FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'administrator'
    )
  );

GRANT SELECT, INSERT, DELETE ON public.inspection_evidence_images TO authenticated;
