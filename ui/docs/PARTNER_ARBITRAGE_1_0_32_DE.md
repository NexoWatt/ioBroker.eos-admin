# Partneranbindung und Arbitrage – Architektur, Betrieb und Nachweise

Stand: 28.10.2026. Zielversion: 1.0.32. Ausgangspunkt: überprüftes Quellpaket 1.0.31.
`productionApproved: false`. Dieses Dokument ist eine technische Änderungsakte und
keine Herstellerfreigabe, Zertifizierung oder Erklärung vollständiger CRA-Konformität.
Den endgültigen Artefaktbezug und die tatsächlich ausgeführten Prüfungen enthält
`reports/partner-arbitrage-2026-10-28/` zusammen mit dem Release-Manifest.

## 1. Zweck und Produktgrenze

Die App **Arbitrage** ergänzt das Appcenter um eigenständigen Speicherhandel. Sie
kann im Haushalt oder an einer ausschließlich für Speicherhandel vorgesehenen
Anlage eingesetzt werden. PV-, Lade-, Bilanz- und dynamische Netzanschluss-App sind
keine fachliche Voraussetzung. Verbindlich bleiben korrekte lokale Messung,
Anschlussgrenzen, Speicherdaten, Inbetriebnahme und ein unterstützter Regelpfad.

Bilanz und Direktvermarktung erhalten jeweils eigene Partnerfreigaben innerhalb
ihrer App. Ein gemeinsamer Dienst setzt diese Rechte serverseitig durch. Die erste
Ausbaustufe verwaltet **ein Partnerprofil** mit exakt bezeichneten Ressourcen.
Mehrere gleichzeitige Händler und deren konkurrierende Vermarktungsverträge sind
kein nachgewiesener Funktionsumfang dieses Stands.

| App | Zulässige Fachrechte | Grenze dieses Stands |
| --- | --- | --- |
| Bilanz (`energyLedger`) | `balance.read` | Ausschließlich freigegebene Bilanzprojektion; kein Roh-API-, Konfigurations- oder Schreibzugriff |
| Direktvermarktung (`directMarketing`, lokale App `grid`) | `telemetry.read`, `capabilities.read`, reservierte Begrenzungs-/Status-/Abbruchrechte | `curtailment.request` antwortet derzeit `CONTROL_UNAVAILABLE`; keine freigegebene PV-Abregelungsintegration |
| Arbitrage (`arbitrage`) | `telemetry.read`, `capabilities.read`, `storage.charge.request`, `storage.discharge.request`, `dispatch.status.read`, `dispatch.cancel` | Wünsche werden geprüft; Empfang oder Annahme bestätigt keine Wirkung am Gerät |

Für Standort-/Ressourcenkennungen gilt ein enger Zeichenvertrag; es gibt keine
Wildcards, vom Partner vorgegebenen ioBroker-Datenpunktpfade oder freie Skripte.
Bestehende NW1-Lizenzen werden nicht auf ein neues Lizenzsystem umgestellt.

## 2. Zuständigkeiten und Datenfluss

1. Installateur/Admin richtet lokal Partner, Transportprofil, Apprechte und
   Ressourcenlimits ein. Die Voreinstellung ist ausgeschaltet und ohne Freigaben.
2. `PartnerRuntime` verbindet Konfiguration, geschützte lokale Persistenz und
   vorhandene lokale Datendienste mit dem Transport. Es eröffnet keine allgemeine
   eingehende Internet-API und keine neue allgemeine Cloudpflicht des EOS.
3. `partner-websocket.ts` baut ausschließlich eine ausgehende WSS-Verbindung zum
   lokal zugelassenen Ziel auf. Es übermittelt begrenzte Nachrichten.
4. `partner-service.ts` prüft Partneridentität, aktive App, Ressourcenrechte,
   Konfigurationsrevision, Zeitgrenzen, Wiederholungen und Journalzustand.
5. `arbitrage-control.ts` begrenzt freigegebene Wünsche anhand aktueller lokaler
   Messwerte und Leistungsfreigaben. Es schreibt selbst weder States noch Geräte.
