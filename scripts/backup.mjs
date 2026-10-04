#!/usr/bin/env node
/**
 * Copia de seguridad de los datos de Supabase a backups/<fecha>.json.
 *   npm run backup
 * Incluye todas las tablas de la app y los usuarios Auth (sin contraseñas).
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env. La carpeta backups/ no se sube a git.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const TABLES = ['restaurantes', 'categorias', 'platos', 'plato_vistas'];
const PAGE = 1000;

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltan PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function dumpTable(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

async function dumpUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) throw new Error(`auth.users: ${error.message}`);
    users.push(
      ...data.users.map((u) => ({
        id: u.id,
        email: u.email,
        app_metadata: u.app_metadata,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      })),
    );
    if (data.users.length < PAGE) return users;
  }
}

const backup = { created_at: new Date().toISOString(), tables: {} };
for (const table of TABLES) {
  backup.tables[table] = await dumpTable(table);
}
backup.auth_users = await dumpUsers();

await mkdir('backups', { recursive: true });
const stamp = backup.created_at.slice(0, 16).replace(/[:T]/g, '-');
const file = `backups/${stamp}.json`;
await writeFile(file, JSON.stringify(backup, null, 2));

console.log(`Copia guardada en ${file}`);
for (const [table, rows] of Object.entries(backup.tables)) {
  console.log(`  ${table}: ${rows.length}`);
}
console.log(`  usuarios: ${backup.auth_users.length}`);
