# NexoWatt EOS 1.0.22 – Sicherheits-Prüfstand

Stand: 29.09.2026. Aufbauend auf dem hochgeladenen vollständigen Repository 1.0.21.
**Dieser Stand ist nicht für den Produktivbetrieb freigegeben.** Der Dateiname folgt der bestehenden Dokumentstruktur; er bescheinigt keine Stable-Freigabe. Alte NPM_READY-Dateien und frühere Berichte im vollständigen Repository sind historische Nachweise.

## Änderungen und Wirkung

- Strenge serverseitige Installer-/Adminrechte, Sitzungswiderruf und begrenzte Anmelderessourcen. Kundenbedienung verlangt standardmäßig eine Anmeldung.
- Eingabevalidierung, HTML-Ausgabe und SmartHome-URL-Ziele gehärtet. Der Service Worker speichert keine API-Antworten; neue Cachegeneration entfernt alte EOS-Caches.
- Mesh-Kommunikation erhält Replay-/Transporthärtung. Die Protokollversion und Sammelupdate-Voraussetzungen sind im Netzwerkbericht beschrieben.
- Abhängigkeiten anhand konkreter Advisories geprüft: Express/body-parser/qs aktualisiert, React Router gezielt auf 7.18.4 migriert und geprüft, ungenutztes Testpaket entfernt. Audit-Ergebnisse und Grenzen sind dokumentiert.
- Technische CRA-Akte, Befundregister, SBOM, Rohprotokolle und Release-Status ergänzt. Der npm-Upload durchläuft die technischen Paketprüfungen. Die dokumentierte Produktivfreigabe wird mit `npm run release:production-check` gesondert geprüft; ihr offener Status blockiert den normalen npm-Upload nicht.

## Korrektur des Uploadablaufs zum Prüfstand 29.09.2026

Die zunächst eingefügte Verknüpfung von `prepublishOnly` mit `release:approval`
wurde aufgehoben. `npm publish` und `PUBLISH_NPM.cmd` benötigen weiterhin die
technischen Prüfungen des unveränderten Pakets. `release:production-check` führt
ausdrücklich `release:approval` und anschließend `release:check` aus.
`productionApproved` bleibt `false`; eine Produkt-/Serienfreigabe wird durch
einen erfolgreichen Upload nicht eingetragen.

Der Nutzer hat Tests auf seinem eigenen Livesystem ausdrücklich vorgesehen.
Die offene allgemeine Produktivfreigabe ist keine zusätzliche technische Sperre
dieses Testablaufs. Ergebnisse solcher Eigentests liegen mit diesem Vermerk noch
nicht vor. Änderungen am Upload-/SBOM-Ablauf und deren Nachweise stehen im
[ergänzenden Prüfbericht](reports/cra-2026-09-29/NPM_UPLOAD_SBOM_KORREKTUR_DE.md).

## Vor dem Testupdate

1. Vollständige ioBroker-Konfiguration, Zustände, EOS-Einstellungen, Geheimnisdateien und Betriebssystem sichern. Für einen Wiederherstellungstest wird eine getrennte Instanz empfohlen; der ausdrücklich gewünschte Test auf dem eigenen Livesystem bleibt möglich.
2. Vorhandene Administratoranmeldung und lokalen Konsolenzugriff prüfen. Bestehende explizite Legacy-Bedienfreigaben bewerten und auf Anmeldung umstellen. Technische Konfiguration bleibt unabhängig davon rollenpflichtig.
3. HTTP-Port 8188 nur in einem kontrollierten Segment bereitstellen. Für vertrauliche Sitzungen geprüften TLS-Zugang und Backend-Firewall einrichten. Direktes Internet-Portforwarding ist kein unterstütztes Sicherheitsprofil.
4. Mesh-Knoten nur geplant gemeinsam auf das neue Protokoll aktualisieren. Offline-/Rückfallverhalten und lokale Netzanschlussgrenzen vor Sollwertfreigabe prüfen. Details: [Netzwerkprüfung](security/network-review-de.md).
5. Adapter neu starten, alte Browser-Tabs schließen und neu laden. Alte Sitzungen müssen erneut angemeldet werden. Keine Anlagenfreigabe aus erfolgreichen Mocktests ableiten.

## Prüfung und Rückfall

[Prüfbericht und Rohbelege](reports/cra-2026-09-29/PRUEFBERICHT_DE.md), [Befundregister](security/BEFUNDREGISTER_DE.md), [CRA-Akte](cra/README.md), maschinenlesbarer Status: `release-manifests/release-status.json`.

Keine echte Feldanlage, kein WAGO-Gerät/Raspberry-Pi-Image und kein kompletter ioBroker-Host wurden in dieser Arbeitsumgebung geprüft. Im Störungsfall auf den gesicherten vorherigen Gesamtstand zurückgehen; die dort dokumentierten Schwachstellen sind dann wieder vorhanden. Nicht nur einzelne JS-Dateien oder einzelne Mesh-Peers zurückkopieren. Ein Restore-/Rollback-Nachweis steht aus.

`npm run test:all`, `npm run build:ts`, `npm run publish:check` und Paket-Smoke prüfen unterschiedliche Aspekte. Der separat aufgerufene `npm run release:approval` bzw. `npm run release:production-check` meldet bei diesem Prüfstand weiterhin die fehlende Produktivfreigabe mit Exit 1. Diese Prüfung gehört nicht zur normalen `prepublishOnly`-Kette; technische Paket- und Geheimnisfehler verhindern den Upload weiterhin.

## Ergänzende Vorgaben: externe Abrufe und Geheimnisse

Wetter-/PV- und Tarifabrufe erhalten ein gemeinsames Netzwerkbudget von höchstens
5.000 ms einschließlich zugehöriger Authentifizierung, Geocoding und Fallbacks.
Der Transport bricht aktiv ab; vollständige typgeprüfte Daten müssen vor fachlichen
State-Schreibvorgängen vorliegen. Fehlercodes enthalten keine Tokens oder Anbieterantworten.
Die tatsächliche Zeitgenauigkeit unter Last auf dem Raspberry Pi 5 bleibt ein Gerätetest.

Der fest eingebaute Lizenz-HMAC-Wert wurde aus der öffentlichen Laufzeit und ihren
Quell-/Typisierungsspiegeln entfernt. **Vor dem Adapterupdate** die separat gelieferte
private Serverkonfiguration nach `INSTALLATION_DE.txt` einrichten und die Dienstumgebung
im geplanten Wartungsfenster übernehmen. Der Upload selbst benötigt diesen Wert nicht.
Ohne `NEXOWATT_LICENSE_HMAC_SECRET` verweigert das bestehende Lizenz-Gate die Prüfung;
es gibt keinen eingebauten Rückfall. Die private Datei niemals in das Repository
oder ein npm-Paket kopieren. Der alte Wert bleibt potenziell offengelegt; Rotation
und Umstellung des privaten Lizenzgenerators müssen koordiniert erfolgen.

Adapter-Konfigurations- und Backup-States mit Dienstgeheimnissen erhalten gezielte
Admin-ACLs. Die [Entwicklungsleitlinie](ENTWICKLUNGSLEITLINIE_SICHERHEIT_DE.md) gilt
auch für weitere Adapter. [Abschließender Nachtrag und Prüfbelege](reports/cra-2026-09-29/FINALER_NACHTRAG_DE.md).
