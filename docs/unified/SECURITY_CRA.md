# Sicherheits- und CRA-Register der Zusammenführung

**Stand:** 9.0.3 · 22.11.2026 · **Verantwortung:** NexoWatt / Dominique Manteufel

Dieses Register beschreibt den Prüfbedarf für Testversion 9.0.3 (`next`) und
ergänzt die vorhandenen Befund- und Entwicklungsunterlagen. Es
beschreibt Scope, Maßnahmen und zu erbringende Nachweise. Testergebnisse werden im
abschließenden Release-Prüfbericht geführt. Hier wird keine bestandene Normprüfung,
CE-/CRA-Konformität oder Produktionsfreigabe erklärt.

## Schutzgüter und Angreifer

Schutzgüter: Anlagenlimits und Stellbefehle, Konten/Rechte, Lizenz- und Updateintegrität,
Konfiguration, Energie-/Ladehistorie und Verfügbarkeit. Betrachtet werden nicht
angemeldete Netzteilnehmer, gewöhnliche Benutzer, entzogen berechtigte Benutzer,
fehlerhafte/kompromittierte Geräte, Lieferketteneingriffe sowie andere lokale Prozesse.
Ein Angreifer mit vollständiger Kontrolle über OS und Programmdateien kann eine
rein lokale Lizenzkontrolle verändern; absolute Manipulationssicherheit ist keine Zusage.

## Bedrohungsmodell und Abnahmekriterien

