import { execSync } from 'node:child_process';

/**
 * Versión visible del súper admin.
 * El número es la cantidad de commits: sube cada vez que el código avanza,
 * así se compara el equipo local con lo publicado en Vercel.
 * En local se lee git en cada carga. En producción no hay repo: se usa
 * el número que quedó grabado al construir.
 */

function git(args) {
  try {
    return execSync(`git ${args}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function baked() {
  const count = Number(import.meta.env.XEMILLA_VERSION_COUNT);
  const sha = String(import.meta.env.XEMILLA_VERSION_SHA || '').slice(0, 7);
  return {
    count: Number.isFinite(count) && count > 0 ? count : 0,
    sha,
    dirty: false,
    live: false,
  };
}

/** Untracked de public/ (fotos sueltas) no cuentan como versión nueva. */
function isDirty(status) {
  return status.split('\n').some((line) => {
    const row = line.trimEnd();
    if (!row) return false;
    if (row.startsWith('?? public/')) return false;
    return true;
  });
}

export function readAppVersion() {
  const fallback = baked();
  if (!import.meta.env.DEV) return fallback;

  const count = Number(git('rev-list --count HEAD'));
  const sha = git('rev-parse --short=7 HEAD');
  if (!Number.isFinite(count) || count <= 0 || !sha) return fallback;

  return {
    count,
    sha,
    dirty: isDirty(git('status --porcelain')),
    live: true,
  };
}
