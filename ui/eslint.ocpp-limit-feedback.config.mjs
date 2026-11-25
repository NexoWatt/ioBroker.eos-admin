import tseslint from 'typescript-eslint';
export default tseslint.config({
    files: ['ui/src-ts/runtime-executables/lib/ocpp-limit-feedback.ts'],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: { parserOptions: { project: './ui/tsconfig.ocpp-limit-feedback.json', tsconfigRootDir: import.meta.dirname + '/..' } },
    rules: { 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error', 'no-proto': 'error', 'no-extend-native': 'error' },
});
