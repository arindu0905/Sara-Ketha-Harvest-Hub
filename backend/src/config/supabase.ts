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
