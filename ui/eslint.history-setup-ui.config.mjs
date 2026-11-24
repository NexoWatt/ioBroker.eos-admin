/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config({
  files: ['ui/src-admin-tab/src/lib/historySetup.ts', 'ui/src-admin-tab/src/pages/HistorySetupPage.tsx'],
  extends: tseslint.configs.recommendedTypeChecked,
  languageOptions: { globals: globals.browser, parserOptions: { project: './ui/src-admin-tab/tsconfig.json', tsconfigRootDir: import.meta.dirname + '/..' } },
  rules: { 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error', 'no-proto': 'error' },
});
