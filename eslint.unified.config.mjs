import js from '@eslint/js';
import globals from 'globals';

// New JS boundary modules: executable rules, separate from the inherited TS project.
// Their exported API contracts and the owner are also compiled by tsconfig.build.json.
export default [
    { ignores: ['node_modules/**', 'ui/node_modules/**', 'build/**'] },
    js.configs.recommended,
    {
        languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: globals.node },
        rules: {
            'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error',
            'no-proto': 'error', 'no-extend-native': 'error', 'no-constant-condition': 'error',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
        },
    },
];
