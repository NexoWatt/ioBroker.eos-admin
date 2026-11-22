import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        languageOptions: {
            parserOptions: {
                tsconfigRootDir: import.meta.dirname,
                projectService: {
                    // TypeScript prioritizes the adjacent declaration file for this legacy JS helper.
                    allowDefaultProject: ['src/lib/eosNewsSecurity.js'],
                    defaultProject: 'tsconfig.json',
                },
            },
        },
    },
    {
        files: ['src/lib/eosLicenseTrust.js'],
        rules: { 'jsdoc/check-tag-names': ['warn', { definedTags: ['typedef', 'type'] }] },
    },
    {
        // disable temporary the rule 'jsdoc/require-param' and enable 'jsdoc/require-jsdoc'
        rules: {
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param': 'off',
        },
    },
];
