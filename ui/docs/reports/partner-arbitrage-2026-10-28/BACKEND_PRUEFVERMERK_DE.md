# Partner-Backend: Änderungs- und Prüfvermerk

- Bezug: Versionierter Daten-/Speichervertrag, eigenständige Arbitrage, abgesicherte Partnerfreigaben; Ausgangspaket 1.0.31, Zielstand 1.0.32.
- Zeitpunkt: 2026-10-28T05:39:11.555470+00:00.
- Umgebung: Linux-Entwicklungscontainer, Node.js v24.22.1, lokale installierte TypeScript-Version aus dem Release-Lockfile; kein Speicher/Wechselrichter und keine echte Handelspartnerverbindung.
- Quellbindung: [backend-source-hashes.json](backend-source-hashes.json); keine fiktive Commitkennung bei geliefertem Quellsnapshot.
- Fachvertrag: [PARTNER_INTEGRATION_PROTOCOL_V1_DE.md](../../PARTNER_INTEGRATION_PROTOCOL_V1_DE.md).

## Änderung und Sicherheitswirkung

Strikte Typen und native Schemaprüfung, ausgeschaltete Standardkonfiguration, begrenzte App-/Ressourcen-/Aktionsfreigaben, getrennte reine Bilanzdaten, serverseitige Installer-/Adminrolle und CAS verhindern implizite Fremdsteuerung. WSS-Transport und geschützte Bereitstellung werden in getrennten Prüfvermerken nachgewiesen.

Der Fachdienst persistiert Replaykennungen vor der Annahme. Wünsche bleiben kurzlebig und ausschließlich für den zentralen Writer abrufbar. Widerruf, Reihenfolge, Verbindungswechsel und monotone Fristen sperren alte Wünsche. Quittungen enthalten immer `deviceAcknowledged: false`; der Fachdienst bestätigt keine Gerätewirkung.

## Tatsächlich durchgeführte Prüfungen

Befehl: `node scripts/test-partner-integrations.cjs`.

Das Skript kompiliert die drei echten Runtime-TS-Module mit `tsconfig.partner-integration.json` vollständig streng in ein isoliertes temporäres Verzeichnis und führt danach die Fälle mit Node Test Runner aus. Exitcode 0; 26 Tests bestanden, 0 fehlgeschlagen, 0 übersprungen. Bereinigter Rohbeleg: [backend-protocol.log](backend-protocol.log).

Abgedeckte Grenzen:

- Default-off, Standalone-Profil ohne PV/NVP, unbekannte Schlüssel/Geheimnisfelder/ungeprüfte IDs/unsichere URL.
- App-/Ressourcen-/Aktionsbindung, fehlende zentrale Regelfähigkeit und fehlende Ressourcenunterstützung.
- Persistenz vor Annahme, Replay und widersprüchliche Kennung, ältere neue Kennung, Neustart ohne Wiederanlauf.
- Defektes/fehlendes Journal und Schreibfehler, Widerruf während Journal-Commit, lokale Appabschaltung/Transportabbruch.
- Monotone Frist bei rückwärts laufender Wanduhr, abgelaufene/zu lange/zu große Aufträge, unbekannte Zeitpläne.
- Abbruch, ausschließlich benannte Datenprojektionen, Rechteentzug während Datenabfrage.
- Tatsächliche Fünf-Sekunden-Abbruchfrist mit gesetztem AbortSignal; Größen-/Ratenbegrenzung.
- Echte Rollen statt alter Kunden-Wildcard, CAS-Konflikt, reine Vorschau, globaler Widerruf.
- Nachricht vor Disconnect eingereiht und erst nach Reconnect freigeworden: weiterhin widerrufen, kein Journaleintrag.
- API wartet auf persistente Widerrufsgrenze; Fehler verhindert anschließenden Konfigurationscommit.

## Nachgeprüfte Reviewbefunde

Der Review reproduzierte zunächst eine mögliche Überschreibung durch einen älteren Auftrag mit neuer Kennung. Persistente Reihenfolgeprüfung und Regressionstest schließen diesen Befund im hier gebundenen Stand. Ergänzt wurden monotone Laufzeitbegrenzung, begrenzter Datenabruf, ein dauerhaft speicherbares Widerrufs-Hook und die Bindung bereits eingereihter Nachrichten an ihre ursprüngliche Verbindungsepoche. Der produktive Dateisperrstand und die Transportgeneration werden separat im Laufzeitmodul geprüft.

## Offene Nachweise und Grenzen

Diese Tests benutzen simulierte Hooks für Persistenz, Appfreigaben und Datenquellen. Sie sind echte Fachdienst-/API-Tests, keine Hardwareprüfung. Der zentrale Writer, Dateisystemjournal, echte TLS-Verbindung, dynamische Gruppen und UI sind getrennt zu prüfen. Ein physischer Speicher-, Netzschutz- oder Handelspartnerabnahmetest wurde hier nicht durchgeführt. Direktvermarktungs-Abregelung bleibt ausdrücklich gesperrt; kein Exactly-once-Nachweis für physische Wirkung und keine CRA-Konformitätserklärung.

Interne öffentliche Fehler aus dem bestehenden `http-error-boundary` behalten ihren geprüften Status (beispielsweise Lizenzfehler 403). Fremde oder gefälschte Fehlerobjekte werden mit festem HTTP 500 redigiert. Auch dieser Fall wurde geprüft.

Die abschließende Release-Entscheidung, SBOM-/Artefaktbindung und offenen Praxistests führt der gemeinsame Releasebericht zusammen. Dieses Protokoll erteilt keine Produktivfreigabe.

## Nachtrag: bestehende VM-Persistenzfixtures

Die Legacy-Prüfung `scripts/verify-cra-credential-state.cjs` extrahiert die echte Persistenzmethode aus Main in einen VM-Kontext. Nach Einführung der Partnergrenze wurden die tatsächlichen Runtime-Imports `assertPartnerPersistence`, `currentPartnerConfig` und `createPublicHttpError` auch diesem Kontext hinzugefügt. Kein Schutz wurde simuliert oder abgeschwächt. Ein zusätzlicher Fall prüft, dass generische Partneränderungen und falsche CAS-Versionen vor dem Schreiben scheitern und der zulässige dedizierte Commit die bestehende Admin-ACL weiterhin prüft.

Tatsächlich ausgeführt am 2026-10-28, Node.js v24.22.1:

| Befehl | Ergebnis |
| --- | --- |
| `npm run test:cra-credential-state` | Exit 0, 9 Prüfungen bestanden; ausgeliefertes `main.js` |
| `node scripts/verify-cra-credential-state.cjs --source` | Exit 0, 9 Prüfungen bestanden; kanonisches `main.ts` |
| `node scripts/verify-stable-1.0.8-storage-licenses.cjs` | Exit 0, Lizenz-/API-/Import-/Dispatch-Regressionssuite bestanden |
| `node --test test/nvp-config-http.test.cjs test/dynamic-grid-config-http.test.cjs` | Exit 0, 6 HTTP-Persistenztests bestanden |

Diese Nachprüfung betrifft Tests und Dokumentation. Main, Runtime, Metadaten und Build wurden in diesem Arbeitsschritt nicht verändert. Die anschließende Gesamtprüfung und Artefaktversiegelung erfolgt im Releaseablauf.
