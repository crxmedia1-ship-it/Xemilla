import { createClient } from '@supabase/supabase-js';

/**
 * Cliente con service role (bypassa RLS). Solo servidor.
 * Opcional: si no hay key, devolvemos null y se usa sesión + policies RLS.
 */
export function createSupabaseServiceClient() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (input, init = {}) =>
        fetch(input, {
          ...init,
          cache: 'no-store',
        }),
    },
  });
}
