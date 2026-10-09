import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';

let running = false;
let lastRun = 0;

/**
 * Moves auctions through their time-driven states:
 *   scheduled  → open    when start_at has been reached (lots open for bidding at the same time)
 *   open       → closed  when end_at has passed (close_auction() determines the winners / reserve-not-met)
 * Without this, a scheduled auction would never accept bids and an ended one would never close.
 *
 * `minIntervalMs` lets request handlers call it cheaply: it is skipped if it ran very recently.
 */
export async function syncAuctionStatuses(minIntervalMs = 0): Promise<void> {
  const now = Date.now();
  if (running || now - lastRun < minIntervalMs) return;
  running = true;
  lastRun = now;
  try {
    const nowIso = new Date(now).toISOString();

    const { data: toOpen } = await supabaseAdmin.from('auctions').select('id')
      .eq('status', 'scheduled').lte('start_at', nowIso).gt('end_at', nowIso);
    for (const a of toOpen ?? []) {
      const { count } = await supabaseAdmin.from('auction_lots').select('id', { count: 'exact', head: true }).eq('auction_id', a.id);
      if (!count) continue; // nothing to bid on – stay scheduled until a lot is added
      await supabaseAdmin.from('auctions').update({ status: 'open' }).eq('id', a.id).eq('status', 'scheduled');
      await supabaseAdmin.from('auction_lots').update({ lot_status: 'open' }).eq('auction_id', a.id).in('lot_status', ['draft', 'published']);
      logger.info(`Auction ${a.id} opened automatically`);
    }

    const { data: toClose } = await supabaseAdmin.from('auctions').select('id')
      .eq('status', 'open').lte('end_at', nowIso);
    for (const a of toClose ?? []) {
      const { error } = await supabaseAdmin.rpc('close_auction', { p_auction_id: a.id });
      if (error) logger.warn(`Auto-close of auction ${a.id} failed: ${error.message}`);
      else logger.info(`Auction ${a.id} closed automatically`);
    }
  } catch (err: any) {
    logger.warn(`Auction scheduler error: ${err?.message}`);
  } finally {
    running = false;
  }
}

export function startAuctionScheduler(everyMs = 30_000): NodeJS.Timeout {
  void syncAuctionStatuses();
  return setInterval(() => void syncAuctionStatuses(), everyMs);
}
