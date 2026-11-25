import base from './eslint.runtime-health.config.mjs';
import globals from 'globals';
export default [...base,
    { files: ['modules/ocpp/admin/*.js'], languageOptions: { sourceType: 'script', globals: globals.browser } },
    { files: ['test/eos-ocpp-admin-browser.cjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
];
