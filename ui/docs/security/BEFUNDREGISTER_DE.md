# NexoWatt UI – verständliches Befundregister

Ausgangsstand der Sicherheitsprüfung: 1.0.21 aus dem bereitgestellten Repository.
Sicherheits-Prüfstand: 1.0.22 vom 29.09.2026; fokussierter Heizstab-Teststand:
1.0.23 vom 08.10.2026; NVP-Diagnose-Teststand: 1.0.24 vom 22.10.2026.
Geltungsbereich: dieser Adapter, sein Admin-Bundle, Buildwerkzeuge und
seine Abhängigkeiten. Kein Prüfstatus anderer ioBroker-Adapter oder des js-controller.

Aktueller Nachtrag: Sicherheitsstand 1.0.31 vom 24.10.2026, siehe
[HTTP-/Admin-Prüfbericht](../reports/security-patch-2026-10-24/PRUEFBERICHT_DE.md).
Historische Tabellen werden nicht als heutiger vollständiger Freigabestatus gelesen.

Die Kennungen aus den Teilberichten werden erhalten. Sie sind **keine Umnummerierung
früherer Plattformbefunde F01–F08**. „Lokal nachgeprüft“ bezieht sich auf die genannten
Quell-/Loopback-/Mocktests; es ist keine Anlagen- oder Produktfreigabe. Der zentrale
[Prüfbericht vom 29.09.2026](../reports/cra-2026-09-29/PRUEFBERICHT_DE.md)
nennt den damals finalen Sicherheits-Prüfstand 1.0.22.
Der [Heizstab-Prüfvermerk](../reports/heating-rod-2026-10-08/PRUEFVERMERK_DE.md)
ergänzt den Änderungs- und Nachprüfstand für 1.0.23.

## NVP-Diagnose-Nachtrag vom 22.10.2026 – 1.0.24

Die neue M0/M1-Zuordnung, Messqualitätsdiagnose und gemeinsame
Intervallberechnung sind von der aktiven Bestandsregelung getrennt. Die
vorhandene statische Speicher-/Farm-/PV-Regelung bleibt verantwortlich;
die neue dynamische Diagnose erzeugt keine Gerätebefehle. Die Auswahl
`external` überträgt im Diagnosebetrieb keine reale Stellhoheit.
Ein aktiver dynamischer Modus wird in API und Runtime gesperrt.

Die neue API verwendet die vorhandene serverseitige Installer-/Adminprüfung.
Zusätzliche Prüfgrenzen sind Gerätebindung, Aliasauflösung, numerische
Validierung, gemeinsame Konfigurationsversion und kontrollierte Persistenz.
Diese Beschreibung vorhandener Schutzmechanismen ist noch kein pauschaler
Nachweis erfolgreicher HTTP-, Rollen-, Hardware- oder Releaseprüfungen.
Tatsächlich ausgeführte Prüfungen und ihre Quell-/Artefaktbindung werden
separat im NVP-Prüfvermerk geführt; historische Ergebnisse schließen keine
neuen NVP-Anforderungen.

Die folgenden Kennungen sind dieselben offenen Integrationsanforderungen wie
im [NVP-Prüfplan](../reports/NVP_2026_10_22_PRUEFPLAN_DE.md), keine zusätzlichen
CVE- oder Angriffsbefunde. Priorität: vor Aktivierung der jeweils betroffenen
dynamischen Funktion zu schließen. Ein Test des ausdrücklich begrenzten
Diagnoseumfangs wird dadurch nicht als aktiver Anlagenbetrieb ausgegeben.

