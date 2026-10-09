-- Migration 014: Patch for E2-US3, US4, US5 (Weighing, Pending Inspections, Quality Rejections)

-- 1. Ensure collection_status enum has 'pending_inspection'
ALTER TYPE collection_status ADD VALUE IF NOT EXISTS 'pending_inspection';

-- 2. Add container fields to produce_collections
ALTER TABLE public.produce_collections 
ADD COLUMN IF NOT EXISTS container_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS container_type TEXT;

-- 3. Ensure rejection_reason enum has extra values if needed
ALTER TYPE rejection_reason ADD VALUE IF NOT EXISTS 'fungal_infection';
ALTER TYPE rejection_reason ADD VALUE IF NOT EXISTS 'pesticide_residue';
