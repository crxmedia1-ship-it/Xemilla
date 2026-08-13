import { createSupabaseServiceClient } from './supabase/service.js';
import { createClient } from '@supabase/supabase-js';

/**
 * Logos públicos de la red (landing).
 * Prefiere service role; si no hay, intenta anon.
 * @returns {Promise<{ id: string, name: string, logoUrl: string }[]>}
 */
export async function listPublicNetworkLogos() {
  const service = createSupabaseServiceClient();
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  const client =
    service ||
    (url && anon
      ? createClient(url, anon, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null);

  if (!client) return [];

  const { data, error } = await client
    .from('restaurantes')
    .select('id, nombre_comercial, logo_url')
    .not('logo_url', 'is', null)
    .order('nombre_comercial', { ascending: true });

  if (error) {
    console.warn('[network-logos]', error.message);
    return [];
  }

  /** @type {{ id: string, name: string, logoUrl: string }[]} */
  const logos = [];
  for (const row of data ?? []) {
    const logoUrl = String(row.logo_url || '').trim();
    if (!/^https?:\/\//i.test(logoUrl)) continue;
    logos.push({
      id: String(row.id),
      name: String(row.nombre_comercial || '').trim() || 'Local',
      logoUrl,
    });
  }
  return logos;
}
