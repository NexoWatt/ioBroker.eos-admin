/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Bindet Anmeldung und Sitzungswiderruf an die kanonische ioBroker-Konto-ID.
 * Daten und Wirkung: Unvertrauter Benutzername/Passwort; öffentliche Adapter-APIs getUserID,
 * getForeignObjectAsync und checkPassword. Keine eigene Passwort-Hashprüfung.
 * Wirkung: Anzeigenamen werden vor dem historischen ID-Fallback aufgelöst; Rollen
 * und Sitzungen dürfen ausschließlich den zurückgegebenen Kontosuffix verwenden.
 * Sicherheitsgrenze: Aktiviertes Benutzerobjekt, identische Konto-ID im Passwort-
 * Callback und unveränderter Passwort-Fingerabdruck vor/nach Prüfung sind Pflicht.
 * Ein gemeinsames Zeitbudget von höchstens 5.000 ms begrenzt die gesamte Kontoprüfung.
 * ioBroker bietet hierfür keinen Abbruch: Verspätete Ergebnisse werden verworfen,
 * weitere Prüfschritte unterbleiben und Promise-Ablehnungen bleiben abgefangen.
 * Bei Änderungen: Kanonische Identität, Fristen und Widerrufsfingerabdruck gemeinsam prüfen;
 * Dokumentation und negative Anmeldetests im selben Stand mitführen.
 * Nachweise: docs/reports/admin8-login-2026-11-03/AUTH_PRUEFVERMERK_DE.md
 */
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

export interface IoBrokerUserAuthAdapter {
  getUserID?: (name: string) => Promise<unknown>;
  getForeignObjectAsync: (id: string) => Promise<unknown>;
  checkPassword: (user: string, password: string, callback: (result: unknown, user?: unknown) => void) => unknown;
  readonly FORBIDDEN_CHARS?: RegExp;
}

export type AuthenticatedIoBrokerUser = Readonly<{ user: string; credentialVersion: string }>;

const USER_PREFIX = 'system.user.';
const MAX_USER_LENGTH = 128;
const MAX_PASSWORD_LENGTH = 1024;
const AUTH_TIMEOUT_MS = 5000;
// Offizieller js-controller-7.2.5-Fallback, packages/common-db/src/lib/common/tools.ts.
// Die öffentliche Adapterkonstante hat Vorrang; RegExp.replace verändert lastIndex
// bei globalen Ausdrücken nicht dauerhaft und entspricht dem Controllerverhalten.
const CONTROLLER_FORBIDDEN_CHARS = /[^._\-/ :!#$%&()+=@^{}|~\p{Ll}\p{Lu}\p{Nd}]+/gu;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Vollständige IDs unverändert übernehmen; weder Anzeigenamen noch fremde IDs. */
function isCanonicalUserId(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith(USER_PREFIX)) return false;
  const suffix = value.slice(USER_PREFIX.length);
  return suffix.length > 0 && suffix.length <= MAX_USER_LENGTH && suffix === suffix.trim()
    && !/[\u0000-\u001f\u007f-\u009f]/u.test(suffix)
    && suffix.replace(CONTROLLER_FORBIDDEN_CHARS, '') === suffix;
}

/** SHA-256 dient nur dem Sitzungswiderruf; der Passwortnachweis bleibt ioBroker. */
export async function readAccountSecurity(adapter: IoBrokerUserAuthAdapter, userShort: unknown, timeoutMs = AUTH_TIMEOUT_MS): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return null;
    if (typeof userShort !== 'string' || !isCanonicalUserId(USER_PREFIX + userShort)) return null;
    const id = USER_PREFIX + userShort;
    // Controller-Objektlesungen besitzen keinen Abbruchparameter. Bei Zeitablauf
    // wird das Ergebnis verworfen; ein späteres Resultat kann keine Sitzung öffnen.
    const account = await new Promise<unknown>(resolve => {
      timer = setTimeout(() => resolve(null), Math.min(timeoutMs, AUTH_TIMEOUT_MS));
      void Promise.resolve().then(() => adapter.getForeignObjectAsync(id)).then(resolve, () => resolve(null));
    });
    if (!record(account) || account._id !== id || account.type !== 'user' || !record(account.common)) return null;
    const common = account.common;
    if (common.enabled === false || typeof common.password !== 'string' || !common.password) return null;
    // ioBroker webserver 3.5+: TOTP liegt im gemeinsamen Benutzerobjekt. Ein
    // reiner checkPassword-Aufruf darf den zweiten Faktor nicht umgehen. Auch
    // eine nachträgliche Aktivierung entzieht bestehenden Passwortsitzungen den Zugang.
    const external = common.externalAuthentication;
    if (external !== undefined && external !== null && !record(external)) return null;
    if (record(external) && external.totp !== undefined && external.totp !== null) return null;
    return createHash('sha256').update(common.password).digest('hex');
  } catch (_error: unknown) { return null; }
  finally { if (timer) clearTimeout(timer); }
}

