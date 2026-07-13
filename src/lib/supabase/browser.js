import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente Supabase para scripts de navegador (login admin).
 * Persistencia en cookies compartidas con el servidor SSR.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  );
}
