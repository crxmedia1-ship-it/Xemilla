import { createClient } from '@supabase/supabase-js';

/**
 * Cliente público de Supabase (anon key).
 * Usar solo para lectura del menú / ficha del restaurante.
 *
 * Auth del Dashboard: `src/lib/supabase/server.js` (SSR) y
 * `src/lib/supabase/browser.js` (login en el cliente).
 */
export const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
);