| Kennung | Betroffene Komponente / offener Zustand in 1.0.24 | Wirkung und nächste Maßnahme | Status / Verantwortung |
| --- | --- | --- | --- |
| NVP-ACT-01 | Bestehende ESS-/Farm-Ausgabe besitzt noch keinen vollständig integrierten, bereichsgebundenen endgültigen Writer für M0/M1. | Bereichsplanung, Budget und Stellhoheit bis zum einzelnen Aktor verbinden; parallele Sollwerte und Keepalives ausschließen. | Offen; aktiven dynamischen Betrieb gesperrt halten. EOS-Entwicklung, vor Aktivierung. |
| NVP-ACT-02 | Reiner Freigabe-Zustandsautomat vorhanden; bestätigte externe Geräteprofile und reale Ablauf-/Rückfallintegration fehlen. | Sitzung, Sequenz, Empfang, angewandtes Intervall, Istwirkung und konservative Altfreigaben am tatsächlichen lokalen Regler nachweisen. Ein EOS-Timeout beendet keine Fremdfreigabe. | Offen; keine aktive TESVOLT-Freigabe. EOS-Entwicklung, Hersteller und Anlagenverantwortlicher, vor Aktivierung. |
| NVP-ACT-03 | Bestehende EVU-/PV-Ausgabepfade sind noch nicht zum gemeinsamen dynamischen Sollwert je Aktor verbunden. | Erzeugungs-/Exportgrenzen und Geltungsbereiche M0/M1/Einzelgerät vor genau einem endgültigen Writer zusammenführen. | Offen; keine behauptete aktive M1-Nulleinspeisung. EOS-Entwicklung, vor Aktivierung. |
| NVP-ACT-04 | Vollständige Live-Anbindung von SoC, Verfügbarkeit, Derating, Hybrid-AC-, Phasen- und Scheinleistungsgrenzen fehlt. | Momentanbudgets als hypothetisch kennzeichnen; reale Fähigkeiten in gemeinsame Budgetierung und Ausfallpfade einbinden. | Offen; Diagnose ist keine Leistungszusage. EOS-Entwicklung und Gerätehersteller, vor Aktivierung. |
| NVP-ACT-05 | Gruppenbezogene Tarif-/Peak-Ziele und gemeinsame Energie-/Leistungsreserven nicht durchgehend in die aktive Regelung integriert. | Wirtschaftliche Anforderung, unerfüllten Bedarf und Anschlussabsicherung getrennt behandeln; keine Doppelverplanung mit externer Arbitrage. | Offen; EOS-Entwicklung, vor Freigabe der betreffenden Betriebsart. |
| NVP-ACT-06 | Reale Messstellen-, Vorzeichen-, Zeit-, Kommunikationsausfall- und Neustartnachweise liegen für den dynamischen Pfad nicht vor. | Montage/Messgrenzen, Ende-zu-Ende-Reaktion, lokale Watchdogs und gegebenenfalls unabhängige Schutzpfade mit konkreten Geräten prüfen. | Offen; Anlagenverantwortlicher und Hersteller, vor aktiver Inbetriebnahme. |

Bedienung, Migration, Datenverträge und die Grenzen der Momentanrechnung:
[NVP-Topologie und Diagnose](../NVP_TOPOLOGIE_DIAGNOSE_DE.md).
Alle 33 Soll-Abnahmefälle und ihre Teilabdeckung sind im
[NVP-Prüfplan](../reports/NVP_2026_10_22_PRUEFPLAN_DE.md) zugeordnet.
Ein erfolgreicher Softwarelauf würde die offenen Geräte-/Feldnachweise und
die fehlende aktive Runtimeintegration nicht ersetzen. Dieser Nachtrag
behauptet keine Produktionsfreigabe oder vollständige CRA-/IEC-Konformität.

## Heizstab-Nachtrag vom 08.10.2026

| Kennung | Betroffene Komponente / belegter Ausgangszustand | Voraussetzung / Wirkung | Maßnahme, Status und Restarbeit |
| --- | --- | --- | --- |
| NW-HEAT-01 | `heating-rod-control`: Die externe Handerkennung kann in 1.0.22 vor der Nachtabschaltung greifen, wenn nach einem AUS-Versuch noch eine aktive Stufe zurückgemeldet wird oder der Befehl fehlschlägt. | PV-Auto mit aktivem Nachtfenster und anstehender Gerätewirkung. Die verbleibende Last wird als fremde Handfreigabe behandelt; der Heizstab kann entgegen der Nachtvorgabe weiterlaufen. Hohe betriebliche Priorität wegen unerwünschter elektrischer Heizlast; kein Nachweis eines Angriffs oder einer CVE. | Vorrang der Auto-Nachtsperre und belastbare AUS-Nachführung in 1.0.23 herstellen; Restfeedback nicht als neue Bedienfreigabe werten. Software-Nachprüfung und aktueller Status im [Heizstab-Prüfvermerk](../reports/heating-rod-2026-10-08/PRUEFVERMERK_DE.md). Reale Relais-/KNX-Rückmeldung, Kommunikationsausfall und Neustart auf der Zielanlage bleiben offen. Verantwortlich: EOS-Entwicklung und Anlagenverantwortlicher, vor Übernahme in Feldanlagen prüfen. |
| NW-HEAT-02 | Heizstab-PV-Freigabe und Messwert-Triage in 1.0.22: Veraltete Prognose mit PV 0 W kann eine Probe erlauben, während echte PV von 9.000 W ohne Prognose blockiert werden kann. Veraltete Cachewerte und fehlende Batteriewerte werden nicht durchgängig als unzureichender Nachweis behandelt. | Auto bei Nulleinspeisung mit veralteter/fehlender Prognose oder unvollständiger Messung. Wirkung: unberechtigte Prüflast beziehungsweise blockierter PV-Anlauf; Batterieenergie darf dabei nicht als PV freigegeben werden. Hohe betriebliche Priorität; kein Nachweis einer fremden Ausnutzung. | Aktuelle Messnachweise und optionales Prognosesignal trennen; Alter und echte Datentypen prüfen und unbekannte Batteriewerte nicht zu gültigen Nullwerten umdeuten. Korrektur-/Nachprüfstand im [Heizstab-Prüfvermerk](../reports/heating-rod-2026-10-08/PRUEFVERMERK_DE.md). Reale Messintervalle, Batterievorzeichen und PV-Nachlieferung auf der Zielanlage bleiben zu prüfen. Verantwortlich: EOS-Entwicklung und Anlagenverantwortlicher, vor Übernahme in Feldanlagen prüfen. |

