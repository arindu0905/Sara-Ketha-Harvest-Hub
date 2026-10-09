import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../middleware/auth';

/** Farmer record id for the logged-in user (null if the user is not a farmer / has no record). */
export async function getFarmerIdForUser(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('farmers').select('id').eq('profile_id', userId).maybeSingle();
  return data?.id ?? null;
}

/** Buyer record id for the logged-in user. */
export async function getBuyerIdForProfile(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('buyers').select('id').eq('profile_id', userId).maybeSingle();
  return data?.id ?? null;
}

/** Farmers may only touch their own records; staff roles are unrestricted. */
export async function assertFarmerAccess(req: AuthenticatedRequest, farmerId: string): Promise<void> {
  if (req.user?.role !== 'farmer') return;
  const own = await getFarmerIdForUser(req.user.id);
  if (!own || own !== farmerId) throw new AppError('You can only access your own records', 403);
}

/** Buyers may only touch their own records. */
export async function assertBuyerAccess(req: AuthenticatedRequest, buyerId: string): Promise<void> {
  if (req.user?.role !== 'buyer') return;
  const own = await getBuyerIdForProfile(req.user.id);
  if (!own || own !== buyerId) throw new AppError('You can only access your own records', 403);
}