6. Der vorhandene zentrale Speicherpfad bleibt für Stellbefehle verantwortlich.
   Widerruf, neue Grenzen und Gültigkeit müssen unmittelbar vor der jeweiligen
   physischen Schreibwirkung erneut geprüft werden.

Die Bedienoberfläche ist keine Sicherheitsgrenze. Unveränderte Prüfungen gelten
auch für direkte HTTP-Aufrufe, Appcenter-Speicherwege, Importe und Neustarts.
Ein VPN ersetzt weder TLS-Gegenstellenprüfung noch App-/Ressourcenautorisierung.

## 3. Lokale Einrichtung und API

Die Installateur-API unter `/api/installer/partner-integrations` ist mit der
bestehenden Authentifizierung und einer zusätzlichen konkreten Rollenprüfung auf
`installer`/`admin` geschützt. Antworten verwenden `Cache-Control: no-store`.

| Methode/Pfad | Zweck | Persistenz/Stellwirkung |
| --- | --- | --- |
| `GET /api/installer/partner-integrations` | Begrenzte Konfiguration, Appzustand, Diagnose | Keine |
| `POST .../preview` | Strikte Prüfung eines `config`-Entwurfs | Keine Speicherung, keine Datenübertragung oder Befehle durch die Vorschau |
| `POST .../config` | Entwurf mit `expectedConfigVersion` speichern, optional Arbitrage-Appstatus setzen | Zentraler exklusiver Speichervorgang; Revision wird um eins erhöht |
| `POST .../revoke` | Gemeinsame Verbindung deaktivieren und sämtliche Freigaben entfernen | Synchroner Laufzeitwiderruf und dauerhafte Speicherung; Fehlerzustand muss gesperrt bleiben |

Ein veralteter Entwurf wird mit HTTP 409 verworfen. Ein allgemeiner Installer-Save
oder Import darf geänderte Partnerfreigaben nicht an der dedizierten API vorbei
aktivieren. Appstatus, Lizenz und aktuelle lokale Freigaben werden unabhängig vom
sichtbaren Zustand des Browsers erneut geprüft.

Die Konfiguration enthält nur eine Referenz wie `NEXOWATT_PARTNER_<NAME>` auf
geschützte lokale Zugangsdaten, kein Token oder privaten Schlüssel. Tatsächliche
Geheimnisse gehören nicht in Browser, Export, Diagnosen, Quellcode, Tests oder ZIP.
Der referenzierte Umgebungswert enthält ein begrenztes JSON-Objekt mit
`partnerId`, `allowedEndpoint` (Hostname, Port und Pfad), `credentials`
(Ablaufzeit und Bearer-Token beziehungsweise Clientzertifikat/privater Schlüssel,
optional eigene CA) sowie optional einzelnen `privateVpnAddresses`. Die feste
Zielzulassung stammt damit aus der geschützten Bereitstellung und nicht allein
aus dem editierbaren URL-Feld. Ein Beispiel darf keine echten Geheimnisse enthalten.

Das Instanzdatenverzeichnis enthält `partner-runtime/journal.json` und
`partner-runtime/revocation.json`; daneben liegt `partner-runtime.initialized`
als Initialisierungsmarker. Eigenes Unterverzeichnis: 0700, Dateien: 0600,
passender POSIX-Eigentümer, keine Symlinks. Atomare Dateiersetzung mit Datei- und
Verzeichnis-fsync und serialisierte Journaloperationen gehören zum Vertrag.
Windows bleibt ohne eigenen ACL-Nachweis gesperrt. Verlust nach Initialisierung
darf kein stilles leeres Journal erzeugen. Eine absichtliche gemeinsame
Rücksetzung von Journal und Marker durch denselben Betriebssystemnutzer wird
dadurch nicht verhindert; Hostisolation und Wiederherstellungsprozess bleiben
gesonderte Vertrauensgrenzen.

## 4. Partnerprotokoll