Nachprüfstatus für `NW-HEAT-01` und `NW-HEAT-02`, Stand 08.10.2026:
**im final geprüften Produktquellstand 1.0.23 korrigiert und softwareseitig
nachgeprüft**. Nacht-/Verlaufstest: 11 Gruppen, PV-/Frischetest: 15 Gruppen,
jeweils auf kanonischer Quelle und generierter Runtime; UI: 42 Gruppen.
Ein separater Review-Agent wiederholte die Quellenprüfungen und bestand vier
zusätzliche Fehlerfälle. Geprüfter Heizstab-Quellhash:
`43b9f107903da4cb85c136fd25f730cf15e333656c5b3ed72ec50a9097a75b3a`.
Die Detailbefunde `HR-REVIEW-01`, `06`, `06A`, `07` und `09` gehören zur
Abschalt-/Rückmeldegrenze von `NW-HEAT-01`; `HR-REVIEW-02` bis `05` und `08`
gehören zur PV-/Messwertgrenze von `NW-HEAT-02`. Sie sind keine zusätzlich
gezählten Anlagenbefunde. Quellen: [Prüfvermerk](../reports/heating-rod-2026-10-08/PRUEFVERMERK_DE.md),
[separater Review](../reports/heating-rod-2026-10-08/independent-review.json).
Der abschließende Gesamtlauf `npm run test:all` bestand mit Exit 0; ebenso
SBOM-/Versiegelungsprüfung, Paketvorschau, extrahierter Tarball-Starttest,
Geheimnissuche und vollständige lokale Publish-Prüfungen auf frischer sowie
überlagerter Kopie. Damit sind beide Befunde für den geprüften Softwarestand
geschlossen; Hardware- und Feldnachweise bleiben offen. Keine externe
Veröffentlichung, Geräteinstallation oder Produktivfreigabe wurde dadurch
erteilt oder als durchgeführt ausgegeben.

## Korrigierte Produktbefunde

Für alle Zeilen: verantwortlich für Korrektur/Nachprüfung ist die EOS-Entwicklung,
Termin ist vor Produktfreigabe, ursprüngliche Betroffenheit 1.0.21, korrigierter
Quellstand 1.0.22. Angriffsbedingungen und genaue Quellstellen stehen in den verlinkten
Teilberichten; Prioritäten sind risikobasierte Triage, keine errechneten CVSS-Werte.

