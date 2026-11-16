import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const unusedVars = ['error', { varsIgnorePattern: '^[A-Z_]' }]

// shared/ runs in the browser (Vite) and in Pages Functions (workers): only globals both have.
const browserAndWorkerGlobals = Object.fromEntries(
  Object.entries(globals.browser).filter(([name]) => name in globals.serviceworker),
)

export default defineConfig([
  globalIgnores(['dist', '.wrangler', '.visual']),
  {
    files: ['**/*.{js,jsx}'],
    ignores: ['functions/**', 'shared/**', 'scripts/**', 'tests/**'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': unusedVars,
    },
  },
  {
    // Cloudflare Pages Functions (workers runtime)
    files: ['functions/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.serviceworker },
    rules: { 'no-unused-vars': unusedVars },
  },
  {
    files: ['shared/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: browserAndWorkerGlobals },
    rules: { 'no-unused-vars': unusedVars },
  },
  {
    // Node scripts and vitest tests (tests import from 'vitest' explicitly)
    files: ['scripts/**/*.{js,mjs}', 'tests/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: { 'no-unused-vars': unusedVars },
  },
])