Transportsubprotokoll und JSON-Vertragskennung sind `nexowatt.partner.v1`.
Zulässige Nachrichten sind `data.read`, `storage.dispatch`, `dispatch.status` und
`dispatch.cancel`; `curtailment.request` bleibt ohne Stellfreigabe reserviert.
Unbekannte Felder, Operationen, Datentypen und fremde Ressourcen werden abgewiesen.

Ein Speicherauftrag enthält eine eindeutige `id`, `resourceId`, `appId: arbitrage`,
`action: charge|discharge`, positive Leistung `powerW`, Zeitstempel `issuedAt` und
`expiresAt` in Unix-Millisekunden sowie die aktuelle `configVersion`.
Die Partneridentität kommt aus dem lokal authentifizierten Transport und wird
nicht aus einem frei behaupteten Nachrichtenfeld übernommen.

Die konfigurierte Befehlslaufzeit beträgt höchstens **60 Sekunden**. Laufzeit,
Messwertfrische und zentrale Leistungsfreigabe können die Wirkung weiter verkürzen.
Ein Heartbeat verlängert keine Steuerfreigabe. Wiederholte IDs dürfen keinen
zweiten Auftrag erzeugen; gleiche ID mit anderem Inhalt ist ein Konflikt. Ein
Neustart lädt Wiederholschutz, aktiviert aber keine früheren Steuerwünsche.
Ältere oder zeitgleiche neue Aufträge derselben Ressource werden anhand der
persistierten Annahmen zurückgewiesen. Monotone Fristen begrenzen die Laufzeit
zusätzlich zur Wanduhr. Das Journal hält zehn Minuten Historie, überdeckt damit
die gültigen Befehlsfenster und besitzt eine feste Kapazitätsgrenze.

Antworten unterscheiden `ACCEPTED`, Begrenzung/Abweisung, Wiederholung, Abbruch und
Status. `deviceAcknowledged: false` bedeutet ausdrücklich, dass weder tatsächliche
Anwendung noch gemessene Lade-/Entladewirkung bestätigt ist. Ein erfolgreiches
ioBroker-Schreiben oder Transport-ACK ist ebenfalls kein Leistungsnachweis.

## 5. Datenminimierung und zulässige Nutzung

`projectPartnerData` kopiert nur benannte primitive Fachwerte. Bilanzexporte geben
keine interne Konfiguration, Diagnosedumps oder Zugangsdaten weiter. Telemetrie ist
auf Leistungswerte, SoC, Aktualität und Verfügbarkeit begrenzt; Fähigkeiten auf
benannte Leistungsgrenzen und Unterstützungsflags.

Bilanz und Direktvermarktung verwenden derzeit die feste Ressource `site`.
Die Bilanzprojektion enthält das letzte vollständige abgeschlossene Intervall,
keine frei wählbare Historienabfrage. Der einzelne Speicher verwendet `single`;
bei dynamischen Gruppen gilt die konkret konfigurierte Gruppenkennung.

Der Datenlieferant muss zur freigegebenen Ressource passen und Lücken, Zeitbezug
und Qualität erhalten. Fehlende oder ungültige Werte dürfen nicht als echte Null
oder als frische Messung erscheinen. Summen, Herkunftsbilanzen und Kandidatenwerte
sind ohne gesonderten Nachweis keine eichrechtskonformen Abrechnungswerte und keine
marktprozesskonforme Bilanzkreisabrechnung.

Die technische Freigabe erlaubt den bezeichneten Zugriff. Bei personenbezogenen
Verbrauchs-/Bilanzdaten sind Zweck, Empfänger, Rechtsgrundlage, erforderlicher
Umfang, Aufbewahrung und Verantwortlichkeiten zusätzlich festzulegen. Ein Häkchen
in der App ist nicht automatisch eine wirksame DSGVO-Einwilligung. Der Widerruf
beendet künftigen Zugriff; bereits rechtmäßig empfangene Daten werden dadurch nicht
automatisch beim Partner gelöscht.

## 6. Speicher- und Netzsicherheit