| Kennung | Betroffene Komponente und verständlicher Titel | Priorität | Maßnahme und lokaler Nachweis |
| --- | --- | --- | --- |
| NW-AUTH-01 | NexoWatt UI API: technische Zuordnungen bei deaktivierter Auth unzureichend geschützt | Hoch | Installer-/Adminprüfung unabhängig von Kundenschaltern; Auth-HTTP-Regression |
| NW-AUTH-02 | NexoWatt UI API: unbekannter Schreibbereich umgeht einzelne Einstellsperren | Hoch | Feste Scope-Liste; kein generischer Kundenzugriff; Negativtests ohne State-Write |
| NW-AUTH-03 | NexoWatt UI Anmeldung: alte Rechte/Passwörter bleiben in Sitzungen gültig | Hoch | Kontostatus, Passwortbindung und aktuelle Rolle bei jedem autorisierten HTTP-Zugriff |
| NW-AUTH-04 | NexoWatt UI Anmeldung: offener Default und unbeschränkte parallele Sitzungen/Anmeldungen | Hoch | Default session; Rate-/Parallelitäts-/Speicher-/Zeitlimits; Positiv- und Missbrauchsfälle |
| NW-AUTH-05 | NexoWatt UI Browsergrenze: opaque Origin und defekte Cookies | Mittel | Origin/null und Cross-Site sperren, Cookiefehler behandeln |
| NW-AUTH-06 | NexoWatt UI Konfigurationsimport: verschachtelte Prototype Pollution | Hoch | Gefährliche Schlüssel/Tiefen vor Merge/Mutation abweisen; Originalbefund reproduziert |
| NW-AUTH-07 | NexoWatt UI Geräteschnellsteuerung: Sollwertgrenzen nur im Browser | Hoch | Server prüft Schnittmenge von Konfigurations-/DP-Grenzen vor Geräte-/Hold-Schreiben |
| NW-AUTH-08 | NexoWatt UI Live-Daten: Stations-Zugriffstoken in öffentlichen Zuständen; langlebige privilegierte SSE | Hoch | Kiosk-Unterbaum filtern; SSE ausschließlich gefilterter Live-Kanal |
| NW-AUTH-09 | NexoWatt UI Stationsdisplay: set-mode umgeht erlaubte Modi | Hoch | Modusfreigabe auch auf Detailbefehl/Aliase anwenden |
| NW-AUTH-10 | NexoWatt UI Stationskonfiguration: neue zu kurze/mehrfach verwendete Zugriffstoken | Hoch | Neue/geänderte Token mit Format-/Längen-/Eindeutigkeitsprüfung; Altrotation bleibt offen |
| UI-CRA-FE-01 | History/Logikeditor/SmartHome-Setup: gespeicherte Namen/Parameter werden als HTML ausgeführt | Hoch | HTML-/Attributmaskierung an tatsächlichen Sinks; Renderer-Negativtests |
| UI-CRA-FE-02 | SmartHome: ausführbare URL-Schemas und zu große Iframe-Rechte | Hoch | HTTP(S)-Whitelist, keine URL-Credentials, Iframes ohne same-origin-Recht |
| UI-CRA-FE-03 | PWA-Service-Worker: geschützte API-JSON-Antworten im Offline-Cache | Hoch | API immer no-store, kein Offlinefallback; Cachegeneration v520 |
| UI-CRA-FE-04 | Admin-Entwicklung: Queryparameter bestimmen fremde Skriptquelle | Mittel | Socket-Quelle nicht mehr aus host/port-Query steuerbar |
| UI-CRA-FE-05 | Stationsdisplay: schwacher 8-Zeichen-Token und unsicherer Zufallsersatz | Hoch | Neue Token 128 kryptografische Bits; Abbruch ohne sichere Quelle; Alttoken-Hinweis |
| NW-CRA-NET-001 | Mesh: wiederholte signierte Hello-Nachricht setzt Regel-/Sitzungszustand zurück | Hoch | Protokoll v2 mit frischem Challenge, zustandslosem Hello und Replay-/Quotenschutz |
| NW-CRA-NET-002 | Mesh: erlaubter HTTP-Hostname kann auf ein unzulässiges Netz auflösen | Mittel | DNS-Ziel-IP im Verbindungsaufbau prüfen, Antwort-/Zeitlimits und TLS-Mindestversion |
| NW-CRA-NET-003 | SMTP-Konfigurationsspeicherung: vorhersehbare Tempdatei/Symlink | Niedrig | Zufällige exklusive Datei, Modus0600, fsync; lokaler Angreifer mit Verzeichniszugriff vorausgesetzt |
| UI-CRA-NET-04 | Tarifprovider: Geheimnisse über HTTP/Redirects, unbegrenzte Antworten, fremde Fehlertexte | Hoch | Ursprünglich TLS bei Secrets, keine Redirects, Limits und bereinigte Fehler. Folgeanforderung: ausnahmslos HTTPS, gemeinsames 5.000-ms-Budget einschließlich OAuth und strikte vollständige Datenprüfung; [Tarifnachweis](../reports/cra-2026-09-29/HTTPS_5S_TARIF_DE.md) |

