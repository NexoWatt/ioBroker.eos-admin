# NexoWatt EOS 9.0.18 – Geräte, EMS und Energiefluss

Stand: 24.11.2026. Grundlage ist der unveränderte gelieferte 9.0.17-Quellstand, dessen Repo-ZIP mit SHA-256 `9fcce971b2083cd64abc55883029f25ffd56b3cc354320aaf02e8a6973c698af` geprüft wurde. Die Lieferung bleibt ein Integrations-Teststand im Kanal `next`; Lizenz und zentrale NWL3-Freigabe bleiben unverändert.

## Änderungen und Wirkung

Unterstützte Geräte erhalten im Geräteeditor eine EMS-Aufgabe. Wallboxen können automatisch einem Ladepunkt zugeordnet werden. Speicher wählen ausdrücklich Einzelregelung oder die vorhandene Farm. Zähler wählen M0, M1, Erzeugung oder Verbrauch. PV-Wechselrichter und Erzeugungszähler wählen eines der sechs vorhandenen Erzeugungsfelder, Verbrauchszähler eines von zehn Verbrauchsfeldern. Die vollständige Bedienmatrix steht in [GERAETE_EMS_EINRICHTUNG.md](GERAETE_EMS_EINRICHTUNG.md).

Die automatische Übernahme verwendet den tatsächlich veröffentlichten Alias-V1-Vertrag und die passenden vorhandenen Objekte. Typ, Einheit, Lese-/Schreibfähigkeit, Geräte- und Profilidentität werden geprüft. Es werden keine Messwerte, Steuerfähigkeiten oder Zieladressen erfunden. Abweichende Geräteprofile zeigen fehlende Funktionen oder einen offenen Status. Spezialisierte FEMS-Regelung, M1-Speicherregelung und beliebige zusätzliche Farmtopologien werden nicht aus einer einfachen Auswahl abgeleitet.

Ein reiner Planer ergänzt freie passende Felder. Bestehende nicht leere Kundenwerte, Anlagenlimits und manuelle Zuordnungen haben Vorrang. Stabile Gerätekennungen und gespeicherte Zuordnungsidentitäten verhindern doppelte Ladepunkt-/Farmzeilen bei wiederholtem Speichern und Neustarts. Native ioBroker-Aliasketten werden anhand konkreter bereits konfigurierter IDs, getrennt nach Lesen und Schreiben, begrenzt aufgelöst. Doppelte Steuerziele, belegte Plätze und mehrfach verwendete Messquellen werden als Konflikte behandelt. Es erfolgt keine globale Objektsuche und keine Ausführung von Alias-Ausdrücken durch diese Auflösung.

Neue steuerbare Einträge bleiben deaktiviert, bis sie im App-Center geprüft und freigegeben werden. Eine automatische Zuordnung aktiviert keine zusätzliche EMS-App und sendet keinen Hardware-Testbefehl. Der Modus „Nur Messwerte“ beziehungsweise das autoritative Deaktivieren/Entfernen eines Geräts deaktiviert ausschließlich dessen automatisch verwaltete Regelzeilen. Ihre Konfiguration bleibt erhalten; eine spätere Rückkehr aktiviert sie nicht wieder selbstständig. Der Modus „Manuell“ erhält die vorhandene manuelle Betriebsfreigabe. Fremde manuelle Einträge werden nicht abgeschaltet.

## Gemeinsamer Aliasvertrag und Kundentarif

Die ergänzenden Alias-V1-Rollen werden aus explizit gebundenen, tatsächlich lesbaren Profilquellen erzeugt. Alle 195 mitgelieferten Profile sind in einer [Vertrags- und Verfügbarkeitsmatrix](ALIAS_V1_VERTRAG.md) erfasst. Gleiche Funktionen erhalten gleiche Namen und Einheiten; unklare oder fehlende Quellen bleiben nicht verfügbar. Vorhandene Legacy- und kanonische Aliase bleiben erhalten. Die neuen Rollen erzeugen keine zusätzlichen Schreibfähigkeiten. SolaX und FENECON werden zusätzlich mit der tatsächlichen Profil-/Alias-Erzeugung durchgängig getestet.

FENECON Home unterscheidet tatsächliche ESS-Leistung 604, ESS-Leistungsvorgabe 706 und den echten, identitätsgeprüften FEMS-NVP-Regler. Messwerte für PV-Anteile, Verbrauch und Leistungsgrenzen werden bei verfügbarer Quelle vorbesetzt. Ein fehlender tatsächlicher Sollwert-Readback wird nicht aus einer Schreibbestätigung erzeugt. Bestehende automatische Regelungen erhalten keinen neuen nativen Netzsollwert, wenn dieser die bisherige direkte ESS-Regelung unbemerkt umstellen könnte. Eine entsprechend offene Inbetriebnahme wird angezeigt. Andere Hersteller werden nicht in FENECON-spezifische Steuerlogik eingetragen; gemeinsame SOC-/Leistungs-/Befehlsfunktionen verwenden ihre eigenen Standardaliase.

