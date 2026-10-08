export const prerender = false;

import { getRestauranteBySlug } from '../../lib/restaurantes.js';
import { buildRestaurantPwa } from '../../lib/pwa.js';

export async function GET({ params, url }) {
  const slug = String(params.slug || '').trim();
  const sucursal = url.searchParams.get('sucursal');
  let restaurante = null;
  try {
    restaurante = await getRestauranteBySlug(slug, { sucursal });
  } catch (err) {
    console.error('[manifest] getRestauranteBySlug crash:', err);
  }

  if (!restaurante?.slug) {
    return new Response('Not found', { status: 404 });
  }

  const { manifest } = buildRestaurantPwa(restaurante);
  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
    },
  });
}
