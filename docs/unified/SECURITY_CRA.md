# Sicherheits- und CRA-Register der Zusammenführung

**Stand:** 9.0.0-alpha.1 · 22.11.2026 · **Verantwortung:** NexoWatt / Dominique Manteufel

Dieses Register ergänzt die vorhandenen Befund- und Entwicklungsunterlagen. Es
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
| EOS-MERGE-T04 / T,I | Proxy-Origin, CSRF, Hostheader | Feste öffentliche Origin; fremde Origins ablehnen, sichere Cookies, kein Forwarding-Login. CWE-346/352. | Transporttests und reale 443-Installation erforderlich. |
| EOS-MERGE-T05 / I,T | Downloads, Uploads, Assets, PWA | Pfad-/Größenlimits; keine Secrets oder geschützten API-Antworten im Cache. CWE-22/200. | Paketinhalt, negative Pfade und Browsercache prüfen. |
| EOS-MERGE-T06 / E,T | Verwaltung/Objekte/Hostbefehle | Funktionsrechte plus Objekt-ACL; keine universelle Shell-/Root-Schnittstelle. CWE-78/862. | Rollenmatrix und Betrieb ohne Root nachweisen. |
| EOS-MERGE-T07 / T,D | Alte und neue EMS schreiben gleichzeitig | Kontrollierte Migration, eindeutiger Besitzer, bestätigter Stopp des Altreglers; kein Heartbeat als alleinige Übergabe. | Abbruch-/Wiederanlaufprüfung und Anlage offen. |
| EOS-MERGE-T08 / D | Gemeinsamer Prozess, große Requests, Verwaltungsarbeit | Limits, kontrolliertes Entladen, Event-Loop-/Regellatenz messen. CWE-400. | Workertrennung nicht umgesetzt; Last-/Hardwaretest offen. |
| EOS-MERGE-T09 / T,D | Messdaten, Protokolle, Tarif/Wetter | Typen/Einheiten/Aktualität prüfen, echte Deadlines, gerätespezifische Fallbacks. | Übernommene Logik plus gezielte Regression; Gerätetests offen. |
| EOS-MERGE-T10 / T,I,R | Build, npm/ZIP, Logs und Sicherung | Inventar/SBOM, unveränderliche Hashbindung, Secretprüfung, datensparsame Logs und Restore. | Aktuelles Artefakt prüfen; Altberichte gelten nicht automatisch. |

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
- Gesamtfluss HTTPS → OAuth/Erstpasswortwechsel → Aktivierung → Dashboard/Installer/System. TOTP-/fehlerhafte Auth-Konfiguration muss sperren; TOTP-Challenge/Passkeys bleiben offen.
- Globalen Logout mit mehreren Nutzern prüfen; ein Single-Session-Logout ist nicht implementiert.
- Migration, Eigentumsübergabe, Backup/Restore und Rückfall ohne parallele Stellbefehle.
- Last-/Regellatenz und reale Geräte-/Fehlerfalltests für den benannten Anlagenumfang.
- Aktuelle Dependency-/Secret-/Paketprüfung; fachliche Bewertung offener Befunde.
- Unabhängige Sicherheitsprüfung für Serienfreigabe entsprechend dem Architekturrisiko.
- Herstellerentscheidung über Kategorie, Support, Meldeprozess und allgemeine Freigabe.
- Offene Lizenzfortsetzungsgrenzen [LIC-RUNTIME-01 bis -03](LICENSING_RUNTIME_LIMITS.md) berücksichtigen.

Für jeden offenen Punkt: Verantwortliche Person, Termin, nächster Schritt und Beleg
im Release-/Befundregister ergänzen. Ein Alpha-Testtag ersetzt keine kritische
Sicherheitsprüfung; noch offene breite Hardwareabnahme ist gesondert auszuweisen.
