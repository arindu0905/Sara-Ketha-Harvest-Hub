import { supabaseAdmin } from '../config/supabase';

async function test() {
  const sql = `
CREATE OR REPLACE FUNCTION public.update_batch_available_qty()
RETURNS TRIGGER AS $$
DECLARE
  v_batch_id UUID;
  v_reserved DECIMAL(12,3);
  v_sold     DECIMAL(12,3);
  v_wasted   DECIMAL(12,3);
  v_initial  DECIMAL(12,3);
BEGIN
  IF TG_TABLE_NAME = 'inventory_batches' THEN
    v_batch_id := NEW.id;
  ELSE
    BEGIN
      v_batch_id := NEW.batch_id;
    EXCEPTION WHEN OTHERS THEN
      v_batch_id := NEW.id;
    END;
  END IF;

  IF v_batch_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT initial_qty_kg, reserved_qty_kg, sold_qty_kg, wasted_qty_kg
  INTO v_initial, v_reserved, v_sold, v_wasted
  FROM public.inventory_batches
  WHERE id = v_batch_id;

  IF v_initial IS NOT NULL THEN
    UPDATE public.inventory_batches
    SET available_qty_kg = GREATEST(0, v_initial - COALESCE(v_reserved, 0) - COALESCE(v_sold, 0) - COALESCE(v_wasted, 0))
    WHERE id = v_batch_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_batch_qty ON public.inventory_batches;
`;

  try {
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql });
    console.log('RPC exec_sql result:', { data, error });
  } catch (err) {
    console.error('RPC error:', err);
  }
}

test();
