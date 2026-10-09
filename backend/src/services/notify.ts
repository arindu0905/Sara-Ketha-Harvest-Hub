import { supabaseAdmin } from '../config/supabase';
import { sendEmail } from './email';

/** Fire-and-forget notification insert. Never throws – notifications must not break business flows. */
export async function notifyUser(
  recipientProfileId: string | null | undefined,
  type: string,
  title: string,
  message: string,
  entityType?: string,
  entityId?: string
): Promise<void> {
  if (!recipientProfileId) return;
  try {
    await supabaseAdmin.from('notifications').insert({
      recipient_id: recipientProfileId,
      type,
      title,
      message,
      related_entity_type: entityType ?? null,
      related_entity_id: entityId ?? null,
    });
    const { data: p } = await supabaseAdmin.from('profiles').select('email').eq('id', recipientProfileId).maybeSingle();
    void sendEmail(p?.email, title, message);
  } catch {
    /* swallow */
  }
}

/** Notify every active user holding `role`. */
export async function notifyRole(
  role: string,
  type: string,
  title: string,
  message: string,
  entityType?: string,
  entityId?: string
): Promise<void> {
  try {
    const { data } = await supabaseAdmin.from('profiles').select('id, email').eq('role', role).eq('account_status', 'active');
    if (!data?.length) return;
    await supabaseAdmin.from('notifications').insert(
      data.map((p: any) => ({
        recipient_id: p.id, type, title, message,
        related_entity_type: entityType ?? null, related_entity_id: entityId ?? null,
      }))
    );
    data.forEach((p: any) => void sendEmail(p.email, title, message));
  } catch {
    /* swallow */
  }
}