| ID / STRIDE | Grenze und Risiko | Maßnahme / Abnahmekriterium | Nachweisstatus |
| --- | --- | --- | --- |
| EOS-MERGE-T01 / S,E | Login, OAuth, MFA; Identitäts- oder Rollenübernahme | Zentrale Benutzerquelle und Erstpasswortwechsel. TOTP/fehlerhafte externe Auth-Konfiguration sperren sicher; kein implementierter TOTP-Challenge-/Passkey-Flow. CWE-287/862. | Negative TOTP-/Sitzungstests im Abschlussbericht; unterstützter MFA-Flow offen. |
| EOS-MERGE-T02 / S,E | HTTP, Socket, SSE nach Logout/Rechteentzug | Globale Sitzungsgeneration wird beim Logout widerrufen; alle parallelen Nutzer müssen sich neu anmelden. CWE-613. | Negative Tests und realer Browserablauf erforderlich; Einzelsitzungslogout offen. |
| EOS-MERGE-T03 / T,E | Lizenzpayload/Truststore | Signatur/Schema/UUID prüfen; Truststore getrennt schützen; keine Selbstfreigabe. CWE-347/732. | NWL3-Ausstellervergleich und Negativtests nachweisen. |
| EOS-MERGE-T04 / T,I | Direkter HTTPS-Listener, optionaler Proxy, CSRF/Hostheader | TLS/Auth auf 8188, passende SAN/Vertrauenskette; optionale 443-Upstream-Verbindung per HTTPS mit CA-/Namensprüfung; kein Forwarding-Login. CWE-346/352. | Neue 8188-Transportprüfung; 443 nur bei Nutzung gesondert abnehmen. |
| EOS-MERGE-T05 / I,T | Downloads, Uploads, Assets, PWA | Pfad-/Größenlimits; keine Secrets oder geschützten API-Antworten im Cache. CWE-22/200. | Paketinhalt, negative Pfade und Browsercache prüfen. |
| EOS-MERGE-T06 / E,T | Verwaltung/Objekte/Hostbefehle | Funktionsrechte plus Objekt-ACL; keine universelle Shell-/Root-Schnittstelle. CWE-78/862. | Rollenmatrix und Betrieb ohne Root nachweisen. |
| EOS-MERGE-T07 / T,D | Alte und neue EMS schreiben gleichzeitig | Kontrollierte Migration, eindeutiger Besitzer, bestätigter Stopp des Altreglers; kein Heartbeat als alleinige Übergabe. | Abbruch-/Wiederanlaufprüfung und Anlage offen. |
| EOS-MERGE-T08 / D | Gemeinsamer Prozess, große Requests, Verwaltungsarbeit | Limits, kontrolliertes Entladen, Event-Loop-/Regellatenz messen. CWE-400. | Workertrennung nicht umgesetzt; Last-/Hardwaretest offen. |
| EOS-MERGE-T09 / T,D | Messdaten, Protokolle, Tarif/Wetter | Typen/Einheiten/Aktualität prüfen, echte Deadlines, gerätespezifische Fallbacks. | Übernommene Logik plus gezielte Regression; Gerätetests offen. |
| EOS-MERGE-T10 / T,I,R | Build, npm/ZIP, Logs und Sicherung | Inventar/SBOM, unveränderliche Hashbindung, Secretprüfung, datensparsame Logs und Restore. | Aktuelles Artefakt prüfen; Altberichte gelten nicht automatisch. |
| EOS-ACCESS-T01 / D | Automatische Sperre des bisherigen Adminzugangs vor nutzbarem EOS-Einstieg | Legacy-Sperrpfad entfernt, alte Sperrflags ohne Wirkung; Bestand nicht durch angenommene Standardwerte überschreiben. | Erhalt-/Recoverytests in 9.0.1 und 9.0.2 bestanden; Reichweite siehe versionsgebundene Prüfberichte. |
| EOS-ACCESS-T02 / S,I | LAN-Listener und lokaler Gerätename | IPv4-Bindung an alle Schnittstellen bewusst erfassen; nur TLS/Auth; DNS-Auflösung und SAN/CA prüfen, keine automatischen Host-/Firewallfreigaben. | Reale Zugangsprüfung erforderlich; kein vollautomatisches Geräteimage behauptet. |
| EOS-LIC-T01 / T,E | Import öffentlicher Prüfschlüssel über die angemeldete Oberfläche | Nur exakt freigegebene Release-Pins oder gültige OS-Autoritäten; kein selbst gewählter Aussteller. Explizite OS-Allowlist bleibt abschließend. Local-Import ist keine neue Autorität. CWE-347/862. | Neue Import-/Widerrufs-/HTTPS-Tests im 9.0.2-Abschlussbericht; private Schlüssel nie auf EOS. |
| EOS-LIC-T02 / D,T | ioBroker-Gruppenrechte verhindern private Lizenzspeicherung | Explizite Runtime-Grenze aus adapter-core; nur Nichtleaf-Verzeichnisse mit Dienst-UID/primärer GID; Leaf 0700 und Dateien 0600 bleiben privat. Kein rekursives Umsetzen von Hostrechten. CWE-732. | Reproduktion mit 0775/2775 und positive/negative Speicherprüfungen; tatsächliche Zielgeräteprüfung offen. |
| EOS-WEBSTART-001 / D | Vollständiger operativer Start blockiert HTTPS-Listener; Lizenz-/Engine-Logs vermitteln vorzeitig Bereitschaft | Geschützte Webbereitschaft vom operativen Start trennen; tatsächlichen Bind-/TLS-Erfolg gesondert melden. Authentisierung, Lizenz und Ownership bleiben verbindlich. | Verzögerter/fehlgeschlagener Start, Stop/Restart und realer HTTPS-Aufruf im 9.0.3-Abschlussbericht nachzuweisen. |
| HISTORY-001 / D,T | Fehlender History-Callback hängt Start oder Kandidatenabfrage auf; fehlende Daten erscheinen als frischer CO₂-Nullwert | Betroffenen Einzelaufruf und sämtliche Fallback-Kandidaten einer `_nwGetHistoryAvgSeriesAny`-Abfrage insgesamt auf 5 Sekunden begrenzen; späte/mehrfache Antworten ignorieren. Bei fehlenden Daten alte gültige Werte/Zeiten erhalten; echte Nullproben bleiben zulässig. | Nichtantwort, Fehler, verspätete Antwort, Shutdown und Datenqualität gezielt prüfen; keine Ergebnisse vorweggenommen. |
| MULTIUSE-001 / T,D | Deaktivierung schreibt vier Steuerzustände, bevor deren Objekte angelegt sind | Objektinitialisierung auch bei deaktiviertem Modul; operative Ticks bleiben aktivierungsgebunden, keine neuen Gerätekommandos oder Konfigurationsresets. | Frische Datenbank und reales Manager-/Modulverhalten prüfen; Ergebnisse im 9.0.3-Abschlussbericht. |