Der neue Tarifbereich in den Kundeneinstellungen bearbeitet ausschließlich den gemeinsamen Anlagentarif. Feste Preisquellen und Anbieterprofile mit Vertragsaufschlägen werden unterschieden; frei eingebbare Netzwerkziele bleiben außerhalb dieser Kundenschnittstelle. Vorhandene Expertenanbindungen bleiben bis zum bewussten Wechsel erhalten. Token sind schreibgeschützt in der Anzeige, werden nicht an andere Anbieter weitergereicht und nicht über öffentliche Konfigurations-/Exportantworten ausgegeben. Der bestehende interne Konfigurationsstate und dessen Wiederherstellungsbackup sind zugriffsgeschützt; diese Änderung behauptet keine neue Verschlüsselung der dort gespeicherten Tarifzugänge.

Das Speichern verwendet dieselbe Revisionsprüfung wie das App-Center und verändert weder Geräte noch App-Freigaben oder Anlagenlimits. Vorhandene explizite Betriebsoptionen bleiben auch bei deaktiviertem Anbieter erhalten. Die Zustimmung zur Verwendung der Preise ersetzt ausschließlich vier Preiszuordnungen und aktualisiert die sechs entsprechenden internen Leser ohne EMS-Neustart. Beim Zurückwechseln werden zuvor gesicherte Zuordnungen wieder eingesetzt. Ein Wechsel invalidiert alte Preise/Kurven sofort; verspätete Abrufe, Datenbankereignisse und Cache-Ladevorgänge dürfen sie nicht wieder als aktuelle Regelgrundlage einsetzen. Fehlende aktuelle Preise werden nicht in künstliche Nullpreise umgewandelt. Details: [Kundentarif](KUNDENTARIF_EINRICHTUNG.md) und [technischer Review](CUSTOMER_TARIFF_REVIEW.md).

## Speicherung, Updates und Ressourcen

Das Gerät wird zuerst über den vorhandenen verschlüsselten Modul-Konfigurationsspeicher gesichert. Die anschließende EMS-Zuordnung verwendet dieselbe geschützte Warteschlange wie das App-Center. Ist das EMS oder der Aliasbestand noch nicht bereit, bleibt die bereits erfolgreiche Gerätespeicherung erhalten und die Zuordnung sichtbar ausstehend. Eine begrenzte Wiederholung und Bereitschaftsereignisse setzen den Ablauf fort. Es wird keine atomare Transaktion über beide Speicherbereiche behauptet.

App-Center-Formulare erhalten einen revisionsgebundenen Änderungsschutz. Eine alte nicht leere Liste darf einen inzwischen automatisch hinzugefügten Ladepunkt beim Speichern oder Import nicht entfernen. Der Server antwortet mit einem Konflikt; die Oberfläche erhält die ungespeicherten Eingaben. Der Revisionstoken verwendet einen flüchtigen HMAC-Schlüssel, keine offengelegten Konfigurationsinhalte. Nach einem Neustart muss ein vorher geöffnetes Formular seinen Stand neu laden.

Fehlende interne EMS-Objekte werden vor der Übernahme einer neuen Konfiguration angelegt. Fehler werden sichtbar weitergegeben, statt scheinbaren Erfolg zu melden. Vorhandene Werte und RFID-Listen werden erhalten; ein Datenbank-Lesefehler wird nicht als leere Liste behandelt. Die automatische Löschung früherer Ladepunkt-/Stations-/Historienobjekte beim Start ist entfernt. Deaktivieren und erneutes Aktivieren einer App setzt ihre gespeicherten Zuordnungen nicht zurück.

Die Zuordnungsarbeit läuft ereignisgesteuert außerhalb des Regeltakts. Die Bestandsaufnahme begrenzt Geräte, Aliase, parallele Lesevorgänge und Laufzeiten; Änderungen werden zusammengefasst. Nicht jeder Telemetriewert startet eine neue Bestandsaufnahme. Ein Lizenz-/Eigentumsverlust oder Stopp verhindert weitere Übernahmeversuche. Eine konkrete RAM-Einsparung oder unveränderte reale Regellatenz wird ohne Zielgerätemessung nicht behauptet.

## Erhaltener Parallelbetrieb und Sicherheit

