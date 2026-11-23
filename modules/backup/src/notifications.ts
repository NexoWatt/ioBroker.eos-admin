/** Copyright (c) 2026 NexoWatt. Proprietary; all rights reserved. */
import { fail, flag, num, record, str, type Config, type JobResult } from './types';
export interface NotificationPlan {
    target: string;
    command: 'send' | 'sendMessage';
    message: Record<string, unknown>;
    delayMs: number;
}
const channels: Record<string, { prefix: string; adapter: RegExp }> = {
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
function channel(c: Record<string, unknown>): { prefix: string; target: string; delayMs: number } {
    const selected = channels[str(c, 'notificationsType')];
    if (!selected) throw fail('EOS_BACKUP_NOTIFICATION_CHANNEL');
    const target = str(c, selected.prefix + 'Instance');
    if (!selected.adapter.test(target)) throw fail('EOS_BACKUP_NOTIFICATION_TARGET');
    const seconds = num(c, selected.prefix + 'WaitToSend', 0);
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) throw fail('EOS_BACKUP_NOTIFICATION_DELAY');
    for (const key of ['telegramUser', 'emailReceiver', 'emailSender', 'pushoverDeviceID', 'discordTarget'])
        if (str(c, key).length > 512 || /[\r\n\0]/.test(str(c, key))) throw fail('EOS_BACKUP_NOTIFICATION_RECIPIENT');
    if (selected.prefix === 'discord' && !/^\d{1,25}(?:\/\d{1,25})?$/.test(str(c, 'discordTarget')))
        throw fail('EOS_BACKUP_NOTIFICATION_RECIPIENT');
    return { prefix: selected.prefix, target, delayMs: seconds * 1000 };
}
export function validateNotificationConfig(config: unknown): void {
    if (!record(config) || !flag(config, 'notificationEnabled')) return;
    channel(config);
}
function payload(
    c: Record<string, unknown>,
    prefix: string,
    text: string,
): { command: NotificationPlan['command']; message: Record<string, unknown> } {
    const message: Record<string, unknown> = { text };
    let command: NotificationPlan['command'] = 'send';
    if (prefix === 'telegram') {
        message.disable_notification = flag(c, 'telegramSilentNotice');
        const user = str(c, 'telegramUser');
        if (user && user !== 'allTelegramUsers') message.user = user;
    } else if (prefix === 'email') {
        message.to = str(c, 'emailReceiver');
        message.from = str(c, 'emailSender');
        message.subject = 'NexoWatt EOS Backup';
    } else if (prefix === 'gotify') {
        delete message.text;
        message.message = text;
        message.title = 'NexoWatt EOS Backup';
        message.priority = 4;
        message.contentType = 'text/plain';
    } else if (prefix === 'pushover') {
        delete message.text;
        message.message = text;
        message.title = 'NexoWatt EOS Backup';
        message.device = str(c, 'pushoverDeviceID');
        message.sound = '';
        if (flag(c, 'pushoverSilentNotice')) message.priority = -1;
    } else if (prefix === 'discord') {
        delete message.text;
        message.content = text;
        command = 'sendMessage';
        const parts = str(c, 'discordTarget').split('/');
        if (parts.length === 1) message.userId = parts[0];
        else {
            message.serverId = parts[0];
            message.channelId = parts[1];
        }
    }
    return { command, message };
}
/** The host rechecks this bounded, channel-specific capability immediately before dispatch. */
export function validateNotificationPlan(config: unknown, plan: unknown): plan is NotificationPlan {
    if (!record(config) || !flag(config, 'notificationEnabled') || !record(plan) || !record(plan.message)) return false;
    try {
        if (
            Object.keys(plan).sort().join(',') !== 'command,delayMs,message,target' ||
            Buffer.byteLength(JSON.stringify(plan)) > 8192
        )
            return false;
        const choice = channel(config);
        if (plan.target !== choice.target || plan.delayMs !== choice.delayMs) return false;
        const text = plan.message.text ?? plan.message.message ?? plan.message.content;
        if (
            typeof text !== 'string' ||
            text.length > 2048 ||
            !/^NexoWatt EOS Backup: (erfolgreich|fehlgeschlagen|abgebrochen)\.\nZeitpunkt: [0-9TZ:.+-]+\nArchive: \d+(?:\nZiele: [A-Za-z, ]+)?$/.test(
                text,
            )
        )
            return false;
        const expected = payload(config, choice.prefix, text);
        if (plan.command !== expected.command) return false;
        const keys = Object.keys(expected.message);
        return (
            keys.length === Object.keys(plan.message).length &&
            keys.every(
                key =>
                    plan.message !== undefined && record(plan.message) && plan.message[key] === expected.message[key],
            )
        );
    } catch {
        return false;
    }
}
export function notificationPlan(c: Config, result: JobResult): NotificationPlan | null {
    if (!flag(c, 'notificationEnabled') || result.state === 'running') return null;
    const choice = channel(c);
    if (
        result.state === 'succeeded' &&
        (c[choice.prefix + 'OnlyError'] === true || c[choice.prefix + 'OnlyError'] === 'true')
    )
        return null;
    const label =
        result.state === 'succeeded' ? 'erfolgreich' : result.state === 'cancelled' ? 'abgebrochen' : 'fehlgeschlagen';
    const date =
        typeof result.finishedAt === 'string' && Number.isFinite(Date.parse(result.finishedAt))
            ? new Date(result.finishedAt).toISOString()
            : new Date().toISOString();
    let text = `NexoWatt EOS Backup: ${label}.\nZeitpunkt: ${date}\nArchive: ${result.files.length}`;
    if (str(c, choice.prefix + 'NoticeType').startsWith('long')) {
        const targets = [
            'Lokal',
            ...['cifs', 'ftp', 'webdav', 'dropbox', 'googledrive', 'onedrive'].filter(p => flag(c, p + 'Enabled')),
        ];
        text += '\nZiele: ' + targets.join(', ');
    }
    const plan: NotificationPlan = {
        target: choice.target,
        delayMs: choice.delayMs,
        ...payload(c, choice.prefix, text),
    };
    if (!validateNotificationPlan(c, plan)) throw fail('EOS_BACKUP_NOTIFICATION_PLAN');
    return plan;
}
/** No network libraries or worker secrets are retained by the parent notification queue. */
export class BackupNotifier {
    private readonly pending = new Set<NodeJS.Timeout>();
    private stopped = false;
    constructor(
        private readonly send: (plan: NotificationPlan) => Promise<void>,
        private readonly warn: (code: string) => void,
    ) {}
    enqueue(c: Config, result: JobResult): void {
        if (this.stopped) return;
        let plan: NotificationPlan | null;
        try {
            plan = notificationPlan(c, result);
        } catch {
            this.warn('EOS_BACKUP_NOTIFICATION_CONFIG');
            return;
        }
        if (!plan) return;
        if (this.pending.size >= 32) {
            this.warn('EOS_BACKUP_NOTIFICATION_QUEUE_FULL');
            return;
        }
        const selected = plan;
        const timer = setTimeout(() => {
            this.pending.delete(timer);
            if (this.stopped) return;
            void Promise.resolve()
                .then(() => this.send(selected))
                .catch(() => this.warn('EOS_BACKUP_NOTIFICATION_FAILED'));
        }, selected.delayMs);
        timer.unref();
        this.pending.add(timer);
    }
    stop(): void {
        this.stopped = true;
        for (const timer of this.pending) clearTimeout(timer);
        this.pending.clear();
    }
}