Die 9.0.2-Prüfschlüsselarchitektur verändert die dokumentierte Autoritätsmenge:
Standard-OS-Schlüssel und explizit importierte, in diesem Release autorisierte
Hersteller-Pins sind unabhängige Freigaben. Einen OS-only-Schlüssel zu entfernen
widerruft dessen Autorität; einen zugleich im Release autorisierten Schlüssel
widerruft dies allein nicht. Dafür ist ein Release ohne diesen Pin oder eine
explizite OS-Allowlist über `NEXOWATT_LICENSE_TRUST_FILE` nötig. Beschädigte oder
unsichere vorhandene OS-Dateien werden nicht durch Importdaten umgangen.
Löschen der gesamten OS-Datei ist kein verlässliches Verfahren zum Widerruf aller
Release-Autoritäten. Details und Wiederherstellungsgrenzen:
[Prüfschlüssel-Wiederherstellung](LICENSE_RECOVERY_9.0.2.md).

Die Gruppe innerhalb der expliziten ioBroker-Installation kann nach der
ioBroker-Betriebsarchitektur bereits Code und Daten verwalten. Gegen sie wird
keine neue DRM-Isolation behauptet. Der Adapter erhält weder Rootrechte noch
einen privilegierten Upload-Helfer. Die Lizenzkorrektur aus 9.0.2 verändert keine
Geräte-/EMS-Regelungsalgorithmen. Die gesonderten Lifecycle-/Datenqualitätsänderungen
in 9.0.3 sind oben unter ihren eigenen Befund-IDs erfasst;
LIC-RUNTIME-01 bleibt gesondert offen.

S=Identitätsvortäuschung, T=Manipulation, R=fehlende Nachvollziehbarkeit,
I=Informationsabfluss, D=Verfügbarkeitsangriff, E=Rechteausweitung. CWE nennt
Risikoarten, keine dadurch bereits bestätigte Schwachstelle.

## Anwendbarkeitsregister

| ID / Maßstab | Geltungsbereich / Anwendbarkeit | Umsetzung und verbleibender Nachweis |
| --- | --- | --- |
| EOS-MERGE-R01 / IEC 62443-4-1, NIST SSDF | Entwicklungs- und Wartungsprozess; anwendbare interne Zielrahmen | Versionsbezug, Review, Prüfungen, Befundpflege und Releasebelege; vollständiges Prozessaudit offen. |
| EOS-MERGE-R02 / IEC 62443-4-2, -3-3 | Komponenten-/Systemschutz im jeweiligen Anlagenprofil | Authentisierung, Rechte, Integrität, Verfügbarkeit und Netzgrenzen zuordnen; kein pauschales Security Level bestätigt. |
| EOS-MERGE-R03 / OWASP ASVS, API/IoT-Risiken | Web, OAuth, APIs, Socket, Gerätekommunikation | ASVS Level 2 als Ziel; konkrete Fallabdeckung gegen T01–T10. Vollständiger ASVS-Nachweis offen. |
| EOS-MERGE-R04 / IEC 62351 und Protokollprofile | Energieprotokolle abhängig von tatsächlicher Gegenstelle | Je Modbus/OCPP/EEBUS Version, TLS/Authentisierung und Netzbegrenzung erfassen. Zusammenführung ist keine Protokollzertifizierung. |
| EOS-MERGE-R05 / CRA Produktgrenze/Kategorie | Kommerzielle lokale Software und ggf. EOS-Gesamtgerät | Hersteller-/Liefergrenze und Kernfunktion gegen Anhänge III/IV sowie Verordnung (EU) 2025/2392 prüfen. Endgültige Kategorie/Verfahren offen. |
| EOS-MERGE-R06 / CRA Anhang I | Sicherer Entwurf, Voreinstellungen, Zugang, Updates, Schwachstellen | Technische Maßnahmen und Prüfnachweise zuordnen; offene kritische Befunde vor allgemeiner Freigabe schließen. |
| EOS-MERGE-R07 / CRA technische Unterlagen/SBOM | Tatsächlich ausgelieferter Quell-/Buildstand und Fremdkomponenten | SBOM, Herkunft, Hashes, Risiken, Anleitungen und Prüfungen; keine fiktiven Versions-/Scanergebnisse. |
| EOS-MERGE-R08 / CRA Art. 13/14 | Support, Updatezugang, Schwachstellen-/Vorfallprozess | Supportdauer/-ende, Sicherheitskontakt und Reaktionsprozess durch Hersteller verbindlich festlegen; Dokument ist keine eingerichtete Überwachung. |
| EOS-MERGE-R09 / DSGVO | Konten, IPs, Geräte-/Kundenbezug und Verbrauchsprofile | Zwecke/Rollen, Rechtsgrundlagen, Zugriff, Aufbewahrung/Löschung und Backup je Betrieb festlegen; Local-First ist keine Ausnahme. |
| EOS-MERGE-R10 / ISO 27001/27002 | Organisation, Zugriff, Lieferanten, Vorfälle | Rahmen für Herstellerprozesse; keine Zertifizierung erklärt. |
| EOS-MERGE-R11 / BSI C5 | Cloud-Dienste, falls im tatsächlichen Lieferumfang | Für reine lokale Adapterfunktion kein eigenes Cloudangebot; bei Zusatzdiensten einzeln bewerten. |

