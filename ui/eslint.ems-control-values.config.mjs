import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config({
  files: ['ui/src-ts/runtime-executables/lib/ems-control-values.ts'],
  extends: tseslint.configs.recommendedTypeChecked,
  languageOptions: { globals: globals.node, parserOptions: { project: './ui/tsconfig.ems-control-values.json', tsconfigRootDir: import.meta.dirname + '/..' } },
  rules: { 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error', 'no-proto': 'error', 'no-extend-native': 'error' },
});
