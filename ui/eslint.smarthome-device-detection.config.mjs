/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
import tseslint from 'typescript-eslint';
export default tseslint.config({
    files: ['ui/src-ts/runtime-executables/lib/smarthome-device-detection.ts', 'ui/src-ts/runtime-executables/lib/smarthome-import.ts'],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: { parserOptions: { project: './ui/tsconfig.smarthome-device-detection.json', tsconfigRootDir: import.meta.dirname + '/..' } },
    rules: { 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error', 'no-proto': 'error', 'no-extend-native': 'error' },
});
