import js from '@eslint/js';
import globals from 'globals';
export default [js.configs.recommended, {
    files: ['modules/backup/admin/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: globals.browser },
    rules: { 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error', 'no-proto': 'error',
        'no-extend-native': 'error', 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }] },
}];
