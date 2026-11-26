"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupCronExpression = backupCronExpression;
exports.nextCronInvocation = nextCronInvocation;
exports.scheduleBackup = scheduleBackup;
/**
 * Copyright (c) 2026 NexoWatt. Proprietary EOS integration.
 * Aufgabe: Führt ausschließlich die beiden Backup-Cronpläne mit cron-parser 5 aus.
 * Wirkung: Ein abbrechbarer Timer pro Plan; keine nachgeholte Auftragsflut nach
 * Uhrsprüngen oder Prozesspausen. Cron-Syntax und lokale Systemzeitzone bleiben erhalten.
 */
const cron_parser_1 = require("cron-parser");
const types_1 = require("./types");
const systemClock = {
    now: () => Date.now(),
    setTimer(callback, delayMs) {
        const timer = setTimeout(callback, delayMs);
        timer.unref();
        return () => clearTimeout(timer);
    },
};
/** Behält die bestehenden sechsstelligen Pläne und EveryXDays-Tagesfelder bei. */
function backupCronExpression(config, kind) {
    const prefix = kind === 'iobroker' ? 'minimal' : 'ccu';
    if ((0, types_1.flag)(config, kind + 'Cron'))
        return (0, types_1.str)(config, kind + 'CronJob');
    const parts = (0, types_1.str)(config, prefix + 'Time').split(':');
    return `10 ${Number(parts[1])} ${Number(parts[0])} */${(0, types_1.num)(config, prefix + 'EveryXDays', 1)} * *`;
}
/** Parserfehler werden vor Aktivierung eines Backup-Moduls als Konfigurationsfehler gemeldet. */
function nextCronInvocation(spec, after, tz) {
    if (!spec.trim() || spec.length > 1024 || !Number.isFinite(after))
        throw (0, types_1.fail)('EOS_BACKUP_SCHEDULE_INVALID');
    try {
        return cron_parser_1.CronExpressionParser.parse(spec, { currentDate: new Date(after), ...(tz ? { tz } : {}) }).next().toDate();
    }
    catch {
        throw (0, types_1.fail)('EOS_BACKUP_SCHEDULE_INVALID');
    }
}
/**
 * Prüft spätestens nach 60 s die Wanduhr erneut. Rückwärtssprünge führen weder
 * zu früher Ausführung noch zur Wiederholung eines bereits ausgelösten Termins.
 * Überfällige Termine lösen einmal aus; anschließend wird ab jetzt weitergeplant.
 */
function scheduleBackup(spec, handler, onError, clock = systemClock) {
    let target = nextCronInvocation(spec, clock.now());
    let cancelled = false;
    let clearTimer = null;
    const cancel = () => {
        cancelled = true;
        clearTimer?.();
        clearTimer = null;
        target = null;
    };
    const arm = () => {
        if (cancelled || !target)
            return;
        clearTimer = clock.setTimer(tick, Math.max(1, Math.min(60_000, target.getTime() - clock.now())));
    };
    const tick = () => {
        clearTimer = null;
        if (cancelled || !target)
            return;
        const now = clock.now();
        if (now < target.getTime()) {
            arm();
            return;
        }
        try {
            target = nextCronInvocation(spec, Math.max(now, target.getTime()));
            arm();
        }
        catch {
            cancel();
            onError('EOS_BACKUP_SCHEDULE_INVALID');
            return;
        }
        try {
            const result = handler();
            if (result)
                void result.catch(() => onError('EOS_BACKUP_SCHEDULE_FAILED'));
        }
        catch {
            onError('EOS_BACKUP_SCHEDULE_FAILED');
        }
    };
    arm();
    return { cancel, nextInvocation: () => target ? new Date(target.getTime()) : null };
}
