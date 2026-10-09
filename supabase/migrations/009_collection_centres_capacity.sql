-- ============================================================
-- HarvestHub Database Migration 009: Add capacity_kg to collection_centres
-- ============================================================

ALTER TABLE public.collection_centres 
  ADD COLUMN IF NOT EXISTS capacity_kg DECIMAL(15, 2);
