'use strict';
// Synthetic customer configuration: no actual customer identities or credentials.
module.exports = function smartHomeLegacyFixture(enabled) {
    const smartHomeConfig = {
        version: 3,
        floors: [{ id: 'eg', name: 'Erdgeschoss', order: 1 }],
        rooms: [{ id: 'living', name: 'Wohnzimmer', floorId: 'eg', enabled: true, order: 1 }],
        functions: [{ id: 'light', name: 'Licht', enabled: true, order: 1 }],
        devices: [{ id: 'living_light', type: 'switch', roomId: 'living', functionId: 'light',
            name: 'Deckenlicht', alias: 'Deckenlicht', enabled: true,
            behavior: { readOnly: false, invert: false },
            io: { switch: { readId: 'knx.0.living.light.status', writeId: 'knx.0.living.light.command' } } }],
        scenes: [{ id: 'evening', name: 'Abend', enabled: true,
            actions: [{ deviceId: 'living_light', action: 'on', value: true }] }],
        pages: [{ id: 'living_page', name: 'Wohnen', roomIds: ['living'], deviceIds: ['living_light'] }],
        meta: { siteLabel: 'Synthetic migration site' },
    };
    return {
        native: { smartHome: { enabled, datapoints: { roomTemp: 'knx.0.living.temperature' } },
            smartHomeConfig: { ...smartHomeConfig, rooms: [{ ...smartHomeConfig.rooms[0], name: 'Old native label' }] } },
        patch: { smartHome: { enabled: !enabled, datapoints: { blindPosition: 'knx.0.living.blind.position' } },
            smartHomeConfig,
            logicEditor: { version: 1, graphs: [{ id: 'evening_graph', name: 'Abend', enabled: false,
                nodes: [{ id: 'clock', type: 'input', stateId: 'nexowatt-ui.0.smarthome.logicClocks.evening.active' }], edges: [] }] } },
        timers: { version: 1, updatedAt: 1700000000000, timers: [{ deviceId: 'living_light', enabled: true,
            days: [1, 2, 3, 4, 5], onTime: '18:00', offTime: '23:00' }] },
        clocks: { version: 1, updatedAt: 1700000000000, clocks: [{ id: 'evening', name: 'Abend', enabled: true,
            days: [1, 2, 3, 4, 5], fromTime: '18:00', toTime: '23:00' }] },
    };
};
