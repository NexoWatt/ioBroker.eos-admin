# Bestandskompatibilität 1.0.37 → 1.0.38

Stand: 22. November 2026. Vergleich gegen die aus dem SHA-geprüften ausgelieferten ZIP wiederhergestellte Version 1.0.37. Geprüft wurden Dateien und Paketkonfiguration; es wurde keine Kundeninstanz installiert, gelesen oder verändert. Der maschinenlesbare Nachweis mit Einzeldatei-Hashes liegt in [bestandskompatibilitaet-hashes.json](bestandskompatibilitaet-hashes.json).

## Ergebnis

**Die bestehende EMS-Regelung, die bisherigen nativen Standardwerte und das SmartHome-Datenmodell sind im geprüften Paketbestand erhalten.** Direkter HTTPS-Betrieb wird ausdrücklich zusätzlich eingeschaltet; das Update schaltet vorhandene Installationen nicht automatisch auf HTTPS um. Die folgenden Aussagen beruhen auf tatsächlichem Byte-/JSON-/Quelltextvergleich, nicht nur auf unveränderten Versionsnummern.

| Geprüfter Bereich | Belegtes Ergebnis |
| --- | --- |
| EMS-Produktquellen | Alle **91** Dateien unter `src-ts/runtime-executables/ems/**` sind bytegleich. Keine Quelle hinzugefügt oder entfernt. |
| Ausgelieferte EMS-Dateien | Alle **101** Dateien unter `ems/**` sind bytegleich: **91 JavaScript-Dateien und 10 JSON-Dateien**, einschließlich Unterordnern. |
| Vorhandene native-Konfiguration | Sämtliche Werte unter den **32 bisherigen obersten Schlüsseln** von `io-package.json.native` sind tiefengleich. Kein bisheriges Feld entfernt oder geändert. |
| Neue Transportkonfiguration | Ausschließlich `secure: false`, `certPublic: ""`, `certPrivate: ""` und `certChained: ""` additiv. Es werden keine Schlüssel oder Zertifikate mitgeliefert. |
| Konfigurationsmigration | Der tatsächliche Quelltext von `main.ts:migrateNativeConfig` ist unverändert. Es wurde keine neue Bestandsmigration zum Zurücksetzen von Zuordnungen oder Einstellungen ergänzt. |
| SmartHome | Vertrag/Normalisierung, Konfigurationseditor und Visualisierung sind jeweils als TS-Quelle **und ausgeliefertes JS bytegleich**. Die vorhandenen `native.smartHome`- und `native.smartHomeConfig`-Werte sind unverändert. |
| Web-App-Identität | Das gesamte Manifest ohne die Versionsfelder ist strukturgleich. `start_url: "."`, `scope: "./"`, Name, Darstellungsmodus und Iconreferenzen bleiben erhalten. Nur `version` und `appVersion` wechseln auf 1.0.38. |
| Originalbilder | Alle **14** Dateien unter `www/assets/icons/**`, die **5** Energieflussbilder unter `www/icons/**`, `apple-touch-icon.png`, die vorhandenen beiden Web-Logodateien und das Admin-Icon sind bytegleich. |
| Passwort-/Rollengrenzen | `ui-access-policy`, Benutzerprüfung, Benutzerrollen und der Browser-Authwächter sind jeweils als TS und JS bytegleich. Native Auth- und Zugriffsgruppeneinstellungen sind unverändert. |

## Einordnung der Änderungen

### HTTPS und vorhandener Anlagenbetrieb

Ohne ausdrücklich gesetztes `secure: true` liefert der neue Transporthelfer weiterhin den bestehenden HTTP-/Proxybetrieb. Bei gewähltem HTTPS werden nur die ausdrücklich konfigurierten Namen der zentralen Zertifikatverwaltung gelesen. Fehler erzeugen keinen unverschlüsselten Ersatzlistener.

Die ergänzte Startbehandlung fängt ausschließlich den eigenen TLS-Konfigurationsfehler lokal auf: Die UI bleibt gesperrt und meldet keine erfolgreiche Verbindung; die bisherige autonome EMS-/SmartHome-Initialisierung wird fortgesetzt. Ein Shutdown-Guard vor und nach dem asynchronen Zertifikatslesen verhindert einen verspäteten Listenerstart. Das ist eine gezielte Änderung am UI-Lebenszyklus; keine EMS-Regelstrategie oder Geräteansteuerung wurde ersetzt. Der zugehörige Funktionsnachweis gehört zum gesonderten HTTPS-Integrationsgate und ist kein Bestandteil dieses Bestandsvergleichs.