Jede Ressource erhält mindestens Lade-/Entladegrenzen in W, Mindest-/Höchst-SoC,
Import-/Exportgrenzen, getrennte Erlaubnisse für Netzladen und Netzeinspeisung sowie
eine explizite lokale Inbetriebnahmebestätigung. Null-W-Grenzen bleiben Sperren.
Die Bestätigung ersetzt keine tatsächlich dokumentierte Prüfung.

Priorität haben Geräteschutz/BMS, verbindliche Anschluss-/Netzbetreibervorgaben,
aktuelle technische Verfügbarkeit und lokale Reserven. Wirtschaftliche Wünsche
werden nur innerhalb der verbleibenden Freigabe umgesetzt. Parallele Eigenverbrauchs-,
Tarif-, Farm- oder Fremdregler dürfen keine konkurrierenden Schreiber erzeugen.

Der reine Begrenzer verlangt frische und zeitlich zusammenpassende Messungen von
SoC, Speicherwirkleistung und Netzleistung. Positive Speicherleistung bedeutet
Entladen; positive Netzleistung bedeutet Bezug. Für die Grenzberechnung wird die
bereits wirksame Speicherleistung genau einmal aus dem Netzsaldo entfernt.
Unbestätigte Wechsel und mehrere Speicher benötigen zusätzlich einen zentralen
Leistungsrahmen; unabhängige Einzelberechnungen dürfen Anschlussleistung nicht
mehrfach vergeben.

Zielumfang der Integration sind ein unterstützter einzelner Speicherpfad und
unterstützte dynamische Gruppen. Die bisherige Legacy-Speicherfarm ohne belastbare
Einzel-SoC-/Einzelgeräteprüfung bleibt für neue Partnersteuerung gesperrt.
Eine Liste tatsächlich geprüfter Hersteller/Firmwares darf erst aus Geräteprüfungen
entstehen. Es gibt keine allgemeine Freigabe aller vorhandenen Geräteprofile.

## 7. Ausfall, Widerruf, Wiederaufnahme

| Ereignis | Gefordertes Verhalten | Erforderlicher Beleg |
| --- | --- | --- |
| Partner/App/Recht deaktiviert | Neue Zugriffe und aktuelle Wünsche sofort sperren; keine neue physische Wirkung aus alten async-Fortsetzungen | Widerruf während Journal-/Daten-/Schreib-await testen |
| Socketabbruch/Heartbeatfehler | Puffer verwerfen, offene Wünsche zurücknehmen, begrenzter Backoff | Alte Sitzung kann keine neue Sitzung beschreiben |
| Token-/Zertifikatsablauf | Verbindung und Wirkung sperren; lokale Rotation erforderlich | Wallclock- und monotone Fristfälle |
| Neustart | Journal prüfen, alte Aufträge nicht ausführen, Messung/Writerzustand neu bestätigen | Neustart mit zuvor aktivem Auftrag |
| Journal nicht verfügbar/defekt/voll | Keine neuen Steuerwünsche akzeptieren; klarer Diagnosezustand | Schreibfehler, beschädigte Daten, Kapazitätsgrenzen |
| Messwerte fehlen/veralten | Kein neuer Arbitrage-Sollwert; bestehendes gerätespezifisches Ausfallverhalten anwenden | Offline-/Alter-/NaN-/Typ-/Reihenfolgefälle |
| Persistenz beim Widerruf schlägt fehl | Laufzeit bleibt gesperrt, keine automatische Wiederfreigabe aus alter Konfiguration | Fehlerpfad einschließlich `finally` und Refresh |
| Update/Rückfall | Sicherung und unterstützten Rückfall prüfen; keine alten Live-Leases aus Backup reaktivieren | Frischinstallation, Overlay, Restore |

Ein pauschales Ausschalten des Speichers oder der gesamten EOS-Regelung ist kein
allgemein sicherer Rückfall. Bereits gesendete Gerätebefehle können nur nach den
jeweiligen Geräteverträgen neutralisiert oder durch bestätigte Watchdogs beendet
werden. Diese physische Restwirkung ist bei der Inbetriebnahme zu messen.