Die Trennung aus 9.0.17 bleibt enthalten: EOS-eigene Cookies, eigenes Socket-Geheimnis und keine automatische Veränderung fremder ioBroker-Rechte, Icons oder Updatepolitik. Die neue Inbetriebnahme schreibt eigene beziehungsweise kontrolliert übernommene NexoWatt-Konfigurationen und die schon vorgesehene eigene Sicherung in `0_userdata`; sie verändert keine `admin.0`-/Standard-`backitup.0`-Konfiguration und keine globalen Benutzergruppen.

Geräte-/App-Center-Änderungen bleiben an Authentifizierung, Rollenrechte, CSRF-Prüfung, Lizenz und Schreibzuständigkeit gebunden. Fehlerstatus enthält begrenzte technische Codes und Gerätezuordnungen, keine Gerätepässe, Passwörter oder kompletten geschützten Konfigurationen. Die JavaScript-Planer-/Servicegrenze, der neue TypeScript-Speicherhelfer und die Geräte-UI werden zusätzlich strikt typgeprüft. Es wurden keine neuen Laufzeitabhängigkeiten eingeführt.

## Bei der Verifikation gefundene und korrigierte Fehler

- Die zusätzliche Aliasauflösung behandelte echte berechnete/Heartbeat-Lesealiase ohne `dpId` zunächst als unvollständig. Ein wiederholter Übernahmelauf blieb dadurch ausstehend. Der Test mit der tatsächlichen ABL-Profil-/Alias-Erzeugung hat dies nachgewiesen; verifizierte eigenständige Lesealiase bleiben jetzt gültige Endpunkte. Unklare Schreibziele werden weiterhin abgelehnt.
- Die manuelle App-Center-Erkennung erkannte zuvor keine Gerätekennungen mit Punkten. Sie gruppiert jetzt anhand der echten Geräte-/Aliasgrenze, einschließlich kontrolliert beibehaltener Altnamensräume. Der HTTP-Test prüft sowohl `wallbox.entrance` als auch `meter.grid`.
- Beim direkten Anbieterwechsel blieben interne Tarif-Leser zunächst auf den alten Datenpunkt-IDs. Zusätzlich konnte ein verspätetes altes State-Ereignis einen bereits geleerten Preis-Cache erneut füllen. Durchgängige Tests mit der tatsächlichen Registry und dem Tarifverbraucher haben beide Fälle nachgewiesen; die Leser werden jetzt direkt umgebunden und die eigenen Preisquellen während der Übergabe gesperrt.
- Eine allgemeine Schreibbestätigung aktualisierte bisher alle Aliase desselben Rohdatenpunkts. Die neuen reinen Geräte-Rückmeldungen überspringen diese Bestätigung und werden erst durch tatsächliche Geräteabfragen aktualisiert.
- Das ältere Release-Synchronwerkzeug fügte dem ioBroker-Metadatenschema unzulässige Felder hinzu. Diese werden entfernt; `meta` verbleibt nur im Repository-Eintrag. Der aktuelle Nachrichtenblock bleibt auf 20 Einträge begrenzt. Ein Regressionstest validiert das Ergebnis des Werkzeugs gegen das unveränderte ioBroker-Schema.

## Tatsächliche Prüfungen

<!-- FINAL_RESULTS_BEGIN -->
| Prüfung | Ergebnis |
| --- | --- |
| Vollständiges `npm test`, Node 22.23.4 | 1574 Tests, 1572 bestanden, 0 fehlgeschlagen, 2 ausgelassen; fünf vollständige Phasen |
| Vollständiges `npm test`, Node 24.22.3 | Gleicher Umfang und gleiche Ergebnisse |
| Ende-zu-Ende-Gerätezuordnung | Echte ABL-, FENECON- und SolaX-Aliaserzeugung, Speicherung, Wiederherstellung, Konflikte und unveränderte Kundenwerte |
| App-/Konfigurationslebenszyklus | 8 Fälle in beiden vollständigen Läufen, einschließlich HTTP-Revisionskonflikt, Objektanlage und gepunkteter Geräte-IDs |
| Kundentarif | HTTP-, UI- und echte Laufzeit-Verbrauchertests für Berechtigungen, Schutz vorhandener Einstellungen, Anbieterwechsel und verspätete Altantworten |
| Aliasvertrag | Vollständiges Profilinventar und Quellbindungen; Einheiten, Vorzeichen, fehlende Fähigkeiten und echte Rückmeldung getrennt geprüft |
| Typprüfung | Gesamtprüfung einschließlich neuer strikter Bereiche unter Node 22 und 24 bestanden |
| Lint | Unified-Prüfung einschließlich Geräte-UI und neuem Speicherhelfer bestanden |
| Builds | Admin, Installer, Backend, UI-Runtime und Module erfolgreich |
| Dokumentation / Quellabgleich | Dokumentationsprüfung und Runtime-Synchronprüfung bestanden |
| Sicherheitsgate | 213 Quellen, 0 neue blockierte Befunde; 3222 inventarisierte Fundstellen, davon 2951 historisch offen und 271 einzeln geprüft |
| Geheimnisprüfung | UI-Prüfung bestanden; zusätzlicher Scan im Paketgate |
| npm-Audit Laufzeit | 0 gemeldete Advisories |
| npm-Audit Entwicklung | 14 moderate, 0 niedrige, 0 hohe, 0 kritische Advisories; kein sauberer Gesamtaudit behauptet |
| SBOM | Laufzeit-, Build-, Frontend-/Installer- und interne UI-Inventare aktualisiert; Verifikationen bestanden |

