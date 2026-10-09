import { createClient } from '@supabase/supabase-js';
import { config } from './config';

// Admin client with full access (server-side only)
export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Anon client for user-context operations
export const supabaseClient = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

// Create a client scoped to a specific user JWT
export const createUserClient = (userJwt: string) =>
  createClient(config.supabase.url, config.supabase.anonKey, {
    global: {
      headers: { Authorization: `Bearer ${userJwt}` },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

/**
 * A throw-away client for sign-in / refresh / password-reset calls.
 *
 * IMPORTANT: never call signInWithPassword / refreshSession on `supabaseAdmin`. supabase-js keeps the signed-in
 * user's session on the client and then sends THEIR token with every later query, so the API would silently lose its
 * service-role privileges (row-level security would start applying, e.g. "new row violates row-level security policy").
 */
export const createAuthClient = () =>
  createClient(config.supabase.url, config.supabase.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
