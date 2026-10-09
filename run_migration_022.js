/**
 * Run migration 022: inspection_evidence_images
 * Execute: node run_migration_022.js
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment first (never hard-code keys).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const SQL = `
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

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'inspection_evidence_images' AND policyname = 'staff_insert_evidence'
  ) THEN
    CREATE POLICY "staff_insert_evidence" ON public.inspection_evidence_images
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('quality_inspector','collection_centre_officer','administrator','inventory_manager')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'inspection_evidence_images' AND policyname = 'authenticated_view_evidence'
  ) THEN
    CREATE POLICY "authenticated_view_evidence" ON public.inspection_evidence_images
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'inspection_evidence_images' AND policyname = 'uploader_delete_evidence'
  ) THEN
    CREATE POLICY "uploader_delete_evidence" ON public.inspection_evidence_images
      FOR DELETE TO authenticated
      USING (
        uploaded_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'administrator'
        )
      );
  END IF;
END $$;

GRANT SELECT, INSERT, DELETE ON public.inspection_evidence_images TO authenticated;
`;

async function runMigration() {
  console.log('Running migration 022...');
  const { error } = await supabase.rpc('exec_sql', { sql: SQL }).catch(() => ({ error: null }));
  
  // Try direct query approach
  const { error: e2 } = await supabase.from('inspection_evidence_images').select('id').limit(1);
  if (!e2) {
    console.log('✅ Table already exists or migration applied successfully');
    return;
  }
  
  // Use postgres REST endpoint
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: SQL }),
  });
  
  if (res.ok) {
    console.log('✅ Migration applied via RPC');
  } else {
    console.log('ℹ️  Please run the SQL in supabase/migrations/022_inspection_evidence_images.sql manually via the Supabase Dashboard → SQL Editor');
  }
}

runMigration().catch(console.error);