Die beiden ausgelassenen Fälle betreffen fehlendes `nginx` und `setfacl`. Die Keygen-1.0.4-/HTTPS-Aktivierung wurde mit der bytegeprüften bisherigen Generatorquelle und flüchtigen Testschlüsseln ausgeführt. Es wurden keine Herstellerschlüssel ausgelesen. Der vollständige aktuelle Testlauf enthält auch die bestehenden Parallelbetriebs-, Sitzungs-, Lizenz- und Konfigurationserhaltungsprüfungen. Ein laufender produktiver Standard-Admin/Backitup und physische Aktoren sind dadurch nicht nachgewiesen.

Ein optionaler tatsächlicher Controller-/Paketlauf und die Prüfungen der abschließenden Lieferdateien werden im separaten Liefernachweis dokumentiert; frühere Controllerergebnisse aus 9.0.17 gelten nicht als erneuter Nachweis für 9.0.18.
<!-- FINAL_RESULTS_END -->

Die Rohbelege werden unter `raw/INDEX.json` mit tatsächlichem Befehl, Ergebnis und SHA-256 geführt. Beide vollständigen Testprotokolle und ihre Node-Versionen werden vor dem Packen mit Quellen und Builds im Release-Nachweis gebunden. Die anschließend erzeugten ZIP-/TGZ-Dateien und Veröffentlichungs-Trockenläufe erhalten einen getrennten Liefernachweis.

Die unabhängigen durchgängigen Tests verwenden echte Geräteprofil-/Alias-Erzeugung, echten Modulhost, Planer, geschützte Speicherung und tatsächliche gehostete EMS-Konfigurationsmethoden. Die Datenbank und Hardwaretransporte sind kontrollierte Testmodelle. Details: [unabhängiger Review](UNABHAENGIGER_REVIEW.md) und [Speicher-/App-Lebenszyklus](INSTALLER_LIFECYCLE_REVIEW.md).

## Bekannte Grenzen und Abnahme

Ein Erzeugungsfeld verwendet eine Quelle; mehrere Wechselrichter werden nicht automatisch summiert. Eine Summenquelle darf nicht zusätzlich mit ihren Teilquellen doppelt in die Produktion eingehen. Diese physische Anlagentopologie lässt sich nicht allein aus unterschiedlichen Datenpunktnamen beweisen. Ebenso kann derselbe Aktor, der unter zwei unterschiedlichen Geräte-IDs und unabhängigen Verbindungen angelegt wurde, nicht zuverlässig anhand seiner Aliase als physische Dublette identifiziert werden.

Der vorbereitete Chromium-Test konnte in dieser Ausführungsumgebung wegen `socket() Operation not permitted` vor dem Seitenaufruf nicht starten. Desktop-/Mobilansicht und der tatsächliche Browser-Speicherdurchlauf bleiben hier offen. DOM-/Vertragstests ersetzen diesen grafischen Nachweis nicht. Native Windows-Veröffentlichung, Smartphonebetrieb und echte Wallboxen, Zähler oder Speicher wurden nicht auf Kundenhardware ausgeführt.

Für die Zielanlage sind nach dem Update unveränderte bestehende Konfiguration, ein neues Gerät mit passender Rolle, korrekte Energieflussmessrichtung, Wiederholung ohne Duplikate, gezielte Freigabe des neuen Reglers und Erhalt nach Neustart zu prüfen. Standard-Admin und Backitup bleiben parallel zu prüfen. Softwareprüfungen sind kein pauschaler Produktions- oder CRA-Konformitätsnachweis. Installation und Rückfall: [START_HIER_9.0.18.md](../../../START_HIER_9.0.18.md).

Primärbezug, geprüft am 24.11.2026: [offizielle ioBroker-Adapterreferenz](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterref.md). Die bestehenden Konfigurationserhaltungs- und Sicherheitsanforderungen sind in [ANFORDERUNGEN.md](ANFORDERUNGEN.md) den Prüffällen zugeordnet.