Teilberichte: [API](auth-review-de.md), [Frontend](frontend-review-de.md),
[Mesh/SMTP](network-review-de.md), [ergänzendes Review/Tarif](secondary-review-de.md).
Die ergänzenden Alias-Kennungen `UI-CRA-API-04/05/06` entsprechen
`NW-AUTH-06/02/07`; es sind jeweils dieselben Befunde, keine zusätzlichen Fälle. Die Lieferkettenkennungen SUP-01/02/03/04 entsprechen NW-DEP-01/02/03 beziehungsweise NW-PROC-01.

## Ergänzter Geheimnisbefund zum Prüfstand 29.09.2026

| Kennung | Betroffene Komponente / belegter Ausgangszustand | Voraussetzung / Wirkung | Maßnahme, Status und Restarbeit |
| --- | --- | --- | --- |
| NW-SECRET-01 | Lokale Lizenzprüfung in `main.ts`, Laufzeitspiegel und veröffentlichtauglicher `main.js`: der vorherige Paketstand enthielt einen fest eingebauten Lizenz-HMAC-Wert. Betroffen sind Ausgangsversion 1.0.21 und der anfänglich daraus erstellte 1.0.22-Prüfstand. | Lesender Zugriff auf das Quell-/Runtimepaket legt den gemeinsamen Prüfwert offen. Damit können Lizenznachweise außerhalb des vorgesehenen Generators nachgebildet werden. Priorität hoch für Integrität der Lizenz-/Funktionsfreigabe; kein Nachweis einer tatsächlich erfolgten fremden Ausnutzung. | Auf ausdrücklichen Nutzerauftrag vom 23.10.2026 wird ab 1.0.26 der historische NW1-Vertrag für Feldtestanlagen fortgeführt. Die Pflicht zur nachträglichen Dienstmigration entfällt; eine gültige private Signaturbasis bleibt zusätzlich unterstützt. Der bekannte Wert ist weiterhin als öffentliches Kompatibilitätsmaterial zu behandeln. Die Scanner-Ausnahme bindet ausschließlich diesen Wert an Methode, Variable und drei Main-Pfade. Keine Geheimhaltungszusage, kein Authentifizierungsersatz; Anmeldung, Rollen und Geräteprüfungen bleiben erhalten. Spätere Lizenzarchitektur/Rotation in der eigenen EOS-Software; Verantwortlich: EOS-Entwicklung/Lizenzverantwortlicher. [Aktueller Änderungs- und Prüfvermerk](../reports/license-ems-2026-10-23/PRUEFVERMERK_DE.md). |

Tatsächliche Kundenlizenzen und abgeleitete verwendbare Testlizenzen gehören nicht
in Befundtexte, Logs, SBOMs oder das Repositorypaket. Die ausdrücklich fortgeführte
historische Prüfkonstante bleibt allein an ihrem benannten Produktstandort; sie
wird nicht in Berichten oder Testquellen dupliziert. Ihre Vertraulichkeit wird
durch die Kompatibilitätsentscheidung nicht wiederhergestellt. Ein symmetrischer HMAC-Prüfwert bleibt auch
in einer geschützten lokalen Datei für einen privilegierten Hostangreifer
erreichbar. Eine spätere Architektur mit getrenntem Signier- und Prüfschlüssel
ist gesondert zu entwerfen und zu prüfen.

Die zusätzliche [HTTPS-/5-Sekunden-/IEC-Anforderungsakte](../reports/cra-2026-09-29/HTTPS_5S_CRA_IEC_ANFORDERUNGEN_DE.md)
verknüpft diesen Befund mit REQ-25 und trennt die neue Providerhärtung von den
historischen Teilprüfungen. Alte Scannerläufe ohne Fund schließen NW-SECRET-01
nicht; sie hatten diesen eingebauten generischen HMAC-Wert nicht erfasst.

## Lieferkette und Entwicklungsprozess

