/**
 * One-time migration: Creates inspection_evidence_images table
 * Run: cd backend && node -r ts-node/register src/scripts/applyMigration022.ts
 * OR: npx ts-node src/scripts/applyMigration022.ts
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment first (never hard-code keys).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Run each statement individually through the PostgREST rpc endpoint
// Supabase doesn't expose a general SQL executor, so we use the management API
async function applyMigration() {
  console.log('🔄 Applying migration 022: inspection_evidence_images...');

  // Test if table already exists
  const { error: checkErr } = await supabase
    .from('inspection_evidence_images')
    .select('id')
    .limit(1);

  if (!checkErr) {
    console.log('✅ Table inspection_evidence_images already exists. Nothing to do.');
    return;
  }

  console.log('Table does not exist yet. Please run this SQL in the Supabase Dashboard → SQL Editor:');
  console.log('');
  console.log(`=== SQL to run ===`);
  console.log(`
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

ALTER TABLE public.inspection_evidence_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_insert_evidence" ON public.inspection_evidence_images
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('quality_inspector','collection_centre_officer','administrator','inventory_manager')
    )
  );

CREATE POLICY "authenticated_view_evidence" ON public.inspection_evidence_images
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "uploader_delete_evidence" ON public.inspection_evidence_images
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'administrator'
    )
  );

GRANT SELECT, INSERT, DELETE ON public.inspection_evidence_images TO authenticated;
`);
  console.log(`=== END SQL ===`);
  console.log('');
  console.log(`URL: https://supabase.com/dashboard/project/xxgiumwfurzyyzmxsdue/sql/new`);
}

applyMigration().catch(console.error);
