# DEVICES-INTEGRATION-906-001

Datum: 23.11.2026. Laufzeit der Prüfungen: Node.js v24.22.3. Stand: EOS 9.0.6, integriertes NexoWatt Devices 0.5.176.

## Änderung und Nachweise

Die vollständigen Geräteprofile und Protokolltreiber aus dem bereitgestellten Quellarchiv `iobroker.nexowatt-devices-0.5.176_FULL_REPOSITORY.zip` wurden als lokal gehostetes Modul übernommen. SHA-256 des Quellarchivs: `f254c5b7d1421a432718cc7b2d5b5576925a2ddb0216e192dec3cabbf49d75d4`. Die Einzeldaten befinden sich in `modules/devices/provenance.json`. Die bestehenden proprietären Rechte bleiben erhalten; es entsteht keine zweite Adapterinstanz oder Lizenzverwaltung.

Neue Grenzen: Konfigurationsvalidierung, verzögertes Laden des Katalogs, zentrale Betriebsfreigabe vor Start und Geräteausgabe, asynchroner Auftragskontext für gemeinsam verwendete serielle Verbindungen, getrennte Modulstatusobjekte und explizite Behandlung fehlerhafter Start-/Stoppvorgänge. Die Host-Fassade begrenzt Datenpunktzugriffe auf die zugewiesenen EOS-Pfade. Ein fehlgeschlagener Transportabschluss wird an den Host zurückgegeben, sodass er keine neue konkurrierende Laufzeit startet.

Behobener Fehler: RTU/ASCII/M-Bus/Kostal-Aufträge konnten nach einem Verbindungsausfall innerhalb eines bereits laufenden Warteschlangenauftrags erneut einen Verbindungsaufbau in dieselbe Warteschlange einstellen und dadurch auf sich selbst warten. Der Aufbau erfolgt vor dem Auftragsblock. Ein lokaler RTU-Test prüft den Wiederaufbau; ein weiterer Test prüft drei Aufträge verschiedener Geräte mit zwischenzeitlich entzogener Freigabe für nur eines der Geräte. Der betroffene Auftrag wird nicht versandt, andere bleiben ausführbar. Die ASCII-Ausgabe wird ebenfalls unmittelbar vor dem Portzugriff geprüft.

Die vorhandene Materialize-Geräteoberfläche wurde vollständig eingebunden. Sie nutzt gleichursprüngliche, vom Host geschützte Konfigurations-/Metadaten-Endpunkte und dessen CSRF-Token, keinen allgemeinen ioBroker-Socketzugriff. Öffentliche Geräte-CA-Zertifikate ersetzen die bisherige TLS-Prüfungsausnahme. Formularfelder und unbekannte gerätespezifische Verbindungsoptionen bleiben beim Bearbeiten erhalten. Speichern wird erst nach vollständigem Laden der Profile und Einstellungen ermöglicht; Katalog- und API-Anfragen besitzen Fristen. Die Rücknavigation führt nach `/system/`, `/installer/` oder `/`.

## Ausgeführte Prüfungen

- `node --test modules/devices/test/*.test.js`: **195 Tests bestanden, 0 Fehler, 0 übersprungen**. Nachweis: `devices-tests.log`.
- `tsc -p modules/devices/tsconfig.hosted.json`: erfolgreich für neue Modulgrenze, Betriebsfreigabe und Auftragskontext mit expliziten Verträgen; der übernommene große Altbestand wurde dadurch nicht vollständig typbereinigt.
- ESLint für neue Modulgrenze, Auftragskontext, Browser-Hostbrücke und neue Tests: erfolgreich. Nachweis: `devices-boundary-lint.log`.
- Syntaxprüfung der geänderten Browserdateien: erfolgreich.
- Unabhängige Codeprüfung des seriellen Auftragskontextes: scoped Weitergabe und endgültige Freigabeprüfung bestätigt.

Die ergänzende HTTP-/CMI-Prüfung und die tatsächlichen lokalen Transport-/Abbruchtests sind in `DEVICES-HTTP-906-001.md` beschrieben.

## Offene Abnahme und bekannte Grenzen

Die vorbereitete Browserprüfung `modules/devices/checks/hostedEditor.check.js` konnte nicht starten: Chromium wurde beim Erzeugen des lokalen IPC-Sockets durch die Umgebung mit `EPERM` beendet. Es wird kein erfolgreicher visueller Browsernachweis behauptet. Ein prüfbarer Ablauf und die erforderlichen Assets liegen bei. Die alte Editor-Basis nutzt die bereits im EOS-Admin enthaltenen Materialize-/jQuery-Assets; eine vollständige Modernisierung dieses Altbestands ist nicht Gegenstand dieser Integration.

Reale Geräte, serielle Schnittstellen, Anlagenregelung und der RAM-Verbrauch auf der Kundenanlage wurden nicht abgenommen. Der konfigurierbare Gerätebetrieb muss zunächst mit einem einzelnen Gerät anhand Einheiten, Vorzeichen, Aktualität, zulässiger Stellgrößen und geräteseitiger Watchdogs geprüft werden. Alte absolute Datenpunktverweise werden beim Import nicht stillschweigend umgebogen; die ausgegebene Zuordnung ist vor Aktivierung in EMS/History/Skripten zu übernehmen. Beim Entzug der Betriebsfreigabe werden auch optionale letzte MQTT-Stellgrößen gesperrt; Timer und Verbindung werden trotzdem geschlossen. Bereits ausgesendete Befehle lassen sich nicht zurückholen.

Dieser Bericht dokumentiert Entwicklung und lokale Prüfungen. Er ist keine CRA-Konformitätserklärung und keine pauschale Anlagen- oder Produktionsfreigabe.