## 8. Transportgrenzen

Der WSS-Client prüft ein lokal zugelassenes Host-/Port-/Pfadprofil, TLS-Gegenstelle,
Credentials und deren Ablauf. URL-Credentials, Query/Fragment, Redirects und
beliebige private Ziele werden abgewiesen. DNS-Antworten werden geprüft; die
Verbindung wird auf eine geprüfte Adresse gebunden. Private VPN-Ziele benötigen
einzeln zugelassene Adressen. Metadaten-/Loopbackziele bleiben gesperrt.

DNS, TCP/TLS und authentifizierter Upgrade teilen ein tatsächliches
**5.000-ms-Gesamtbudget** mit Abbruch. Nutzdaten, Fragmente, Warteschlangen, Bytes,
Nachrichtenrate und Sendepuffer sind begrenzt; Kompression und Offline-Sendequeue
sind deaktiviert. Ein Sitzungswechsel verwirft alte Queueinhalte. Ein laufender
Handler erhält ein Abbruchsignal und generationengebundene Antwortfunktionen.
Keine externen URLs, Schlüssel oder fremden Exceptiontexte gelangen in Diagnosen.

## 9. Nachweismatrix und CRA-Bezug

Die projektspezifische Zuordnung ist ein Arbeitsnachweis, keine automatische
Konformitätsvermutung. Maßgeblich bleiben Produktabgrenzung, Risiken, tatsächlicher
Lieferumfang und das erforderliche Konformitätsverfahren.

| Anforderung | Implementierungs-/Dokumentationsbezug | Noch erforderlicher Nachweis |
| --- | --- | --- |
| NW-PARTNER-01 – minimale Rechte | App-/Ressourcenfreigaben, Rollenprüfung, fachliche Datenprojektion | Mandanten-/Objekt-/Rollen-Negativtests am gebauten Artefakt |
| NW-PARTNER-02 – sichere Kommunikation | WSS/TLS, DNS-Pinning, lokale Zielzulassung, begrenzte Credentials | Echte Partner-Sandbox einschließlich mTLS/Rotation und Gegenstellenwechsel |
| NW-PARTNER-03 – Integrität/Wiederholschutz | Strikte Verträge, Revision, Journal vor Annahme, Ablauf und Reihenfolge | Crash-/Restore-/Uhrsprung-/Replay- und Journalfehlertests |
| NW-PARTNER-04 – sichere Steuerung | Reiner Begrenzer, zentraler Writer, unmittelbare Widerrufsprüfung | Hardware, BMS-Grenzen, Richtungswechsel, Ausfall und Restwirkung |
| NW-PARTNER-05 – Ressourcenverfügbarkeit | Deadline, Quoten, Puffer, serieller Zugriff | Pi-Lastmessung und Partnerlastprofil |
| NW-PARTNER-06 – sichere Änderung | CAS, gemeinsamer Save-Lock, dedizierter Freigabepfad, Rückfall | Imports/Overlay/Restore, fehlgeschlagener Widerruf und Rechtewechsel |
| NW-PARTNER-07 – Lieferkette | Versionierter Build, Komponentenregister, tatsächliche SBOM, Manifest | Release-Gates und Zuordnung zum ausgelieferten ZIP/npm-Artefakt |
| NW-PARTNER-08 – Lebenszyklus | Befundregister, Support-/Update-/Meldeprozess, technische Akte | Verantwortliche, Supportbegründung, Aufbewahrung, reale Freigabeentscheidung |

CRA-Meldepflichten für Hersteller gelten seit **11.09.2026**; die Hauptpflichten
gelten ab **11.12.2027**. Für aktiv ausgenutzte Schwachstellen beziehungsweise
schwerwiegende Sicherheitsvorfälle sind 24-h-Frühwarnung und 72-h-Meldung vorgesehen;
die Abschlussfristen unterscheiden sich nach Ereignisart. Der aktuelle Meldeprozess
muss deshalb bereits unabhängig von dieser Funktionsfreigabe vorhanden sein.

