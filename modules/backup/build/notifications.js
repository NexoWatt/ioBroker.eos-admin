"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupNotifier = void 0;
exports.validateNotificationConfig = validateNotificationConfig;
exports.validateNotificationPlan = validateNotificationPlan;
exports.notificationPlan = notificationPlan;
/** Copyright (c) 2026 NexoWatt. Proprietary; all rights reserved. */
const types_1 = require("./types");
const channels = {
    Telegram: { prefix: 'telegram', adapter: /^telegram\.\d+$/ },
    WhatsApp: { prefix: 'whatsapp', adapter: /^whatsapp(?:-cmb)?\.\d+$/ },
    Gotify: { prefix: 'gotify', adapter: /^gotify\.\d+$/ },
    Signal: { prefix: 'signal', adapter: /^signal(?:-cmb)?\.\d+$/ },
    Matrix: { prefix: 'matrix', adapter: /^matrix(?:-org)?\.\d+$/ },
    Discord: { prefix: 'discord', adapter: /^discord\.\d+$/ },
    Pushover: { prefix: 'pushover', adapter: /^pushover\.\d+$/ },
    'E-Mail': { prefix: 'email', adapter: /^email\.\d+$/ },
    Email: { prefix: 'email', adapter: /^email\.\d+$/ },
};
function channel(c) {
    const selected = channels[(0, types_1.str)(c, 'notificationsType')];
    if (!selected)
        throw (0, types_1.fail)('EOS_BACKUP_NOTIFICATION_CHANNEL');
    const target = (0, types_1.str)(c, selected.prefix + 'Instance');
    if (!selected.adapter.test(target))
        throw (0, types_1.fail)('EOS_BACKUP_NOTIFICATION_TARGET');
    const seconds = (0, types_1.num)(c, selected.prefix + 'WaitToSend', 0);
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600)
        throw (0, types_1.fail)('EOS_BACKUP_NOTIFICATION_DELAY');
    for (const key of ['telegramUser', 'emailReceiver', 'emailSender', 'pushoverDeviceID', 'discordTarget'])
        if ((0, types_1.str)(c, key).length > 512 || /[\r\n\0]/.test((0, types_1.str)(c, key)))
            throw (0, types_1.fail)('EOS_BACKUP_NOTIFICATION_RECIPIENT');
    if (selected.prefix === 'discord' && !/^\d{1,25}(?:\/\d{1,25})?$/.test((0, types_1.str)(c, 'discordTarget')))
        throw (0, types_1.fail)('EOS_BACKUP_NOTIFICATION_RECIPIENT');
    return { prefix: selected.prefix, target, delayMs: seconds * 1000 };
}
function validateNotificationConfig(config) {
    if (!(0, types_1.record)(config) || !(0, types_1.flag)(config, 'notificationEnabled'))
        return;
    channel(config);
}
function payload(c, prefix, text) {
    const message = { text };
    let command = 'send';
    if (prefix === 'telegram') {
        message.disable_notification = (0, types_1.flag)(c, 'telegramSilentNotice');
        const user = (0, types_1.str)(c, 'telegramUser');
        if (user && user !== 'allTelegramUsers')
            message.user = user;
    }
    else if (prefix === 'email') {
        message.to = (0, types_1.str)(c, 'emailReceiver');
        message.from = (0, types_1.str)(c, 'emailSender');
        message.subject = 'NexoWatt EOS Backup';
    }
    else if (prefix === 'gotify') {
        delete message.text;
        message.message = text;
        message.title = 'NexoWatt EOS Backup';
        message.priority = 4;
        message.contentType = 'text/plain';
    }
    else if (prefix === 'pushover') {
        delete message.text;
        message.message = text;
        message.title = 'NexoWatt EOS Backup';
        message.device = (0, types_1.str)(c, 'pushoverDeviceID');
        message.sound = '';
        if ((0, types_1.flag)(c, 'pushoverSilentNotice'))
            message.priority = -1;
    }
    else if (prefix === 'discord') {
        delete message.text;
        message.content = text;
        command = 'sendMessage';
        const parts = (0, types_1.str)(c, 'discordTarget').split('/');
        if (parts.length === 1)
            message.userId = parts[0];
        else {
            message.serverId = parts[0];
            message.channelId = parts[1];
        }
    }
    return { command, message };
}
/** The host rechecks this bounded, channel-specific capability immediately before dispatch. */
function validateNotificationPlan(config, plan) {
    if (!(0, types_1.record)(config) || !(0, types_1.flag)(config, 'notificationEnabled') || !(0, types_1.record)(plan) || !(0, types_1.record)(plan.message))
        return false;
    try {
        if (Object.keys(plan).sort().join(',') !== 'command,delayMs,message,target' ||
            Buffer.byteLength(JSON.stringify(plan)) > 8192)
            return false;
        const choice = channel(config);
        if (plan.target !== choice.target || plan.delayMs !== choice.delayMs)
            return false;
        const text = plan.message.text ?? plan.message.message ?? plan.message.content;
        if (typeof text !== 'string' ||
            text.length > 2048 ||
            !/^NexoWatt EOS Backup: (erfolgreich|fehlgeschlagen|abgebrochen)\.\nZeitpunkt: [0-9TZ:.+-]+\nArchive: \d+(?:\nZiele: [A-Za-z, ]+)?$/.test(text))
            return false;
        const expected = payload(config, choice.prefix, text);
        if (plan.command !== expected.command)
            return false;
        const keys = Object.keys(expected.message);
        return (keys.length === Object.keys(plan.message).length &&
            keys.every(key => plan.message !== undefined && (0, types_1.record)(plan.message) && plan.message[key] === expected.message[key]));
    }
    catch {
        return false;
    }
}
function notificationPlan(c, result) {
    if (!(0, types_1.flag)(c, 'notificationEnabled') || result.state === 'running')
        return null;
    const choice = channel(c);
    if (result.state === 'succeeded' &&
        (c[choice.prefix + 'OnlyError'] === true || c[choice.prefix + 'OnlyError'] === 'true'))
        return null;
    const label = result.state === 'succeeded' ? 'erfolgreich' : result.state === 'cancelled' ? 'abgebrochen' : 'fehlgeschlagen';
    const date = typeof result.finishedAt === 'string' && Number.isFinite(Date.parse(result.finishedAt))
        ? new Date(result.finishedAt).toISOString()
        : new Date().toISOString();
    let text = `NexoWatt EOS Backup: ${label}.\nZeitpunkt: ${date}\nArchive: ${result.files.length}`;
    if ((0, types_1.str)(c, choice.prefix + 'NoticeType').startsWith('long')) {
        const targets = [
            'Lokal',
            ...['cifs', 'ftp', 'webdav', 'dropbox', 'googledrive', 'onedrive'].filter(p => (0, types_1.flag)(c, p + 'Enabled')),
        ];
        text += '\nZiele: ' + targets.join(', ');
    }
    const plan = {
        target: choice.target,
        delayMs: choice.delayMs,
        ...payload(c, choice.prefix, text),
    };
    if (!validateNotificationPlan(c, plan))
        throw (0, types_1.fail)('EOS_BACKUP_NOTIFICATION_PLAN');
    return plan;
}
/** No network libraries or worker secrets are retained by the parent notification queue. */
class BackupNotifier {
    send;
    warn;
    pending = new Set();
    stopped = false;
    constructor(send, warn) {
        this.send = send;
        this.warn = warn;
    }
    enqueue(c, result) {
        if (this.stopped)
            return;
        let plan;
        try {
            plan = notificationPlan(c, result);
        }
        catch {
            this.warn('EOS_BACKUP_NOTIFICATION_CONFIG');
            return;
        }
        if (!plan)
            return;
        if (this.pending.size >= 32) {
            this.warn('EOS_BACKUP_NOTIFICATION_QUEUE_FULL');
            return;
        }
        const selected = plan;
        const timer = setTimeout(() => {
            this.pending.delete(timer);
            if (this.stopped)
                return;
            void Promise.resolve()
                .then(() => this.send(selected))
                .catch(() => this.warn('EOS_BACKUP_NOTIFICATION_FAILED'));
        }, selected.delayMs);
        timer.unref();
        this.pending.add(timer);
    }
    stop() {
        this.stopped = true;
        for (const timer of this.pending)
            clearTimeout(timer);
        this.pending.clear();
    }
}
exports.BackupNotifier = BackupNotifier;
