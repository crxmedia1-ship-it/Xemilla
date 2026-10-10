// @ts-check
import { execSync } from 'node:child_process';
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

/** Número de commits y sha corto, grabados al construir (en Vercel no hay git en runtime). */
function gitStamp() {
  const run = (args) => {
    try {
      return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  };
  const sha = (process.env.VERCEL_GIT_COMMIT_SHA || run('rev-parse HEAD') || '').slice(0, 7);
  const count = run('rev-list --count HEAD') || '0';
  return { sha, count };
}

const version = gitStamp();

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  server: {
    port: 4321,
    strictPort: true,
  },
  vite: {
    plugins: [tailwindcss()],
    define: {
      'import.meta.env.XEMILLA_VERSION_COUNT': JSON.stringify(version.count),
      'import.meta.env.XEMILLA_VERSION_SHA': JSON.stringify(version.sha),
    },
  },
});