Produktbeschreibung, Risikobewertung, Nachweise und technische Unterlagen sind bei
dieser Erweiterung fortzuschreiben. Herstellerverantwortete Fernverarbeitung kann
zum Produktumfang gehören. Die Supportdauer ist anhand der erwarteten Nutzung zu
begründen, grundsätzlich mindestens fünf Jahre; bei langlebigem EOS sind fünf
Jahre kein automatisch ausreichendes Ziel. Technische Unterlagen und Erklärung
sind mindestens zehn Jahre nach Inverkehrbringen oder für die längere Supportdauer
verfügbar zu halten. Sicherheitsupdates bleiben mindestens zehn Jahre ab
Bereitstellung oder für die längere verbleibende Supportdauer verfügbar.

Verifizierte Bezugsstände: **OWASP ASVS 5.0.0 stabil**, Level 2 als Projektbasis
mit risikobedingten zusätzlichen Level-3-Anforderungen; **NIST SSDF 1.1 final**
(1.2 bei der Prüfung noch Draft); **IEC 62443-4-1:2018**, **4-2:2019/COR1:2022**
und **3-3:2013/COR1:2014**. Ein vollständiger anwendbarer Anforderungssatz mit
Einzelnachweisen ist separat zu pflegen. Normausrichtung, Scans und SBOM ersetzen
weder Produktprüfung noch Konformitätsbewertung.

## 10. Inbetriebnahme und Freigabegrenzen

Vor dem ersten Test an der Anlage: vorherigen funktionsfähigen Stand sichern,
Hardware/Firmware und DP-Zuordnungen erfassen, Vorzeichen/Einheiten prüfen,
zulässige Import-/Exportwerte und Reserven festlegen. Zunächst nur Lesen und
Diagnose. Danach begrenzte Lade-/Entladeversuche mit beobachteter Istleistung,
Widerruf, Kommunikationsabbruch, Messwertausfall und Neustart. Soll-/Istwerte,
Zeitstempel, Rückfall und bereinigte Logs zur konkreten Anlagenkonfiguration ablegen.

Offen bleiben ohne gesonderte Belege: Partner-Sandbox und Vertragsprotokoll,
Geräte-/Firmwareintegration, sichere Wiederaufnahme, Lastmessungen, unabhängiger
Penetrationstest nach Risiko sowie Hersteller-/Produktivfreigabe. Netzdienliche
Vorgaben einschließlich anwendbarer §14a-Regelungen, zulässiges Netzladen,
Einspeise-/Vermarktungsberechtigung und Mess-/Abrechnungskonzept müssen für die
konkrete Anlage geklärt sein. Technische Schalter erteilen diese Berechtigungen nicht.

## 11. Offizielle Quellen

Geprüft am 28.10.2026; Quellen beschreiben rechtliche/technische Grundlagen,
nicht einen bestandenen EOS-Konformitätsnachweis.

- [CRA-Verordnung (EU) 2024/2847](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32024R2847), insbesondere Art. 3, 13, 14, 31 und Anhänge I/VII.
- [Europäische Kommission: CRA-Meldepflichten](https://digital-strategy.ec.europa.eu/en/policies/cra-reporting).
- [Europäische Kommission: CRA-Konformitätsbewertung](https://digital-strategy.ec.europa.eu/en/policies/cra-conformity-assessment).
- [Europäische Kommission: CRA-Standardisierung](https://digital-strategy.ec.europa.eu/en/policies/cra-standardisation).
- [OWASP ASVS](https://asvs.owasp.org/).
- [NIST SSDF-Publikationen](https://csrc.nist.gov/projects/ssdf/publications).
- [IEC 62443-4-1](https://webstore.iec.ch/en/publication/33615), [IEC 62443-4-2](https://webstore.iec.ch/en/publication/34421), [IEC 62443-3-3](https://webstore.iec.ch/en/publication/7033).
- [Europäische Kommission: Datenschutzgrundsätze](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en).
