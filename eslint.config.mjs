// @ts-check
// Shared flat config for the frontend apps and shared packages. The API keeps
// its own apps/api/eslint.config.mjs (Node environment). ESLint resolves the
// nearest config up the tree, so `eslint src` in any frontend package finds this.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**', '**/node_modules/**', '**/coverage/**', '**/dev-dist/**',
      'apps/api/**', // API has its own config.
      'Living Design System/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: { sourceType: 'module' },
      globals: { ...globals.browser, ...globals.es2021 },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Real correctness gate for hooks; exhaustive-deps stays advisory (off) so
      // the production lint gate is deterministic.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',
      // Vite/React config files and scripts may use Node globals.
      'no-undef': 'off',
    },
  },
  {
    files: ['**/*.config.{ts,js,mjs}', '**/vite-env.d.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
