/** Copyright (c) 2026 NexoWatt. All rights reserved. */
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config({
    files: ['ui/src-ts/runtime-executables/www/eos-updates.ts'],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: { globals: globals.browser, parserOptions: { project: './ui/tsconfig.eos-updates-ui.json', tsconfigRootDir: import.meta.dirname + '/..' } },
    rules: { 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error', 'no-proto': 'error', 'no-extend-native': 'error' },
});
