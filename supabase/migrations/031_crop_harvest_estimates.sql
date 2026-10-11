-- RUN_9: harvest estimate history (E1 – crops)
-- A farmer's expected harvest changes with weather, pests and growth. Every estimate is kept as its own row in
-- crop_harvest_estimates, so the history of a crop (date + quantity + why it changed) is never lost.
-- farmer_crops keeps the LATEST estimate for quick display.  Safe to re-run.

CREATE TABLE IF NOT EXISTS public.crop_harvest_estimates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id               UUID NOT NULL REFERENCES public.farmer_crops(id) ON DELETE CASCADE,
  farmer_id             UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  expected_harvest_date DATE NOT NULL,
  expected_quantity_kg  NUMERIC(12, 2) CHECK (expected_quantity_kg IS NULL OR expected_quantity_kg > 0),
  reason                TEXT NOT NULL DEFAULT 'initial_estimate'
                          CHECK (reason IN ('initial_estimate','weather','pests_disease','better_growth','slower_growth','water_shortage','labour_or_cost','market_timing','other')),
  note                  TEXT,
  recorded_by           UUID REFERENCES public.profiles(id),
  recorded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crop_harvest_estimates_crop ON public.crop_harvest_estimates(crop_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_crop_harvest_estimates_farmer ON public.crop_harvest_estimates(farmer_id);

-- All access goes through the backend (service role)
ALTER TABLE public.crop_harvest_estimates ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.crop_harvest_estimates TO postgres, service_role;

-- Record the estimate every existing crop already has as its first history entry
INSERT INTO public.crop_harvest_estimates (crop_id, farmer_id, expected_harvest_date, expected_quantity_kg, reason, note, recorded_by, recorded_at)
SELECT fc.id, fc.farmer_id, fc.expected_harvest_date, fc.expected_quantity_kg, 'initial_estimate', 'Estimate recorded when the crop was registered', fc.created_by, fc.created_at
FROM public.farmer_crops fc
WHERE fc.expected_harvest_date IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.crop_harvest_estimates e WHERE e.crop_id = fc.id);

NOTIFY pgrst, 'reload schema';
