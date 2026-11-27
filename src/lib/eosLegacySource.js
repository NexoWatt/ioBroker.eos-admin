/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const { isDeepStrictEqual } = require('node:util');
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = code => Object.assign(new Error(code), { code });
const schemaDriven = id => id === 'ui' || id === 'devices';
function cleanVersion(value) {
    return typeof value === 'string' &&
        value.length <= 80 &&
        value.trim() === value &&
        /^\d{1,8}\.\d{1,8}\.\d{1,8}(?:-[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*)?(?:\+[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*)?$/.test(
            value,
        )
        ? value
        : null;
}
function sourceMetadata(instance, adapter) {
    const instanceVersion = cleanVersion(instance?.common?.version);
    const adapterVersion = cleanVersion(adapter?.common?.version);
    const invalid = [instance, adapter].some(
        object =>
            object?.common?.version != null && object.common.version !== '' && !cleanVersion(object.common.version),
    );
    const versionCode = invalid
        ? 'EOS_MIGRATION_VERSION_INVALID'
        : instanceVersion && adapterVersion && instanceVersion !== adapterVersion
          ? 'EOS_MIGRATION_VERSION_DIFFERENT'
          : !instanceVersion
            ? 'EOS_MIGRATION_VERSION_MISSING'
            : '';
    return {
        instanceVersion,
        adapterVersion,
        sourceVersion: instanceVersion || adapterVersion,
        ...(versionCode ? { versionCode } : {}),
        ...(typeof instance?.common?.enabled === 'boolean' ? { enabled: instance.common.enabled } : {}),
    };
}
function sourceIdentity(name, object, instance) {
    if (
        !object ||
        !record(object.common) ||
        object.type !== (instance ? 'instance' : 'adapter') ||
        (instance
            ? !new RegExp(`^system\\.adapter\\.${name}\\.\\d+$`).test(object._id)
            : object._id !== `system.adapter.${name}`) ||
        (object.common.name !== undefined && object.common.name !== name)
    ) {
        throw fail('EOS_MIGRATION_SOURCE_IDENTITY');
    }
}
function validJournalSource(row, names, versions) {
    if (
        !record(row) ||
        !Object.hasOwn(names, row.id) ||
        typeof row.source !== 'string' ||
        !new RegExp(`^${names[row.id]}\\.\\d+$`).test(row.source) ||
        typeof row.nativeHash !== 'string' ||
        !/^[a-f0-9]{64}$/.test(row.nativeHash) ||
        typeof row.enabled !== 'boolean' ||
        typeof row.host !== 'string' ||
        !row.host ||
        row.host.length > 255
    ) {
        return false;
    }
    if (
        row.targetEnabled !== undefined &&
        !(row.targetEnabled === true && row.id === 'devices' && row.enabled === false)
    ) {
        return false;
    }
    if (row.schemaVerified === undefined) {
        return versions[row.id].includes(row.sourceVersion);
    }
    if (row.schemaVerified !== true || !schemaDriven(row.id)) {
        return false;
    }
    const safe = v => v === null || (typeof v === 'string' && v === cleanVersion(v));
    return (
        safe(row.instanceVersion) &&
        safe(row.adapterVersion) &&
        row.sourceVersion === (row.instanceVersion || row.adapterVersion)
    );
}
function expectRecords(container, keys, code) {
    for (const key of keys) {
        if (container[key] !== undefined && !record(container[key])) {
            throw fail(code);
        }
    }
}
function uiShape(config, defaults, installerDocument = false) {
    const code = 'EOS_MIGRATION_UI_CONFIG_SHAPE';
    const keys = Object.keys(config);
    // Empty native settings are legitimate when the installer document carries the configuration.
    if (
        !installerDocument &&
        keys.length &&
        !keys.some(key => Object.hasOwn(defaults, key) || key === 'siteName' || key === 'storageFarm')
    ) {
        throw fail(code);
    }
    // These are consumed as maps by the hosted runtime. Other additive settings
    // stay intact and pass through the independent legacy installer-document reader.
    expectRecords(
        config,
        [
            'datapoints',
            'installerConfig',
            'settings',
            'history',
            'smartHome',
            'smartHomeConfig',
            'storageFarm',
            'sections',
            'logic',
        ],
        code,
    );
    if (
        config.datapoints &&
        Object.values(config.datapoints).some(value => value !== null && typeof value !== 'string')
    ) {
        throw fail(code);
    }
    if (config.history) {
        if (config.history.instance !== undefined && typeof config.history.instance !== 'string') {
            throw fail(code);
        }
        expectRecords(config.history, ['datapoints'], code);
    }
    for (const [container, fields] of [
        [config.smartHomeConfig, ['floors', 'rooms', 'functions', 'scenes', 'pages', 'devices']],
        [config.storageFarm, ['storages']],
    ]) {
        if (container) {
            for (const key of fields) {
                if (container[key] !== undefined && (!Array.isArray(container[key]) || !container[key].every(record))) {
                    throw fail(code);
                }
            }
        }
    }
}
function devicesShape(config) {
    // Reading an unknown nonempty representation as the default [] would lose devices.
    if (
        Object.keys(config).length &&
        !Object.hasOwn(config, 'devices') &&
        !Object.hasOwn(config, 'devicesJson') &&
        Object.keys(config).some(
            key => !['pollIntervalMs', 'modbusTimeoutMs', 'registerAddressOffset', 'enabled'].includes(key),
        )
    ) {
        throw fail('EOS_MIGRATION_DEVICES_CONFIG_SHAPE');
    }
}
// These are the exact root-channel definitions issued by the hosted UI / EMS.
// No runtime creates a bare energyFlow or chargepoints root with this contract.
function ownPlaceholder(namespace, channel, object) {
    if (
        object?._id !== `${namespace}.${channel}` ||
        object.type !== 'channel' ||
        !record(object.native) ||
        Object.keys(object.native).length ||
        !record(object.common) ||
        Object.keys(object.common).length !== 1 ||
        typeof object.common.name !== 'string' ||
        object.from !== `system.adapter.${namespace}`
    ) {
        return false;
    }
    const name = object.common.name;
    return (
        (channel === 'smarthome' && name === 'SmartHome') ||
        (channel === 'ems' && (name === 'EMS (intern)' || name === 'EMS')) ||
        (channel === 'historie' && (name === 'Historie (Influx)' || name === 'EOS Historie'))
    );
}
function containsCustomerSettings(value, defaults) {
    if (record(value)) {
        return Object.entries(value).some(([key, item]) =>
            containsCustomerSettings(
                item,
                record(defaults) && Object.hasOwn(defaults, key) ? defaults[key] : undefined,
            ),
        );
    }
    if (defaults === undefined) {
        return !(value === null || value === '' || (Array.isArray(value) && !value.length));
    }
    return !isDeepStrictEqual(value, defaults);
}
module.exports = {
    ownPlaceholder,
    containsCustomerSettings,
    cleanVersion,
    sourceMetadata,
    sourceIdentity,
    schemaDriven,
    validJournalSource,
    uiShape,
    devicesShape,
};
