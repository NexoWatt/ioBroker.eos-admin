import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config({
    files: ['modules/backup/src/**/*.ts'],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: {
        globals: globals.node,
        parserOptions: { project: './modules/backup/tsconfig.json', tsconfigRootDir: import.meta.dirname + '/../..' },
    },
    rules: {
        // Fixed CommonJS adapter constructors and optional clients are loaded only on demand.
        '@typescript-eslint/no-require-imports': 'off',
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'no-proto': 'error',
        'no-extend-native': 'error',
    },
});
