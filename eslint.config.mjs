import config from '@iobroker/eslint-config';

export default [
    // Vendored upstream bytes are verified by the pinned provenance gate, never reformatted.
    // Declaration-adjacent JS boundaries use the executable rules in lint:unified.
    { ignores: ['src/lib/vendor/webserver/**', 'src/lib/eosModuleHost.js', 'src/lib/eosModuleHttp.js', 'src/lib/eosUnifiedOwnership.js', 'src/lib/eosLegacyMigration.js'] },
    ...config,
    {
        languageOptions: {
            parserOptions: {
                tsconfigRootDir: import.meta.dirname,
                projectService: {
                    // TypeScript prioritizes the adjacent declaration file for these JS helpers.
                    allowDefaultProject: ['src/lib/eosNewsSecurity.js', 'src/lib/eosRolePolicy.js'],
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
