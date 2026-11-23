/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Aufgabe: Führt ausschließlich die beiden Backup-Cronpläne mit cron-parser 5 aus.
 * Wirkung: Ein abbrechbarer Timer pro Plan; keine nachgeholte Auftragsflut nach
 * Uhrsprüngen oder Prozesspausen. Cron-Syntax und lokale Systemzeitzone bleiben erhalten.
 */
import { CronExpressionParser } from 'cron-parser';
import { fail, flag, num, str, type Config } from './types';

export interface ScheduledJob {
    cancel(): void;
    nextInvocation(): Date | null;
}
export interface SchedulerClock {
    now(): number;
    setTimer(callback: () => void, delayMs: number): () => void;
}
const systemClock: SchedulerClock = {
    now: () => Date.now(),
    setTimer(callback, delayMs) {
        const timer = setTimeout(callback, delayMs);
        timer.unref();
        return () => clearTimeout(timer);
    },
};

/** Behält die bestehenden sechsstelligen Pläne und EveryXDays-Tagesfelder bei. */
export function backupCronExpression(config: Config, kind: 'iobroker' | 'ccu'): string {
    const prefix = kind === 'iobroker' ? 'minimal' : 'ccu';
    if (flag(config, kind + 'Cron')) return str(config, kind + 'CronJob');
    const parts = str(config, prefix + 'Time').split(':');
    return `10 ${Number(parts[1])} ${Number(parts[0])} */${num(config, prefix + 'EveryXDays', 1)} * *`;
}

/** Parserfehler werden vor Aktivierung eines Backup-Moduls als Konfigurationsfehler gemeldet. */
export function nextCronInvocation(spec: string, after: number, tz?: string): Date {
    if (!spec.trim() || spec.length > 1024 || !Number.isFinite(after)) throw fail('EOS_BACKUP_SCHEDULE_INVALID');
    try {
        return CronExpressionParser.parse(spec, { currentDate: new Date(after), ...(tz ? { tz } : {}) }).next().toDate();
    } catch {
        throw fail('EOS_BACKUP_SCHEDULE_INVALID');
    }
}

/**
 * Prüft spätestens nach 60 s die Wanduhr erneut. Rückwärtssprünge führen weder
 * zu früher Ausführung noch zur Wiederholung eines bereits ausgelösten Termins.
 * Überfällige Termine lösen einmal aus; anschließend wird ab jetzt weitergeplant.
 */
export function scheduleBackup(
    spec: string,
    handler: () => void | Promise<void>,
    onError: (code: string) => void,
    clock: SchedulerClock = systemClock,
): ScheduledJob {
    let target: Date | null = nextCronInvocation(spec, clock.now());
    let cancelled = false;
    let clearTimer: (() => void) | null = null;
    const cancel = (): void => {
        cancelled = true;
        clearTimer?.();
        clearTimer = null;
        target = null;
    };
    const arm = (): void => {
        if (cancelled || !target) return;
        clearTimer = clock.setTimer(tick, Math.max(1, Math.min(60_000, target.getTime() - clock.now())));
    };
    const tick = (): void => {
        clearTimer = null;
        if (cancelled || !target) return;
        const now = clock.now();
        if (now < target.getTime()) {
            arm();
            return;
        }
        try {
            target = nextCronInvocation(spec, Math.max(now, target.getTime()));
            arm();
        } catch {
            cancel();
            onError('EOS_BACKUP_SCHEDULE_INVALID');
            return;
        }
        try {
            const result = handler();
            if (result) void result.catch(() => onError('EOS_BACKUP_SCHEDULE_FAILED'));
        } catch {
            onError('EOS_BACKUP_SCHEDULE_FAILED');
        }
    };
    arm();
    return { cancel, nextInvocation: () => target ? new Date(target.getTime()) : null };
}
