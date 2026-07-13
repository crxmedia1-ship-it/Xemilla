import { createSupabaseServerClient } from '../../lib/supabase/server.js';

export const prerender = false;

/** Cierra sesión del panel y vuelve al login. */
export async function POST({ request, cookies, redirect }) {
  const supabase = createSupabaseServerClient({ request, cookies });
  await supabase.auth.signOut();
  return redirect('/admin/login');
}

export async function GET({ redirect }) {
  return redirect('/admin/login');
}
