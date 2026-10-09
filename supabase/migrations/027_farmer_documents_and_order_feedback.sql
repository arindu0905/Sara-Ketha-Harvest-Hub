-- Migration 027: Farmer documents storage bucket (Epic 1) + buyer order feedback (Epic 3)
-- Safe to re-run. The farmer_documents table already exists from migration 001
-- (document_type, file_name, storage_path, file_size, mime_type, uploaded_at, uploaded_by, is_verified).

-- Private bucket: documents are sensitive and served via short-lived signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('farmer-documents', 'farmer-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ── Buyer feedback on orders ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL UNIQUE REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  buyer_id        UUID NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  rating          INT  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  quality_rating  INT  CHECK (quality_rating  BETWEEN 1 AND 5),
  delivery_rating INT  CHECK (delivery_rating BETWEEN 1 AND 5),
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_feedback_buyer ON public.order_feedback(buyer_id);
-- All access goes through the backend (service role); RLS on with no policies blocks direct access.
ALTER TABLE public.order_feedback ENABLE ROW LEVEL SECURITY;
