import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/', '.astro/', '.vercel/', 'node_modules/', 'node_modules.nosync/'],
  },
  js.configs.recommended,
  ...astro.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      'no-unused-vars': [
        'warn',
        { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-constant-condition': ['error', { checkLoops: false }],
      // `let raw = {}; try { raw = await request.json() } catch { return … }` es intencional.
      'no-useless-assignment': 'off',
    },
  },
  {
    files: ['**/*.astro'],
    rules: {
      // TypeScript resuelve tipos e interfaces del frontmatter; no-undef da falsos positivos.
      'no-undef': 'off',
    },
  },
];
