import React, { useEffect, useRef, useState, type JSX } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import { I18n } from '@iobroker/gui-components';
import {
    licenseErrorCode,
    parsePublicKeyFile,
    requestLicense,
    requestTrustExport,
    requestTrustStatus,
    requestTrustUpdate,
    type EosLicenseStatus,
    type EosTrustStatus,
} from './eosLicenseApi';

type Action = 'refresh' | 'activate' | 'remove' | 'import' | 'recheck' | 'export';

export default function EosLicenseDialog(): JSX.Element {
    const de = I18n.getLanguage() === 'de';
    const tr = (german: string, english: string): string => (de ? german : english);
    const [status, setStatus] = useState<EosLicenseStatus | null>(null);
    const [trust, setTrust] = useState<EosTrustStatus | null>(null);
    const [tab, setTab] = useState(0);
    const [busy, setBusy] = useState(false);
    const [token, setToken] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [confirmRemove, setConfirmRemove] = useState(false);
    const request = useRef<AbortController | null>(null);
    const mounted = useRef(false);

    const errorText = (code: string): string => {
        const messages: Record<string, string> = {
            LICENSE_MISSING: tr(
                'Keine Lizenz aktiviert. Prüfschlüssel prüfen und den für diese UUID ausgestellten Code eingeben.',
                'No license activated. Check verification keys and enter the code issued for this UUID.',
            ),
            LICENSE_VALID: tr('Lizenz gültig.', 'License valid.'),
            LICENSE_EXPIRED: tr(
                'Lizenz abgelaufen. Einen erneuerten Lizenzcode anfordern.',
                'License expired. Request a renewed license code.',
            ),
            LICENSE_UUID_MISMATCH: tr(
                'Die Lizenz gehört zu einer anderen System-UUID. Einen passenden Lizenzcode anfordern.',
                'The license belongs to another system UUID. Request a matching license code.',
            ),
            LICENSE_UUID_CHANGED: tr(
                'Die System-UUID hat sich geändert. Sicherung und Systemzuordnung mit dem Service prüfen.',
                'The system UUID changed. Check the backup and system assignment with support.',
            ),
            LICENSE_SIGNATURE_INVALID: tr(
                'Die Signatur ist ungültig. Unveränderten Code und Prüfschlüssel des Ausstellers prüfen.',
                'The signature is invalid. Check the unchanged code and issuer verification key.',
            ),
            LICENSE_KEY_UNKNOWN: tr(
                'Der öffentliche Schlüssel des Ausstellers fehlt. Im Reiter „Öffentliche Prüfschlüssel & Wiederherstellung“ einen freigegebenen öffentlichen Schlüssel importieren oder den Service kontaktieren.',
                'The issuer public key is missing. Import an approved public key in the verification keys tab or contact support.',
            ),
            LICENSE_FORMAT: tr(
                'Bitte den vollständigen EOS-Lizenzcode eingeben.',
                'Enter the complete EOS license code.',
            ),
            LICENSE_FORMAT_INVALID: tr(
                'Das Lizenzformat ist ungültig. Vollständigen NWL3- oder vorhandenen NWL2-Code prüfen.',
                'The license format is invalid. Check the complete NWL3 or existing NWL2 code.',
            ),
            LICENSE_CLAIMS_INVALID: tr(
                'Der signierte Lizenzumfang ist ungültig. Ersatzcode beim Aussteller anfordern.',
                'The signed license scope is invalid. Request a replacement code from the issuer.',
            ),
            LICENSE_ADMIN_REQUIRED: tr(
                'Mit einem Administrator-Konto anmelden.',
                'Sign in with an administrator account.',
            ),
            LICENSE_HTTPS_REQUIRED: tr('NexoWatt EOS über HTTPS öffnen.', 'Open NexoWatt EOS over HTTPS.'),
            LICENSE_ORIGIN: tr(
                'Diese Seite über dieselbe EOS-Adresse erneut öffnen und anmelden.',
                'Reopen this page using the same EOS address and sign in.',
            ),
            LICENSE_CLOCK_ROLLBACK: tr(
                'Systemdatum und Uhrzeit prüfen. Bei einer wiederhergestellten Sicherung den Service kontaktieren.',
                'Check the system date and time. Contact support after restoring a backup.',
            ),
            LICENSE_RATE_LIMIT: tr(
                'Zu viele Anfragen. Kurz warten und Status erneut prüfen.',
                'Too many requests. Wait briefly and refresh the status.',
            ),
            TRUST_READY: tr('Öffentliche Prüfschlüssel sind eingerichtet.', 'Public verification keys are configured.'),
            TRUST_MISSING: tr(
                'Keine aktiven Prüfschlüssel. Eine freigegebene öffentliche JSON-Datei importieren oder die OS-Vertrauensdatei durch den zuständigen Administrator einrichten lassen.',
                'No active verification keys. Import an approved public JSON file or have the responsible administrator configure the OS trust file.',
            ),
            TRUST_IMPORT_UNKNOWN_KEY: tr(
                'Mindestens ein Schlüssel ist nicht freigegeben. Es wurde nichts übernommen. Der Aussteller benötigt eine autorisierte OS-Bereitstellung oder eine neue Herstellerfreigabe im Adapter.',
                'At least one key is not approved. Nothing was imported. The issuer requires authorized OS provisioning or a new manufacturer approval in the adapter.',
            ),
            TRUST_KEY_CONFLICT: tr(
                'Eine Schlüssel-ID bezeichnet unterschiedliche Schlüssel. Es wurde nichts übernommen. Mit dem Aussteller die passende Datei prüfen; vorhandene Schlüssel nicht löschen.',
                'A key ID refers to different keys. Nothing was imported. Check the correct file with the issuer; do not delete existing keys.',
            ),
            TRUST_INVALID: tr(
                'Ungültige öffentliche Schlüsseldatei. Erwartet wird eine JSON-Zuordnung von Schlüssel-ID zu öffentlichem Ed25519-SPKI-PEM, ohne Zusatzfelder.',
                'Invalid public key file. Expected JSON mapping key IDs to public Ed25519 SPKI PEM values, without extra fields.',
            ),
            TRUST_PRIVATE_MATERIAL: tr(
                'Privater Schlüssel oder Tresor erkannt. Diese Datei gehört ausschließlich in den Key-Generator und wird nicht an EOS übertragen.',
                'Private key or vault detected. This file belongs only in the key generator and is not sent to EOS.',
            ),
            TRUST_FILE_SIZE: tr(
                'Die öffentliche JSON-Datei muss 1 bis 32768 Byte enthalten, mit höchstens 32 Schlüsseln.',
                'The public JSON file must contain 1 to 32768 bytes, with at most 32 keys.',
            ),
            TRUST_FILE_MISSING: tr(
                'Die konfigurierte OS-Vertrauensdatei fehlt. Den zuständigen Administrator die Datei wiederherstellen lassen; anschließend erneut prüfen.',
                'The configured OS trust file is missing. Ask the responsible administrator to restore it, then recheck.',
            ),
            TRUST_READ_DENIED: tr(
                'Die OS-Vertrauensdatei ist nicht lesbar. Leserechte und Eigentümer durch den zuständigen Administrator prüfen lassen; anschließend erneut prüfen.',
                'The OS trust file cannot be read. Ask the responsible administrator to check read access and ownership, then recheck.',
            ),
            TRUST_KEY_LIMIT: tr(
                'Zusammen wären mehr als 32 Prüfschlüssel aktiv. Mit dem Aussteller einen zulässigen Schlüsselbestand planen; vorhandene Schlüssel nicht unkontrolliert entfernen.',
                'More than 32 verification keys would be active. Plan an allowed key set with the issuer; do not remove existing keys without review.',
            ),
            TRUST_RELEASE_METADATA: tr(
                'Die Herstellerfreigaben dieser Adapterversion sind ungültig. Das geprüfte Adapterpaket wiederherstellen und den Service kontaktieren.',
                'Manufacturer approvals in this adapter release are invalid. Restore the verified adapter package and contact support.',
            ),
            TRUST_STARTING: tr(
                'Die Prüfschlüsselverwaltung wird noch gestartet. Kurz warten und den Status erneut prüfen.',
                'Verification key management is still starting. Wait briefly and refresh the status.',
            ),
            SERVICE_DIRECTORY: tr(
                'Das geschützte Datenverzeichnis ist nicht verfügbar. Einrichtung, Rechte und Sicherung mit dem Service prüfen; keine Dateien löschen.',
                'The protected data directory is unavailable. Check setup, permissions and backup with support; do not delete files.',
            ),
            TRUST_PERMISSIONS: tr(
                'OS-Vertrauensdatei oder Pfadrechte sind unsicher. Den zuständigen Administrator die Eigentümer und Schreibrechte prüfen lassen; anschließend erneut prüfen.',
                'The OS trust file or path permissions are unsafe. Ask the responsible administrator to check ownership and write permissions, then recheck.',
            ),
            LICENSE_RESPONSE: tr(
                'Die Serverantwort konnte nicht bestätigt werden. Status erneut prüfen; bei Wiederholung den Fehlercode an den Service geben.',
                'The server response could not be confirmed. Refresh the status; contact support with the code if repeated.',
            ),
            TRUST_RESPONSE: tr(
                'Die Prüfschlüssel-Antwort konnte nicht bestätigt werden. Status erneut prüfen und bei Wiederholung den Service kontaktieren.',
                'The verification key response could not be confirmed. Refresh the status and contact support if repeated.',
            ),
            SERVICE_TIMEOUT: tr(
                'Zeitüberschreitung. Der aktuelle Status ist unbestätigt; eine gespeicherte Lizenz wurde dadurch nicht als ungültig erkannt. Verbindung prüfen und Status aktualisieren.',
                'Request timed out. The current status is unconfirmed; this does not identify a stored license as invalid. Check the connection and refresh.',
            ),
            SERVICE_STALE: tr(
                'Die Lizenzprüfung ist nicht aktuell. Dienstzustand prüfen und den Status neu abrufen.',
                'The license check is not current. Check service health and refresh the status.',
            ),
            SERVICE_UNAVAILABLE: tr(
                'Lizenzverwaltung derzeit nicht bereit. Verbindung, Dienstzustand und Prüfschlüssel prüfen; anschließend Status aktualisieren.',
                'License management is not ready. Check the connection, service health and verification keys, then refresh.',
            ),
        };
        if (messages[code]) {
            return messages[code];
        }
        if (code.startsWith('STORAGE_')) {
            return tr(
                'Der geschützte Lizenzspeicher konnte nicht sicher gelesen oder geschrieben werden. Datenverzeichnis, Rechte und vollständige Sicherung mit dem Service prüfen. Keine Speicherdateien löschen; anschließend erneut prüfen.',
                'The protected license store could not be read or written safely. Check the data directory, permissions and complete backup with support. Do not delete store files; then recheck.',
            );
        }
        if (code.startsWith('TRUST_')) {
            return tr(
                'Die Prüfschlüssel konnten nicht sicher geladen werden. Öffentliche Datei, Freigabe und OS-Dateirechte prüfen; anschließend „Erneut prüfen“ wählen.',
                'Verification keys could not be loaded safely. Check the public file, approval and OS file permissions, then choose Recheck.',
            );
        }
        return tr(
            'Anfrage nicht bestätigt. Den angezeigten Fehlercode mit dem Service prüfen und den Status erneut abrufen.',
            'Request unconfirmed. Check the displayed error code with support and refresh the status.',
        );
    };

    const run = async (action: Action, activationCode?: string, selectedFile?: File): Promise<void> => {
        if (request.current) {
            return;
        }
        const controller = new AbortController();
        request.current = controller;
        setBusy(true);
        setError('');
        setMessage('');
        setStatus(null);
        setTrust(null);
        const active = (): boolean => mounted.current && request.current === controller && !controller.signal.aborted;
        try {
            let nextStatus: EosLicenseStatus;
            let nextTrust: EosTrustStatus;
            if (action === 'import' || action === 'recheck') {
                if (action === 'import' && !selectedFile) {
                    throw new Error('TRUST_INVALID');
                }
                const keys = selectedFile ? await parsePublicKeyFile(selectedFile) : undefined;
                if (!active()) {
                    return;
                }
                const result = await requestTrustUpdate(action, controller.signal, keys);
                nextStatus = result.license;
                nextTrust = result.trust;
            } else {
                if (action === 'export') {
                    const keys = await requestTrustExport(controller.signal);
                    if (!active()) {
                        return;
                    }
                    const url = URL.createObjectURL(
                        new Blob([`${JSON.stringify(keys, null, 2)}\n`], { type: 'application/json' }),
                    );
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'nexowatt-license-public-trust.json';
                    document.body.append(link);
                    link.click();
                    link.remove();
                    // The browser consumes the public download asynchronously.
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
                [nextStatus, nextTrust] = await Promise.all([
                    requestLicense(
                        action === 'activate' || action === 'remove' ? action : 'status',
                        controller.signal,
                        activationCode,
                    ),
                    requestTrustStatus(controller.signal),
                ]);
            }
            if (!active()) {
                return;
            }
            if (nextStatus.valid && !nextTrust.ready) {
                throw new Error(nextTrust.code);
            }
            setStatus(nextStatus);
            setTrust(nextTrust);
            if (action === 'activate') {
                setMessage(
                    nextStatus.coreEnabled
                        ? tr(
                              'EOS-Systemlizenz geprüft und verschlüsselt gespeichert. Die gemeinsame Aktivierung gilt auch nach Neustarts.',
                              'EOS system license verified and stored encrypted. The shared activation persists after restarts.',
                          )
                        : tr(
                              'Lizenz gespeichert. Diese NWL2-Lizenz umfasst nur die signierten Erweiterungen und schaltet den EOS-Kern nicht frei.',
                              'License stored. This NWL2 license covers only its signed extensions and does not enable the EOS core.',
                          ),
                );
            }
            if (action === 'remove') {
                setMessage(tr('Lizenz entfernt.', 'License removed.'));
            }
            if (action === 'import') {
                setMessage(
                    tr(
                        'Freigegebene öffentliche Prüfschlüssel gespeichert; Lizenzstatus neu geprüft. Der gespeicherte Lizenzcode wurde nicht ersetzt.',
                        'Approved public verification keys stored and license status rechecked. The stored license code was not replaced.',
                    ),
                );
            }
            if (action === 'recheck') {
                setMessage(
                    tr(
                        'Prüfschlüssel und Lizenzstatus neu eingelesen. Keine Dateien gelöscht.',
                        'Verification keys and license status reloaded. No files were deleted.',
                    ),
                );
            }
            if (action === 'export') {
                setMessage(
                    tr(
                        'Nur öffentliche Prüfschlüssel als JSON exportiert. Dies ist keine Sicherung des privaten Key-Generator-Tresors.',
                        'Only public verification keys exported as JSON. This is not a backup of the private key generator vault.',
                    ),
                );
            }
        } catch (cause) {
            if (!mounted.current || request.current !== controller || controller.signal.aborted) {
                return;
            }
            controller.abort();
            setStatus(null);
            setTrust(null);
            setError(licenseErrorCode(cause));
        } finally {
            if (request.current === controller) {
                request.current = null;
                if (mounted.current) {
                    setBusy(false);
                }
            }
        }
    };
    const initialRun = useRef(run);
    useEffect(() => {
        mounted.current = true;
        void initialRun.current('refresh');
        return () => {
            mounted.current = false;
            request.current?.abort();
            request.current = null;
        };
        // A fresh request per mounted panel; later actions are explicit.
    }, []);

    const features: Record<string, string> = {
        energy: tr('Energiemanagement', 'Energy management'),
        wallet: tr('Energie-Wertkonto', 'Energy wallet'),
        smartHome: 'Smart Home',
        microgridSlave: 'Microgrid Slave',
        microgridMaster: 'Microgrid Master',
        multisite: tr('Mehrere Standorte', 'Multiple sites'),
        billing: tr('Abrechnung', 'Billing'),
    };
    const details = [
        [tr('System-UUID', 'System UUID'), status?.uuid || '–'],
        [
            tr('Edition', 'Edition'),
            status?.edition === 'home' ? 'EOS Home' : status?.edition === 'pro' ? 'EOS Pro' : '–',
        ],
        [
            tr('Gültig bis', 'Valid until'),
            status?.valid
                ? status.expiresAt === null
                    ? tr('Dauerhaft', 'Perpetual')
                    : new Date(status.expiresAt).toLocaleString()
                : '–',
        ],
        [
            tr('Ladepunkte / Speicher', 'Charge points / batteries'),
            status?.valid ? `${status.limits.chargePoints} / ${status.limits.batteries}` : '–',
        ],
        [tr('Funktionen', 'Features'), status?.features.map(name => features[name] || name).join(', ') || '–'],
        [
            tr('Freigabe', 'Authorization'),
            status?.valid
                ? status.coreEnabled
                    ? tr('EOS-Kern freigegeben', 'EOS core enabled')
                    : tr(
                          'Nur signierte Erweiterungen; EOS-Kern nicht freigegeben',
                          'Signed extensions only; EOS core not enabled',
                      )
                : '–',
        ],
    ];
    const sourceText = (source: string): string =>
        ({
            os: tr('OS-Vertrauensdatei', 'OS trust file'),
            restored: tr('Lokal wiederhergestellte Kopie', 'Locally restored copy'),
            'os+restored': tr('OS-Vertrauensdatei und lokale Kopie', 'OS trust file and local copy'),
            release: tr('Herstellerfreigabe dieser Adapterversion', 'Manufacturer approval in this adapter release'),
            'release+os': tr('Herstellerfreigabe und OS-Vertrauensdatei', 'Manufacturer approval and OS trust file'),
        })[source] || source;
    const diagnostic = error || status?.code;
    const diagnosticView = diagnostic ? (
        <Alert
            severity={error || !status?.valid ? 'warning' : 'success'}
            role={error ? 'alert' : 'status'}
        >
            <strong>{diagnostic}</strong>: {errorText(diagnostic)}
        </Alert>
    ) : null;

    return (
        <Box
            sx={{ height: '100%', overflow: 'auto', p: 3, boxSizing: 'border-box' }}
            data-eos-license-panel="1"
        >
            <Stack
                spacing={2}
                sx={{ maxWidth: 960, mx: 'auto' }}
            >
                <Typography variant="h5">
                    {tr('NexoWatt EOS Lizenzverwaltung', 'NexoWatt EOS license management')}
                </Typography>
                <Typography>
                    {tr(
                        'Eine gemeinsame Systemlizenz für Dashboard und Systemverwaltung. Einmalige Aktivierung nach der Erstanmeldung; keine zweite Lizenz pro Oberfläche.',
                        'One shared system license for the dashboard and system management. Activate once after the first sign-in; no separate license for each interface.',
                    )}
                </Typography>
                <Card variant="outlined">
                    <CardContent>
                        <Stack
                            direction="row"
                            spacing={2}
                            sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap' }}
                        >
                            <Typography variant="h6">{tr('Aktueller Status', 'Current status')}</Typography>
                            <Chip
                                label={
                                    busy
                                        ? tr('Wird geprüft …', 'Checking …')
                                        : status
                                          ? errorText(status.code)
                                          : tr('Status unbestätigt', 'Status unconfirmed')
                                }
                                color={status?.valid && !busy ? 'success' : 'default'}
                            />
                        </Stack>
                        {diagnosticView}
                        <Box
                            component="dl"
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: '190px 1fr' },
                                gap: 1,
                                '& dd': { m: 0, overflowWrap: 'anywhere' },
                                '& dt': { fontWeight: 600 },
                            }}
                        >
                            {details.map(([label, value]) => (
                                <React.Fragment key={label}>
                                    <Box component="dt">{label}</Box>
                                    <Box component="dd">{value}</Box>
                                </React.Fragment>
                            ))}
                        </Box>
                        <Button
                            data-eos-license-refresh="1"
                            disabled={busy}
                            onClick={() => void run('refresh')}
                        >
                            {tr('Status aktualisieren', 'Refresh status')}
                        </Button>
                    </CardContent>
                </Card>
                {message ? (
                    <Alert
                        severity="success"
                        role="status"
                    >
                        {message}
                    </Alert>
                ) : null}
                <Tabs
                    value={tab}
                    onChange={(_event, value: number) => setTab(value)}
                    variant="scrollable"
                    scrollButtons="auto"
                    aria-label={tr('Lizenzverwaltung', 'License management')}
                >
                    <Tab
                        id="eos-license-tab"
                        aria-controls="eos-license-content"
                        label={tr('Lizenz', 'License')}
                    />
                    <Tab
                        id="eos-trust-tab"
                        aria-controls="eos-trust-content"
                        label={tr(
                            'Öffentliche Prüfschlüssel & Wiederherstellung',
                            'Public verification keys & recovery',
                        )}
                    />
                </Tabs>
                <Box
                    role="tabpanel"
                    id="eos-license-content"
                    aria-labelledby="eos-license-tab"
                    hidden={tab !== 0}
                >
                    <Card variant="outlined">
                        <CardContent>
                            <Typography
                                variant="h6"
                                gutterBottom
                            >
                                {tr('Lizenz aktivieren', 'Activate license')}
                            </Typography>
                            <Typography sx={{ mb: 2 }}>
                                {tr(
                                    'Den für diese System-UUID ausgestellten NWL3-Lizenzcode einfügen. Bestehende NWL2-Lizenzen behalten ihren signierten Umfang. Die Prüfung und verschlüsselte Speicherung erfolgen auf dem Gerät.',
                                    'Enter the NWL3 license code issued for this system UUID. Existing NWL2 licenses retain their signed scope. Verification and encrypted storage take place on this device.',
                                )}
                            </Typography>
                            {diagnosticView}
                            <TextField
                                id="eos-license-code"
                                fullWidth
                                multiline
                                minRows={3}
                                disabled={busy}
                                label={tr('Neuer Lizenzcode', 'New license code')}
                                value={token}
                                onChange={event => setToken(event.target.value)}
                                autoComplete="off"
                                sx={{ mt: 2 }}
                                slotProps={{ htmlInput: { maxLength: 16384, spellCheck: false } }}
                            />
                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={1}
                                sx={{ my: 2 }}
                            >
                                <Button
                                    data-eos-license-activate="1"
                                    variant="contained"
                                    disabled={busy || !token.trim()}
                                    onClick={() => {
                                        const code = token;
                                        setToken('');
                                        void run('activate', code);
                                    }}
                                >
                                    {tr('Prüfen und aktivieren', 'Verify and activate')}
                                </Button>
                                <Button
                                    data-eos-license-remove="1"
                                    color="error"
                                    disabled={busy}
                                    onClick={() => setConfirmRemove(true)}
                                >
                                    {tr('Lizenz entfernen', 'Remove license')}
                                </Button>
                            </Stack>
                            <Typography variant="body2">
                                {tr(
                                    'Ein ungültiger Code ersetzt keine gültige Lizenz. Der gespeicherte Code wird nicht zurück angezeigt. Lizenzaktionen wirken sofort und benötigen kein „Speichern und schließen“.',
                                    'An invalid code does not replace a valid license. Stored codes are never displayed. License actions take effect immediately and do not require Save & Close.',
                                )}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
                <Box
                    role="tabpanel"
                    id="eos-trust-content"
                    aria-labelledby="eos-trust-tab"
                    hidden={tab !== 1}
                >
                    <Stack spacing={2}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography
                                    variant="h6"
                                    gutterBottom
                                >
                                    {tr('Aktive öffentliche Prüfschlüssel', 'Active public verification keys')}
                                </Typography>
                                <Typography>
                                    {trust
                                        ? `${trust.code}: ${errorText(trust.code)}`
                                        : tr(
                                              'Prüfschlüsselstatus unbestätigt. Status aktualisieren.',
                                              'Verification key status unconfirmed. Refresh the status.',
                                          )}
                                </Typography>
                                {trust?.keys.map(key => (
                                    <Box
                                        key={key.kid}
                                        sx={{ my: 2, overflowWrap: 'anywhere' }}
                                    >
                                        <Typography
                                            component="h3"
                                            variant="subtitle1"
                                        >
                                            {key.kid} · {sourceText(key.source)}
                                        </Typography>
                                        <Typography
                                            component="code"
                                            variant="body2"
                                        >
                                            SHA-256: {key.fingerprint}
                                        </Typography>
                                    </Box>
                                ))}
                                <Typography sx={{ mt: 2 }}>
                                    {tr(
                                        'Eine lokale Kopie ersetzt keine Freigabe des Ausstellers. Nur Schlüssel mit passender Herstellerfreigabe oder gültiger OS-Vertrauensquelle werden akzeptiert.',
                                        'A local copy does not replace issuer approval. Only keys matching manufacturer approval or a valid OS trust source are accepted.',
                                    )}
                                </Typography>
                                <Button
                                    disabled={busy}
                                    onClick={() => void run('recheck')}
                                >
                                    {tr('Vertrauen und Lizenz erneut prüfen', 'Recheck trust and license')}
                                </Button>
                                <Button
                                    disabled={busy || !trust?.ready}
                                    onClick={() => void run('export')}
                                >
                                    {tr('Öffentliche Schlüssel exportieren', 'Export public keys')}
                                </Button>
                            </CardContent>
                        </Card>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography
                                    variant="h6"
                                    gutterBottom
                                >
                                    {tr('Öffentliche JSON-Datei importieren', 'Import public JSON file')}
                                </Typography>
                                <Typography>
                                    {tr(
                                        'Höchstens 32768 Byte und 32 öffentliche Ed25519-Schlüssel. Der Dateiname ist beliebig. Nur die flache Zuordnung Schlüssel-ID → PUBLIC KEY ist erlaubt. Ein unbekannter oder widersprüchlicher Schlüssel weist den gesamten Import zurück.',
                                        'At most 32768 bytes and 32 public Ed25519 keys. Any filename is accepted. Only a flat key ID → PUBLIC KEY mapping is allowed. An unknown or conflicting key rejects the whole import.',
                                    )}
                                </Typography>
                                <Box
                                    component="input"
                                    type="file"
                                    disabled={busy || !trust?.canImport}
                                    aria-label={tr('Öffentliche Schlüsseldatei', 'Public key file')}
                                    sx={{ display: 'block', my: 2, maxWidth: '100%' }}
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                        setFile(event.target.files?.[0] || null);
                                        event.target.value = '';
                                    }}
                                />
                                <Typography variant="body2">
                                    {file ? file.name : tr('Keine Datei ausgewählt.', 'No file selected.')}
                                </Typography>
                                <Button
                                    variant="contained"
                                    disabled={busy || !file || !trust?.canImport}
                                    onClick={() => {
                                        const selected = file;
                                        setFile(null);
                                        if (selected) {
                                            void run('import', undefined, selected);
                                        }
                                    }}
                                >
                                    {tr(
                                        'Öffentliche Schlüssel prüfen und importieren',
                                        'Verify and import public keys',
                                    )}
                                </Button>
                                {trust && !trust.canImport ? (
                                    <Alert
                                        severity="warning"
                                        sx={{ mt: 2 }}
                                    >
                                        {tr(
                                            'Import derzeit nicht freigegeben. Angezeigten Prüfschlüsselstatus und OS-Vertrauenskonfiguration mit dem zuständigen Administrator prüfen.',
                                            'Import is not currently allowed. Check the displayed verification key status and OS trust configuration with the responsible administrator.',
                                        )}
                                    </Alert>
                                ) : null}
                                <Typography
                                    variant="h6"
                                    sx={{ mt: 3 }}
                                >
                                    {tr('Für Import zugelassene Schlüssel', 'Keys approved for import')}
                                </Typography>
                                {trust?.allowedKeys.map(key => (
                                    <Box
                                        key={key.kid}
                                        sx={{ my: 2, overflowWrap: 'anywhere' }}
                                    >
                                        <Typography>
                                            {key.kid} · {sourceText(key.source)}
                                        </Typography>
                                        <Typography
                                            component="code"
                                            variant="body2"
                                        >
                                            SHA-256: {key.fingerprint}
                                        </Typography>
                                    </Box>
                                ))}
                                <Typography variant="body2">
                                    {tr(
                                        'Eine angezeigte Herstellerfreigabe allein aktiviert keinen Schlüssel. Ohne OS-Vertrauensdatei ist der ausdrückliche Import erforderlich.',
                                        'A displayed manufacturer approval alone does not activate a key. Without an OS trust file, explicit import is required.',
                                    )}
                                </Typography>
                            </CardContent>
                        </Card>
                        <Alert severity="info">
                            <strong>{tr('Key-Generator auf einem neuen PC', 'Key generator on a new PC')}</strong>
                            <br />
                            {tr(
                                'Für die Wiederherstellung wird die verschlüsselte Sicherung des privaten Key-Generator-Tresors mit der zugehörigen Passphrase im Key-Generator benötigt. Tresor, private Schlüssel und Passphrase niemals in EOS hochladen. Die öffentliche JSON-Datei dient nur der Lizenzprüfung und kann den privaten Signierschlüssel nicht wiederherstellen.',
                                'Recovery requires the encrypted backup of the private key generator vault and its passphrase in the key generator. Never upload the vault, private keys or passphrase to EOS. The public JSON file serves only for license verification and cannot recover the private signing key.',
                            )}
                        </Alert>
                    </Stack>
                </Box>
                <Alert severity="info">
                    {tr(
                        'Lizenzverwaltung, Diagnose und Sicherheitswartung bleiben ohne gültige Lizenz erreichbar. Angebundene Adapter prüfen ihre Freigabe zentral.',
                        'License management, diagnostics and security maintenance remain accessible without a valid license. Integrated adapters check their authorization centrally.',
                    )}
                </Alert>
            </Stack>
            <Dialog
                open={confirmRemove}
                onClose={() => setConfirmRemove(false)}
            >
                <DialogTitle>{tr('Lizenz entfernen?', 'Remove license?')}</DialogTitle>
                <DialogContent>
                    {tr(
                        'Angebundene Adapter verlieren ihre Betriebsfreigabe. Stelle vorher den sicheren Anlagenzustand her.',
                        'Integrated adapters lose their operating authorization. Establish a safe plant state before continuing.',
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmRemove(false)}>{tr('Abbrechen', 'Cancel')}</Button>
                    <Button
                        color="error"
                        onClick={() => {
                            setConfirmRemove(false);
                            void run('remove');
                        }}
                    >
                        {tr('Entfernen', 'Remove')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