| Kennung | Komponente / Befund | Status / Nachweis | Verantwortlich / Termin |
| --- | --- | --- | --- |
| NW-DEP-01 | Express/body-parser/qs: npm-Advisories im ursprünglichen Laufzeitbaum | Kompatible Patchupdates, sechs Parser-/HTTP-Regressionen; abschließendes Laufzeitaudit im Prüfbericht | Entwicklung / vor Freigabe |
| NW-DEP-02 | Entwicklungs-Abhängigkeitsbaum: bekannte Advisories | Ungenutztes direktes Testpaket und seine 67 Abhängigkeiten nach Nutzungsprüfung entfernt; finaler Root-Audit ohne Treffer | Entwicklung / vor Freigabe |
| NW-DEP-03 | React Router im ausgelieferten Admin-Bundle: zwei moderate Advisories | Auf 7.18.4 aktualisiert; offizielle Migrationsbedingungen geprüft, 36 Router-/Zugriffstests bestanden. Konkrete Ausnutzung im Ausgangsprofil war nicht belegt. | Entwicklung / vor Freigabe |
| NW-PROC-01 | Geheimnissuche deckte bekannte Provider-Tokenformate nicht ab | Provider-Muster und Positiv-/Negativ-/Redaktionsprüfungen ergänzt; Scanner kann unbekannte Geheimnisse übersehen | Entwicklung / fortlaufend bei Änderungen |
| NW-PROC-03 | Build meldete Sync-Erfolg trotz veralteter manuell typisierter Spiegel | Spiegel fachlich abgeglichen; Build verweigert künftig diesen Zwischenstand, bestehende Konsistenztests bleiben aktiv | Entwicklung / vor Freigabe |
| NW-PROC-02 | Keine vorhandene durchgehende CRA-Akte/SBOM/aktuelle Freigabeentscheidung | Technische Akte, tatsächliche Buildinventare, GitHub-Workflow und gesonderte Prüfung der dokumentierten Produktivfreigabe ergänzt. Normales npm-Publish bleibt an technische Paketprüfungen gebunden; die zunächst eingefügte Kopplung an `release:approval` wurde aufgehoben. Remote-CI/Branchschutz nicht eingerichtet oder ausgeführt | Hersteller / vor Freigabe |

Details und exakte Paketversionen/Advisory-URLs: [Lieferkettenbericht](supply-chain-review-de.md),
`release-manifests/sbom-index.json`, Rohdaten im zentralen Prüfverzeichnis.
Der [Nachtrag zum Upload-/SBOM-Ablauf](../reports/cra-2026-09-29/NPM_UPLOAD_SBOM_KORREKTUR_DE.md)
ordnet die Korrektur gegenüber dem ursprünglichen Prüfstand vom 29.09.2026 ein.
Historische Sperrtests bleiben erhalten; `productionApproved` bleibt `false`.

## Noch offene Auslieferungsbedingungen

| Kennung | Offener Punkt mit praktischer Auswirkung | Nächster Nachweis | Verantwortlich / Ziel |
| --- | --- | --- | --- |
| NW-OPEN-01 | HTTP 8188, Proxy/Cookie-/Origin-Vertrauensgrenze und DNS-Rebinding nicht im echten Zielsystem geprüft | TLS-Konzept, Zertifikats-/Firewall-/Proxytest, Prüfung fremder Origins und direkter Backend-Erreichbarkeit | Systemverantwortlicher / vor Auslieferung |
| NW-OPEN-02 | Bestehende kurze Display-Token und all/lan-Legacy-Bedienfreigaben bleiben migrationsbedingt bestehen | Konten/Policies inventarisieren, auf session umstellen, Tokens bewusst erneuern und Displays aktualisieren | Inbetriebnahme / vor Auslieferung |
| NW-OPEN-03 | Mesh v2 benötigt gemeinsame Aktualisierung; Rückfall/Netzgrenzen nicht an Hardware geprüft | Master/Slave-Sammelupdate, Paketverlust/Neustart/Offline/Grenzverhalten mit realer Anlage | Entwicklung + Inbetriebnahme / vor Aktivierung |
| NW-OPEN-04 | Echte Chromium-Sink- und AppCenter-Tests bestanden; konkrete Kundenkameras/Widgets nach strengeren Iframes noch nicht integriert geprüft | Vorhandene Widgets, Kameras und Bedienung auf Zielanlage prüfen | Entwicklung + Inbetriebnahme / vor Freigabe |
| NW-OPEN-05 | Kein kompletter EOS-Host mit installierten/aktiven Adaptern und OS vorgelegt | Versions-/Konfigurationsinventar und komponentenspezifische Prüfung (einschließlich js-controller) | Hersteller / vor Gesamtfreigabe |
| NW-OPEN-06 | Backup-Restore, Rollback und Erstinstallation nicht auf EOS-Hardware geprüft | Getrenntes Installations-/Wiederherstellungsprotokoll mit Hardware-/Imagebezug | Systemverantwortlicher / vor Auslieferung |
| NW-OPEN-07 | Supportdauer, Meldeweg, Produktklassifizierung/Konformitätsverfahren und unabhängige Prüfung nicht abschließend entschieden | Tatsächliche Herstellerentscheidungen und organisatorische Durchführung dokumentieren | Hersteller / nach gesetzlicher Fälligkeit, spätestens vor Freigabe |
| NW-OPEN-08 | Optionaler alter RC45-Test referenziert nicht mehr vorhandenes Bundle und obsolete Lizenzrechte | Altprüfung modernisieren oder mit begründeter Ablösung archivieren; aktuelle Rollen-HTTP-Regression bleibt Pflicht | Entwicklung / vor nächster Pflegefreigabe |

