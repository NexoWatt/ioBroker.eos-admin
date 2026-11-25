import js from '@eslint/js';
import globals from 'globals';
export default [
    js.configs.recommended,
    {
        files: ['**/*.js', '**/*.cjs'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: globals.node },
        rules: { 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error',
            'no-proto': 'error', 'no-extend-native': 'error', 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }] },
    },
    { files: ['public/eos-runtime/*.js'], languageOptions: { sourceType: 'script', globals: globals.browser } },
    { files: ['test/eos-runtime-health-browser.cjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
];
