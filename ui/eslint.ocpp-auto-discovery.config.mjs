import tseslint from 'typescript-eslint';
export default tseslint.config({
    files: ['ui/src-ts/runtime-executables/lib/ocpp-auto-discovery.ts'],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: { parserOptions: { project: './ui/tsconfig.ocpp-auto-discovery.json', tsconfigRootDir: import.meta.dirname + '/..' } },
    rules: { 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error', 'no-proto': 'error', 'no-extend-native': 'error' },
});