Freigabeentscheidung: **nicht erteilt**. Korrigierte Quellbefunde werden dadurch
nicht wieder als ungeprüft behandelt; offene Gesamtsystemnachweise werden umgekehrt
nicht durch einen erfolgreichen lokalen Testlauf ersetzt.
Die ausdrücklich vorgesehenen Tests des Nutzers auf seinem eigenen Livesystem
werden durch diesen Status nicht technisch gesperrt. Ein erfolgreicher npm-Upload
belegt keine Durchführung oder Abnahme dieser Eigentests.


## Nachtrag 23.10.2026 – Regelprüfung 1.0.28 / Härtung 1.0.29

Die aktuellen Befunde **NW-HTTP-01/02, NW-TS-01/02, NW-CODE-01, NW-PROC-04,
NW-LIC-02 und NW-DEP-04** sind im
[neuen Prüfbericht](../reports/security-standards-2026-10-23/PRUEFBERICHT_DE.md)
mit Voraussetzungen, Maßnahmen und tatsächlichem Nachprüfstatus dokumentiert.
Der Bericht unterscheidet Baseline und korrigierten Stand. Historische Null-Fund-
Scans sind keine aktuellen Sicherheitsnachweise. NW-SECRET-01 und NW-OPEN-01
bleiben offen; die funktionierenden Feldtestlizenzen bleiben erhalten.

Die früheren NVP-Abschnitte oben beschreiben den damaligen Stand 1.0.24 und
sind kein aktueller Beleg einer noch gesperrten App: die aktive generische
Implementierung und ihr begrenzter Softwareprüfstand sind in den Berichten
1.0.25–1.0.28 dokumentiert. Reale Anlagennachweise bleiben davon getrennt.

## Fortsetzung 1.0.30: manueller Mesh-Peer-Transport (23.10.2026)

| Kennung | Reproduzierter Befund / Voraussetzungen | Maßnahme und Nachweis |
| --- | --- | --- |
| NW-MESH-HTTP-01 | Rollenpflichtiger manueller Peer-Feldtest bei installierter/aktiver Mesh-App und Koordinatorrolle `off`: ein konfigurierter/kompromittierter Peer kann per 302 den benutzerdefinierten Token-Header an einen anderen Origin weitergeben; Antworten ohne Größenlimit, ungültiges JSON fälschlich als Erfolg. Im lokalen echten Express-/HTTP-Lauf mit Zufallstesttoken, zweitem Origin und 2.097.183-Byte-Antwort nachgewiesen. Mittel; kein anonymer Pfad oder tatsächlicher Fremdangriff behauptet. | Native Redirectsperre, Stream-/Header-/JSON-Limits, höchstens 5s Gesamtbudget pro vollständiger Peer-Sequenz, TLS-Gegenstellenprüfung, sichere Diagnosecodes, Singleflight und tiefe Null-Prototyp-Validierung. Bestehende HTTP/LAN/Tailscale-/Mehrpeer-/neutrale Probe erhalten. 28 neue Transport-/HTTP-Prüfgruppen, Strict/ESLint und bestehende Mesh-/HTTP-Prüfer bestanden; [Änderungs- und Prüfbericht](../reports/security-continuation-2026-10-23/MESH_PEER_DE.md). Zuständig EOS-Entwicklung. Reale Netz-/TLS-/Hardwareprüfung weiterhin NW-OPEN-01/NW-OPEN-03. |

## Nachtrag 24.10.2026 – HTTP-/Admin-Sicherheitsstand 1.0.31

Der neue Laufzeitaudit des unveränderten 1.0.30-Baums meldet zwei betroffene
Backendpakete (high/moderate), der Admin-Laufzeitbaum keinen Treffer. Das ist ein
aktualisierter Advisory-Abgleich und keine Aussage, dass die Paketfehler durch
die Änderungen von 1.0.30 neu eingeführt wurden. Die bestandene lokale Endnachprüfung von 1.0.31
ist im [aktuellen Prüfbericht](../reports/security-patch-2026-10-24/PRUEFBERICHT_DE.md)
mit Rohbelegen dokumentiert. NW-DEP-05, NW-DEP-06 und NW-ADMIN-HTTP-01 sind im
geprüften Softwarestand geschlossen. NW-DIAG-01, NW-TARIF-UX-01 und die
gesonderten Anlagen-/Freigabepunkte bleiben offen.