### Anmeldung und Zugriffsschutz

Die tatsächlichen Quelltextabschnitte von `parseCookies`, `getStoredSession`, `resolveStrictAccess`, `loginTransportAllowed`, `doAuthLogin` und `doAuthLogout` in `main.ts` sind gegenüber 1.0.37 unverändert. Die zentrale Schranke vor Seiten/API sowie ihre Auth-/CSRF-Prüfung sind im Diff ebenfalls unverändert. Die technische Auswahl der getrennten und zentralen Anmeldung wird durch das Branding nicht umbenannt oder umgestellt.

Im Login-Controller wurde ausschließlich die separate Profilanzeige einschließlich ihrer DOM-Abhängigkeit entfernt; Passwortübertragung, sichere Zielprüfung, zentrale Anmeldung und Formularbehandlung bleiben bestehen. Die Bedienseiten laden jetzt den vorhandenen Runtime-/Auth-Bootstrap ausdrücklich auch beim direkten Einstieg. Dadurch stehen dessen vorhandene Sitzungs- und CSRF-Regeln vor der Bedienlogik zur Verfügung; es wurde keine zusätzliche Benutzerrolle freigegeben.

Der neue gemeinsame PWA-Bootstrap und die angepasste Offlineanzeige erlauben keine geschützten Offline-Seiten oder Daten. Die Worker-Regeln für ausschließlich öffentliche Bild-/Schriftdateien bleiben bestehen. Die neue Cacheversion ersetzt alte öffentliche Asset-Caches; sie ist keine Migration von Kundendaten. Die zusätzliche Datei `www/nexowatt-eos-logo.png` für Login/Offlineanzeige ersetzt keines der vorhandenen App-Icons.

### SmartHome-Bestand

Der vollständige Vertrag in `smarthome-contract.ts` und dessen ausgeliefertes JS sind bytegleich. Damit bleiben insbesondere vorhandene Gerätekennungen, Räume, Funktionen, Szenen und Datenpunktzuordnungen im selben Schema. `smarthome-config.ts/js` und `smarthome.ts/js` sind ebenfalls bytegleich. In `smarthome-import.ts/js` ändert sich nur ein erklärender Hinweis von der Produktbezeichnung zur Datenpunktzuordnung; Aliasauflösung, Übernahmeentscheidung und Importprovenienz werden dadurch nicht geändert.

## Grenzen der Zusage

Dieser Vergleich stützt die Aussage: **Der geprüfte Softwarebestand erhält vorhandene Regelung, Einstellungen und Zuordnungen und ergänzt HTTPS ohne automatische Umstellung.** Er ist keine Hardwareabnahme und keine Garantie für jede kundenspezifische Anlage, Fremdadapterversion oder Netzwerkkonfiguration. Tatsächliche Kundendaten wurden hier nicht erhoben; reale Gerätekommunikation wurde in diesem Schritt nicht geprüft.

Bei unverändertem Browser-Ursprung bleiben Manifestidentität und App-Icons erhalten. Eine ausdrücklich aktivierte Umstellung von HTTP auf HTTPS oder ein anderer Host/Port ist jedoch ein anderer Browser-Ursprung. Ein vorhandener HTTP-Shortcut wird durch diese Softwaredateien nicht automatisch in einen HTTPS-Shortcut umgeschrieben; dafür muss die passende gesicherte Adresse auf dem Endgerät geöffnet beziehungsweise neu verknüpft werden. Das Endgerät muss dem Zertifikat für den tatsächlich aufgerufenen DNS-Namen oder die IP-Adresse vertrauen. Eine erneute Anmeldung nach Adapterneustart entspricht dem vorhandenen Sitzungsvertrag.

## Reproduzierbarer Vergleich

Die JSON-Beilage enthält die sortierten Dateiinventare mit vorherigem und aktuellem SHA-256 sowie tatsächlichem Bytevergleich, die vier additiven nativen Felder, das unveränderte Manifestmodell, die relevanten Auth-/SmartHome-Dateien und die identischen Funktionsabschnitte aus `main.ts`. Inventarhashes werden aus `JSON.stringify` der nach Dateipfad sortierten Liste `{file, sha256}` gebildet. Es wurde keine zusätzliche Laufzeit-Testmatrix eingeführt und kein Produktcode für diesen Nachweis verändert.
