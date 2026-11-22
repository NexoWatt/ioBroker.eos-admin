'use strict';
// Copyright (c) 2026 NexoWatt. Proprietary product policy.
// Contract source: NexoWatt EOS Keygen 1.0.4, lib/license-policy.js.
// Do not broaden these edition capacities without a versioned product decision.
// NWL3 derives entitlements from this trusted product policy, never from
// issuer form fields or token-supplied limits/features. These capacities match
// the existing EOS UI server: Home 3 chargers / 2 batteries, Pro 50 / 10.
// The UI's historical Pro maxWallboxes=0 sentinel is not an unlimited grant.
const homeFeatures = ['energy', 'wallet', 'smartHome', 'microgridSlave'];
const policies = Object.freeze({
    home: Object.freeze({
        features: Object.freeze([...homeFeatures]),
        limits: Object.freeze({ chargePoints: 3, batteries: 2 }),
    }),
    pro: Object.freeze({
        features: Object.freeze([...homeFeatures, 'microgridMaster', 'multisite', 'billing']),
        limits: Object.freeze({ chargePoints: 50, batteries: 10 }),
    }),
});
function editionPolicy(edition) {
    return typeof edition === 'string' && Object.hasOwn(policies, edition) ? policies[edition] : null;
}
module.exports = { editionPolicy };
//# sourceMappingURL=eosLicensePolicy.js.map