| Kennung | Befund / praktische Auswirkung | Maßnahme und Status |
| --- | --- | --- |
| NW-DEP-05 | `body-parser` 1.20.8, GHSA-27r3-jxmh-p828: nachlaufende Fehlerbytes komprimierter JSON-Requests können laut Hersteller den Prozess abbrechen. Hohe Advisory-Einstufung. Globaler Parser vor Login und aktive Dekompression im Ausgangsprodukt bestätigt; kein Angriff auf eine Liveanlage. | Gelockt auf 1.20.9; zusätzlich alle vier JSON-Eingangsparser mit `inflate:false`, damit komprimierte Bodys auch bei älterem transitivem Installationsbaum vor Dekompression abgewiesen werden. Unkomprimierte API-Verträge erhalten. Lokal nachgeprüft: Ausgangsabbruch isoliert reproduziert; korrigierter Stand besteht 28 HTTP-Fälle einschließlich normaler Folgeanfragen und Gesamtregression. Im geprüften Softwarestand geschlossen; reale Anlagenfreigabe separat. EOS-Entwicklung. |
| NW-DEP-06 | Nodemailer 10.0.10: drei moderate Meldungen GHSA-8c8m-p3m8-cjg8 / GHSA-m943-m63m-w62w / GHSA-85x2-q946-cp5h zur Adressanalyse. Der eigene Einzeladressvalidator verwirft die veröffentlichten Beispielformen; keine tatsächliche falsche Zustellung im Produkt nachgewiesen. | Exakt 10.1.4; vorhandene Validatoren und TLS-/Versandgrenzen bleiben. Drei Parserfälle, drei Ablehnungen vor Transport und normale Mailkomposition bestanden; finaler Root-Audit ohne Treffer. Im geprüften Softwarestand geschlossen. Keine reale SMTP-Zustellung geprüft. EOS-Entwicklung. |
| NW-ADMIN-HTTP-01 | Allgemeine Admin-Antworten ohne Bytebudget vor `Response.json()`; Strukturprüfung erst nach vollständigem Einlesen. Ressourcenrisiko im Browser, kein konkreter Remote-Angriffspfad nachgewiesen. | Native 16-MiB-Streaminggrenze vor `JSON.parse`, echter Abbruch und bestehende Endpoint-Fristen. 16 neue Streamgruppen, neun Vertragsgruppen und Admin strict bestanden; zwei zusätzliche lokale HTTP-Gegenversuche bestanden. Im geprüften Softwarestand geschlossen, Gesamtbrowser-/Anlagenabnahme separat. EOS-Entwicklung. |
| NW-DIAG-01 | Bei aktiver dynamischer Speicher-Stellhoheit kann der Tarifstatus alte Single-/Farm-Zustände als frisch auswerten und trotz dynamischer Ladung „Speicher wartet“ anzeigen. Mit synthetischer Runtime am 24.10.2026 reproduziert. Kein Beleg einer realen Ladeblockade oder eines Cyberangriffs. | Offen; Tarifstatus an tatsächliche Stellhoheit und aktuelle Messzeitstempel anbinden. Kein Bestandteil dieses HTTP-/Admin-Patches. EOS-Entwicklung, vor Freigabe der betroffenen Diagnose. |
| NW-TARIF-UX-01 | STANDARD-Hilfetext behauptet keine zusätzliche Sperre; die bestehende Speicherpolitik verlangt bei aktivem zeitvariablem Netzentgelt zusätzlich ein NT-Fenster. Nutzer bestätigte am 24.10.2026 aktives Netzentgelt und STANDARD-Phase als passende Erklärung seines beobachteten Wartens. | Offen; Hilfetext präzisieren. Keine Umgehung der bestehenden NT-Regel und kein pauschales Abschalten des zeitvariablen Netzentgelts. EOS-Entwicklung, vor nächster UI-Pflege. |

Die bekannte NW1-Kompatibilitätsschwäche NW-SECRET-01, tatsächliche Host-/TLS-
und Tokenzustände, vollständige ASVS-Einzelnachweise und die unabhängige Prüfung
bleiben gesondert offen. Es gibt weiterhin keine allgemeine Kundenfreigabe oder
Garantie, dass keine unbekannten Schwachstellen bestehen.
