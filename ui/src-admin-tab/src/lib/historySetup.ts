/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft öffentliche Historie-API-Antworten und bildet den ausdrücklichen Installer-Entwurf auf den schmalen Speichervertrag ab.
 * Daten und Wirkung: Nur reine Browserfunktionen, keine Netzwerk-/Speicherzugriffe. Tokens und CA-Inhalte aus Antworten werden verworfen. Statuszeitpunkte sind Epoch-Millisekunden; Prüfungen bestätigen keinen Schreibzugriff.
 * Bei Änderungen: Backendvertrag, Zielwechsel mit gespeichertem Token, Entwurferhalt, getrennte Lese-/Schreibfehler und EOS-Rollenprüfung gemeinsam testen.
 * Verknüpfungen: docs/quellcode/src-admin-tab/src/lib/historySetup.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
export type HistoryProvider = 'adapter' | 'influxdb2';
export interface HistoryConfig {
  provider: HistoryProvider;
  instance: string;
  influxdb2: { url: string; organization: string; bucket: string; hasToken: boolean; hasCaCertificate: boolean };
}
export interface HistoryStatus {
  provider: HistoryProvider;
  state: string;
  queueDepth: number | null;
  droppedPoints: number | null;
  lastWriteAt: number | null;
  lastReadAt: number | null;
  lastError: string;
  readError: string;
  writeError: string;
  legacyRecordingCount: number | null;
  writeVerified: boolean;
}
export interface HistoryResponse { config: HistoryConfig; configurationRevision: string; status: HistoryStatus }
export interface HistoryDraft {
  provider: HistoryProvider; instance: string; url: string; organization: string; bucket: string;
  token: string; caCertificate: string; clearCaCertificate: boolean;
}
export interface HistoryCheck { reachable: boolean; readable: boolean }
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function text(value: unknown, max = 2048): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max) throw new Error('EOS_HISTORY_RESPONSE_INVALID');
  return value;
}
function count(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null; }
function provider(value: unknown): HistoryProvider {
  if (value === undefined || value === '' || value === 'adapter') return 'adapter';
  if (value === 'influxdb2') return value;
  throw new Error('EOS_HISTORY_RESPONSE_INVALID');
}
/** Nur bekannte öffentliche Felder werden übernommen; eine unvollständige Antwort darf Speichern nicht freigeben. */
export function parseHistoryResponse(value: unknown): HistoryResponse {
  if (!record(value) || value.ok !== true || !record(value.config) || !record(value.status)) throw new Error('EOS_HISTORY_RESPONSE_INVALID');
  const direct = value.config.influxdb2;
  if (direct !== undefined && !record(direct)) throw new Error('EOS_HISTORY_RESPONSE_INVALID');
  const revision = text(value.configurationRevision, 128);
  if (!revision) throw new Error('EOS_HISTORY_RESPONSE_INVALID');
  return {
    configurationRevision: revision,
    config: { provider: provider(value.config.provider), instance: text(value.config.instance, 256), influxdb2: {
      url: text(direct?.url), organization: text(direct?.organization, 256), bucket: text(direct?.bucket, 256),
      hasToken: direct?.hasToken === true, hasCaCertificate: direct?.hasCaCertificate === true,
    } },
    status: { provider: provider(value.status.provider), state: text(value.status.state, 64),
      queueDepth: count(value.status.queueDepth), droppedPoints: count(value.status.droppedPoints),
      lastWriteAt: count(value.status.lastWriteAt), lastReadAt: count(value.status.lastReadAt),
      lastError: text(value.status.lastError, 256), readError: text(value.status.readError, 256),
      writeError: text(value.status.writeError, 256), legacyRecordingCount: count(value.status.legacyRecordingCount),
      writeVerified: value.status.writeVerified === true },
  };
}
export function historyDraft(config: HistoryConfig): HistoryDraft {
  return { provider: config.provider, instance: config.instance, url: config.influxdb2.url,
    organization: config.influxdb2.organization, bucket: config.influxdb2.bucket,
    token: '', caCertificate: '', clearCaCertificate: false };
}
function directUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('EOS_INFLUX_URL_INVALID'); }
  if (value.length > 2048 || !['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash || url.pathname.includes('/api/')) throw new Error('EOS_INFLUX_URL_INVALID');
  return url;
}
/** Sendet ausschließlich bearbeitbare Felder. Bestehende Historie-DPs/Einstellungen führt das Backend zusammen.
 * Leere Zugangsfelder bedeuten Beibehalten, jedoch nie Tokenweitergabe an einen anderen Origin.
 */
export function historyPayload(draft: HistoryDraft, saved: HistoryConfig): Record<string, unknown> {
  if (draft.provider === 'adapter') return { provider: 'adapter', instance: draft.instance.trim() };
  const url = directUrl(draft.url);
  if (!draft.organization.trim() || !draft.bucket.trim() || draft.organization.length > 256 || draft.bucket.length > 256) throw new Error('EOS_INFLUX_CONFIG_INVALID');
  if (!draft.token.trim()) {
    if (!saved.influxdb2.hasToken) throw new Error('EOS_INFLUX_TOKEN_REQUIRED');
    let sameOrigin = false;
    try { sameOrigin = directUrl(saved.influxdb2.url).origin === url.origin; } catch { sameOrigin = false; }
    if (!sameOrigin) throw new Error('EOS_INFLUX_TOKEN_ORIGIN_CHANGED');
  }
  if (draft.token.length > 8192 || draft.caCertificate.length > 65536) throw new Error('EOS_INFLUX_CONFIG_INVALID');
  if ((draft.caCertificate.trim() && url.protocol !== 'https:') || (draft.caCertificate.trim() && draft.clearCaCertificate)) throw new Error('EOS_INFLUX_CA_INVALID');
  return { provider: 'influxdb2', influxdb2: { url: draft.url.trim(), organization: draft.organization.trim(),
    bucket: draft.bucket.trim(), token: draft.token.trim(), caCertificate: draft.caCertificate.trim(), clearCaCertificate: draft.clearCaCertificate } };
}
/** Ein lesender Verbindungstest liefert keine Schreibfreigabe; ein zusätzliches Antwortflag bleibt unbeachtet. */
export function parseHistoryCheck(value: unknown): HistoryCheck {
  if (!record(value) || value.ok !== true || !record(value.check) || typeof value.check.reachable !== 'boolean' || typeof value.check.readable !== 'boolean') throw new Error('EOS_HISTORY_RESPONSE_INVALID');
  // A read-only check cannot establish write authorization, regardless of remote flags.
  return { reachable: value.check.reachable, readable: value.check.readable };
}
const errors = new Map<string, string>([
  ['EOS_INFLUX_AUTHORIZATION_FAILED', 'InfluxDB lehnt den Zugriff ab (401/403). Token sowie Lese- und Schreibrechte für den Bucket prüfen.'],
  ['EOS_INFLUX_NOT_FOUND', 'InfluxDB-Endpunkt oder Bucket nicht gefunden. Serveradresse, Organisation und Bucket prüfen.'],
  ['EOS_INFLUX_TLS_FAILED', 'Das TLS-Zertifikat konnte nicht geprüft werden. Servername, Zertifikatsgültigkeit und gegebenenfalls das CA-Zertifikat prüfen.'],
  ['EOS_INFLUX_CA_INVALID', 'Das CA-Zertifikat ist ungültig oder passt nicht zur Auswahl. PEM nur mit HTTPS verwenden; Ersetzen und Entfernen nicht gleichzeitig wählen.'],
  ['EOS_INFLUX_CONNECTION_FAILED', 'InfluxDB ist nicht erreichbar. Adresse, Port und Netzwerkverbindung prüfen.'],
  ['EOS_INFLUX_TIMEOUT', 'InfluxDB antwortet nicht rechtzeitig. Verbindung und Server prüfen.'],
  ['EOS_INFLUX_URL_INVALID', 'Eine vollständige Serveradresse mit http:// oder https:// und gegebenenfalls Port eintragen. Keine Zugangsdaten oder /api/-Adresse verwenden.'],
  ['EOS_INFLUX_CONFIG_INVALID', 'InfluxDB-Einstellungen sind unvollständig oder ungültig. Organisation, Bucket und Zugangsdaten prüfen.'],
  ['EOS_INFLUX_TOKEN_REQUIRED', 'Für diese Verbindung muss ein InfluxDB-Token eingetragen werden.'],
  ['EOS_INFLUX_TOKEN_ORIGIN_CHANGED', 'Die Serveradresse oder der Port wurde geändert. Dafür einen Token neu eingeben; der gespeicherte Token wird nicht an ein anderes Ziel gesendet.'],
  ['EOS_INFLUX_REDIRECT_REJECTED', 'InfluxDB leitet die Anfrage um. Die endgültige Serveradresse direkt eintragen.'],
  ['EOS_INFLUX_RATE_LIMITED', 'InfluxDB begrenzt derzeit die Anfragen. Später erneut prüfen.'],
  ['EOS_INFLUX_NEW_DESTINATION_REQUIRES_TOKEN', 'Die Serveradresse oder der Port wurde geändert. Dafür einen Token neu eingeben; der gespeicherte Token wird nicht an ein anderes Ziel gesendet.'],
  ['EOS_INFLUX_TOKEN_INVALID', 'Der InfluxDB-Token fehlt oder ist ungültig. Einen gültigen Token für den gewählten Bucket eintragen.'],
  ['EOS_INFLUX_PROVIDER_INVALID', 'Für diese Verbindungsprüfung „InfluxDB 2 direkt“ auswählen.'],
  ['EOS_INFLUX_HTTP_REQUIRES_LOCAL_ADDRESS', 'Unverschlüsseltes HTTP ist nur für lokale Serveradressen erlaubt. Für einen externen InfluxDB-Server HTTPS verwenden.'],
  ['EOS_INFLUX_ADDRESS_FORBIDDEN', 'Diese Serveradresse ist für die Historie-Anbindung nicht zulässig. Eine reguläre InfluxDB-Serveradresse verwenden.'],
  ['EOS_INFLUX_CHECK_BUSY', 'Eine Verbindungsprüfung läuft bereits. Kurz warten und anschließend erneut prüfen.'],
  ['EOS_INFLUX_CONFIG_BUSY', 'Andere Einstellungen werden gerade gespeichert. Kurz warten; der Entwurf bleibt erhalten.'],
  ['EOS_INFLUX_CONFIG_SAVE_FAILED', 'Die Historie-Einstellungen konnten nicht gespeichert werden. Der Entwurf bleibt erhalten. Speicherstatus und EOS-Protokoll prüfen.'],
  ['EOS_INFLUX_TOKEN_ENCRYPTION_FAILED', 'Der Token konnte nicht sicher gespeichert werden. EOS-Systemkonfiguration und Protokoll prüfen; der Entwurf bleibt erhalten.'],
  ['EOS_INFLUX_TOKEN_DECRYPTION_FAILED', 'Der gespeicherte Token konnte nicht gelesen werden. Einen Token erneut eingeben und ausdrücklich speichern.'],
  ['EOS_INFLUX_NOT_READY', 'Der InfluxDB-Server meldet sich noch nicht als betriebsbereit. Serverstatus prüfen.'],
  ['EOS_INFLUX_NOT_CONFIGURED', 'Die direkte InfluxDB-Verbindung ist noch nicht eingerichtet. Einstellungen prüfen und speichern.'],
  ['EOS_INFLUX_BUSY', 'Die Historie ist momentan ausgelastet. Später erneut prüfen.'],
  ['EOS_INFLUX_QUEUE_FULL', 'Die Historie-Warteschlange ist voll; Messwerte wurden verworfen. Serververbindung und Schreibzugriff prüfen.'],
  ['EOS_INFLUX_RESPONSE_INVALID', 'InfluxDB hat keine gültige Antwort geliefert. Serverversion und Verbindung prüfen.'],
  ['EOS_INFLUX_RESPONSE_LIMIT', 'Die Antwort von InfluxDB überschreitet die zulässige Größe. Abfrage und Server prüfen.'],
  ['EOS_INFLUX_REQUEST_FAILED', 'InfluxDB hat die Anfrage abgelehnt. Organisation, Bucket, Token und Serverstatus prüfen.'],
  ['EOS_UI_OWNERSHIP_REQUIRED', 'EOS besitzt aktuell keine Betriebsfreigabe für diese Änderung. Systemfreigabe und Bestandsübernahme prüfen.'],
  ['EOS_INSTALLER_CONFIG_CONFLICT', 'Die Einstellungen wurden inzwischen geändert. Der Entwurf bleibt erhalten. Den gespeicherten Stand vor einem erneuten Speichern neu laden.'],
  ['EOS_HISTORY_RESPONSE_INVALID', 'Die Antwort der Historie ist unvollständig. Es wurde kein Erfolg bestätigt.'],
]);
/** Nur feste Fehlertexte anzeigen; ungefilterte Servermeldungen können Verbindungsdaten oder Zugangsdaten enthalten. */
export function historyError(error: unknown): string {
  const item = record(error) ? error : null;
  const payload = item && record(item.payload) ? item.payload : null;
  const code = typeof payload?.error === 'string' ? payload.error : typeof item?.code === 'string' ? item.code : error instanceof Error ? error.message : '';
  if (payload?.saved === true) return 'Die Einstellungen wurden gespeichert, konnten aber noch nicht vollständig aktiviert werden. Den gespeicherten Stand neu laden und die EOS-Betriebsfreigabe prüfen.';
  const mapped = errors.get(code);
  if (mapped) return mapped;
  if (item?.status === 409) return errors.get('EOS_INSTALLER_CONFIG_CONFLICT') || 'Die Einstellungen wurden inzwischen geändert.';
  if (item?.status === 401) return 'Die EOS-Sitzung ist abgelaufen. Bitte erneut anmelden; der Entwurf bleibt geöffnet.';
  if (item?.status === 403) return 'Für diese Einrichtung ist eine Installer- oder Admin-Freigabe erforderlich.';
  return 'Die Historie-Anfrage konnte nicht abgeschlossen werden. Einstellungen und Verbindung prüfen. Der Entwurf bleibt erhalten.';
}
export function historyDate(value: number | null): string {
  return value !== null && value > 0 && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString('de-DE') : 'Noch nicht bestätigt';
}
export function historyState(status: HistoryStatus | null): string {
  if (!status) return 'Noch nicht bekannt';
  if (status.state === 'ready') return status.lastReadAt || status.lastWriteAt ? 'Eingerichtet' : 'Eingerichtet; Zugriff noch nicht bestätigt';
  if (status.state === 'error') return 'Fehler';
  if (status.state === 'disabled') return 'Direktverbindung deaktiviert';
  if (status.state === 'closed') return 'Verbindung geschlossen';
  return 'Noch nicht bekannt';
}
