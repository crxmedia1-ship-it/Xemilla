import { fetchTasasCambio } from '../../lib/tasas-cambio.js';

export const prerender = false;

/**
 * Tasas BCV para el menú público (USD/VES y EUR/VES).
 */
export async function GET() {
  try {
    const tasas = await fetchTasasCambio();
    return new Response(JSON.stringify({ ok: true, ...tasas }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=900',
      },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'No se pudieron leer las tasas' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