/**
 * Prüft ein Konto innerhalb eines gemeinsamen Budgets. timeoutMs darf ausschließlich
 * für interne Tests/strengere Aufrufer verkürzt werden, nie über 5.000 ms steigen.
 * Null bedeutet ungültige Eingabe, API-Fehler, Zeitablauf oder verweigerten Zugriff.
 * Passwort und gespeicherte Passwort-Hashes werden weder ausgegeben noch protokolliert.
 */
export function authenticateIoBrokerUser(
  adapter: IoBrokerUserAuthAdapter,
  rawUser: unknown,
  rawPassword: unknown,
  timeoutMs = AUTH_TIMEOUT_MS,
): Promise<AuthenticatedIoBrokerUser | null> {
  if (typeof rawUser !== 'string' || typeof rawPassword !== 'string' || rawUser.length > MAX_USER_LENGTH) return Promise.resolve(null);
  const input = rawUser.trim();
  if (!input || input.length > MAX_USER_LENGTH || !rawPassword || rawPassword.length > MAX_PASSWORD_LENGTH) return Promise.resolve(null);
  const budget = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, AUTH_TIMEOUT_MS) : AUTH_TIMEOUT_MS;
  const deadline = performance.now() + budget;
  return new Promise(resolve => {
    let active = true;
    let cancelPasswordCheck: (() => void) | undefined;
    const isActive = (): boolean => active && performance.now() < deadline;
    const finish = (result: AuthenticatedIoBrokerUser | null): void => {
      if (!active) return;
      const inTime = isActive();
      active = false;
      clearTimeout(timer);
      cancelPasswordCheck?.();
      resolve(inTime ? result : null);
    };
    const timer = setTimeout(() => finish(null), budget);

    const checkCanonicalPassword = (id: string): Promise<boolean> => new Promise(done => {
      let settled = false;
      const complete = (result: unknown, returnedUser?: unknown): void => {
        if (settled) return;
        settled = true;
        cancelPasswordCheck = undefined;
        done(isActive() && result === true && returnedUser === id);
      };
      cancelPasswordCheck = () => complete(false);
      if (!isActive()) { complete(false); return; }
      try {
        const returned = adapter.checkPassword(id, rawPassword, complete);
        // Einige Controller implementieren die Callback-API als async-Funktion.
        // Auch eine späte Ablehnung nach Callback/Timeout darf nicht unhandled sein.
        void Promise.resolve(returned).catch(() => complete(false));
      } catch (_error: unknown) { complete(false); }
    });

    const run = async (): Promise<void> => {
      try {
        if (!isActive()) { finish(null); return; }
        let canonicalId: unknown = input;
        if (!input.startsWith(USER_PREFIX)) {
          // Fehlende/defekte Auflösung darf eine Anzeigenamenkollision niemals
          // still auf ein anderes Konto (etwa system.user.admin) umlenken.
          if (typeof adapter.getUserID !== 'function') { finish(null); return; }
          canonicalId = await adapter.getUserID(input);
          if (!isActive()) { finish(null); return; }
          if (canonicalId === undefined) {
            const forbidden = adapter.FORBIDDEN_CHARS instanceof RegExp ? adapter.FORBIDDEN_CHARS : CONTROLLER_FORBIDDEN_CHARS;
            canonicalId = USER_PREFIX + input.replace(forbidden, '_').replace(/\s/g, '_').replace(/\./g, '_').toLowerCase();
          }
        }
        if (!isActive() || !isCanonicalUserId(canonicalId)) { finish(null); return; }
        const user = canonicalId.slice(USER_PREFIX.length);
        const before = await readAccountSecurity(adapter, user);
        if (!isActive() || !before) { finish(null); return; }
        const verified = await checkCanonicalPassword(canonicalId);
        if (!isActive() || !verified) { finish(null); return; }
        const after = await readAccountSecurity(adapter, user);
        if (!isActive() || !after || before !== after) { finish(null); return; }
        finish({ user, credentialVersion: after });
      } catch (_error: unknown) { finish(null); }
    };
    void run();
  });
}
