import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname, projectService: true } },
        rules: {
            'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error',
            'no-extend-native': 'error',
            'jsdoc/require-jsdoc': 'off', 'jsdoc/require-param': 'off',
        },
    },
];
