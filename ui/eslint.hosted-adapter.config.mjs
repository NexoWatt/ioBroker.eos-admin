/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config({
    files: ['ui/src-ts/runtime-executables/lib/hosted-adapter.ts'],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: { globals: globals.node,
        parserOptions: { project: './ui/tsconfig.hosted-adapter.json', tsconfigRootDir: import.meta.dirname + '/..' } },
    rules: { 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error', 'no-proto': 'error', 'no-extend-native': 'error' },
});
