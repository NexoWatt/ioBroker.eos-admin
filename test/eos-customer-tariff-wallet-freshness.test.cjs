'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EnergyWalletModule } = require('../ui/ems/modules/energy-wallet');

function prices(source, value, fresh) {
    const ts = Date.now();
    const stateCache = {
        'settings.dynamicTariff': { value: true, ts },
        'settings.price': { value: 0.35, ts },
        [source]: { value, ts },
    };
    if (fresh !== undefined) stateCache['tarif.currentPriceFresh'] = { value: fresh, ts };
    return new EnergyWalletModule({ namespace: 'eos-admin.0', config: {}, stateCache }, null)._prices();
}

test('wallet cannot revive an explicitly invalid tariff through fresh budget, direct, history or legacy caches', () => {
    for (const source of ['ems.budget.tariff.currentPriceEurKwh', 'tarif.preisAktuellEurProKwh',
        'historie.tariff.providerCurrentEurPerKwh', 'priceCurrent', 'tarif.priceCurrent', 'tariff.priceCurrent']) {
        for (const value of [0, -0.2, 0.28]) {
            const result = prices(source, value, false);
            assert.equal(result.dynamicTariffAvailable, false, source);
            assert.equal(result.gridImportEurPerKwh, 0.35, source);
            assert.equal(result.dynamicTariffStale, true, source);
            assert.match(result.dynamicTariffWarning, /Quelle|ungültig|aktuell/);
        }
    }
});

test('wallet retains true zero, negative prices and legacy sources without a freshness flag', () => {
    for (const fresh of [true, undefined]) {
        for (const value of [0, -0.2, 0.28]) {
            const result = prices('tarif.preisAktuellEurProKwh', value, fresh);
            assert.equal(result.dynamicTariffAvailable, true);
            assert.equal(result.gridImportEurPerKwh, value);
        }
    }
});