## Fristen und Herstelleraufgaben

Für erfasste Produkte gelten CRA-Meldepflichten seit **11.09.2026**. Frühwarnung bei
meldepflichtigem Fall innerhalb von 24 Stunden, Folgemeldung innerhalb von 72 Stunden
nach Kenntnis. Abschlussbericht bei aktiv ausgenutzter Schwachstelle spätestens
14 Tage nach verfügbarer Abhilfe; bei schwerwiegendem Vorfall binnen eines Monats
nach der 72-Stunden-Meldung. Über die SRP meldet die zuständige Herstellerperson.
Eine bloße Scannerwarnung ist nicht automatisch ein meldepflichtiger Vorfall.

Die vollständige CRA-Anwendung beginnt **11.12.2027**. Produktabgrenzung, Risikoanalyse,
Support, technische Unterlagen und das notwendige Bewertungsverfahren werden vor
entsprechender Marktabgabe vervollständigt. Support richtet sich nach erwarteter
Nutzungsdauer, grundsätzlich mindestens fünf Jahre; eine kürzere erwartete Nutzung
braucht eine tragfähige Begründung. Geschäftliche Lizenzbedingungen dürfen erforderliche
Sicherheitspatches nicht pauschal blockieren. Keine Supportlaufzeit wird hier ohne
Herstellerentscheidung als bereits zugesagt eingetragen.

Quellen und Recherchegrenzen: [SOURCES.md](SOURCES.md).

## Noch erforderliche Freigabenachweise

- Tatsächlicher Controller-/OS-/Node-Stand; Installation/Stop/Restart ohne Root.
- HTTPS-Bereitschaft trotz verzögertem operativem Start; begrenzte History-Antwortzeit, unverfälschte CO₂-Datenqualität und MultiUse-Objekte bei deaktiviertem Modul nach den drei 9.0.3-Befunden prüfen.
- Gesamtfluss direktes HTTPS:8188 → OAuth/Erstpasswortwechsel → Aktivierung → Dashboard/Installer/System; optionales HTTPS:443 separat. TOTP-/fehlerhafte Auth-Konfiguration muss sperren; TOTP-Challenge/Passkeys bleiben offen.
- Globalen Logout mit mehreren Nutzern prüfen; ein Single-Session-Logout ist nicht implementiert.
- Erhalt des ioBroker-Adminzugangs trotz alter Legacy-Sperrflags; Nachweise nach [ACCESS_RECOVERY_9.0.1.md](ACCESS_RECOVERY_9.0.1.md).
- Migration, Eigentumsübergabe, Backup/Restore und Rückfall ohne parallele Stellbefehle.
- Last-/Regellatenz und reale Geräte-/Fehlerfalltests für den benannten Anlagenumfang.
- Aktuelle Dependency-/Secret-/Paketprüfung; fachliche Bewertung offener Befunde.
- Unabhängige Sicherheitsprüfung für Serienfreigabe entsprechend dem Architekturrisiko.
- Herstellerentscheidung über Kategorie, Support, Meldeprozess und allgemeine Freigabe.
- Offene Lizenzfortsetzungsgrenzen [LIC-RUNTIME-01 bis -03](LICENSING_RUNTIME_LIMITS.md) berücksichtigen.

Für jeden offenen Punkt: Verantwortliche Person, Termin, nächster Schritt und Beleg
im Release-/Befundregister ergänzen. Ein Testtag ersetzt keine kritische
Sicherheitsprüfung; noch offene breite Hardwareabnahme ist gesondert auszuweisen.
