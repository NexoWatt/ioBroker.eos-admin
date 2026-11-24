# InfluxDB 2: Geheimnisse und Netzwerkgrenze – 9.0.20

Stand: 24.11.2026. Geprüft wurden die neuen typisierten Konfigurations-/Netzwerkhelfer und ihre Anbindung an die bestehenden Konfigurationspfade. Dieser Vermerk ersetzt weder den abschließenden Gesamtbuild noch die Prüfung am echten InfluxDB-Server der Kundenanlage.

## Verhalten und Korrekturen

- Die gesonderte Installer-Historien-API akzeptiert nur die vorgesehenen Felder. Ein leeres Tokenfeld erhält einen vorhandenen Klartextwert nur bei gleicher normalisierter Origin; eine andere Adresse, ein anderer Port oder ein anderes Protokoll erfordert eine ausdrückliche neue Eingabe. URL-Zugangsdaten, Query und Fragment werden abgelehnt.
- Der Laufzeit-Token bleibt im Arbeitsspeicher; Installer-State und Sicherungen erhalten einen verschlüsselten, zweck- und Origin-gebundenen Umschlag. Reguläre Konfigurationsansichten geben weder Klartext noch Umschlag aus. Die öffentliche State-/SSE-Redaktion sperrt Installer-Konfigurationen und entfernt verschachtelte Tokenfelder.
- Eine nicht entschlüsselbare Sicherung behält den wiederherstellbaren Umschlag sowie Geräte, Zuordnungen, Speicherfarm und SmartHome-Konfiguration. Nur die Historie erhält einen Fehlerstatus. Eine ausdrückliche neue Token-Eingabe stellt diese Verbindung wieder her. Schutz gegen eine versehentlich durch einen tiefen Merge geerbte alte Klartextkopie verhindert zusätzlich, dass diese den neuen verschlüsselten Umschlag überschreibt. Der Import-History-Abschnitt muss atomar behandelt werden; die zugehörige Main-Runtime-Korrektur und Endpunkttests werden im Integrationsbericht nachgewiesen.
- HTTP ist ausdrücklich nur für Loopback, RFC1918 und IPv6-ULA vorgesehen. Dies verschlüsselt den Token nicht auf dem lokalen Übertragungsweg. Für andere Ziele ist HTTPS mit Zertifikats-/Hostnamenprüfung erforderlich; eine eigene CA ist bewusst hinterlegbar.
- Unspezifizierte, Link-Local-, Multicast- und bekannte Metadatenziele einschließlich IPv4-Mapped-IPv6 werden abgelehnt. Bei dieser Abschlussprüfung wurden die bekannten AWS-/Google-Metadatenadressen innerhalb ULA zusätzlich gesperrt. Die Prüfung erfolgt im Transport auch auf den tatsächlich aufgelösten Socketadressen; kein bloßes einmaliges Hostnamenvertrauen.
- Keine neue npm-Laufzeitabhängigkeit, kein Root-/Docker-Zugriff, keine Änderung fremder Adapterkonfigurationen oder Administratorrechte.

## Kryptografischer Umfang

Ein Regressionstest führt die unveränderten, aus dem tatsächlich installierten ioBroker-Modul gelesenen Funktionen `encrypt`, `decrypt` und deren Legacy-Helfer mit Node.js `crypto` aus. Die Extraktion umgeht ausschließlich die beim isolierten Import nötige Controller-Verzeichnissuche. Mit synthetischem Standard-Systemsecret aus 24 Bytes beziehungsweise 48 Hexzeichen wurden tatsächliches AES-192-CBC-Format, Entschlüsselung, falscher Schlüssel, ausschließlich auf Historie begrenzte Quarantäne und erneute Wiederherstellung geprüft. Keine Produktivschlüssel oder echten Token wurden verwendet.

Das ist die bestehende ioBroker-Plattformverschlüsselung, **keine AEAD-Verschlüsselung** und kein eigener Kryptografieentwurf. ACLs und der Schutz des ioBroker-Systemsecrets bleiben erforderlich. Die Produktiv-Hardware und ein vollständiger laufender Controller wurden in diesem isolierten Kryptotest nicht emuliert.

## Tatsächliche Prüfungen

| Prüfung | Umgebung | Ergebnis |
| --- | --- | --- |
| 16 Konfigurations-, Geheimnis-, Backup-, Crypto- und Netzwerkfälle | Node.js 24.22.3 | 16 bestanden, 0 fehlgeschlagen, 0 übersprungen |
| Gleiche 16 Fälle | Node.js 22.23.4 | 16 bestanden, 0 fehlgeschlagen, 0 übersprungen |
| Strikte TypeScript-Prüfung `ui/tsconfig.influx-security.json` | installierter TypeScript-Compiler | bestanden |
| Typgestütztes Linting `ui/eslint.influx-security.config.mjs` | installierter ESLint | bestanden |

Befehle, Zeitpunkte und bereinigte Rohlogs liegen in `raw/influx-security/`; `source-sha256.json` bindet diesen Vermerk an die geprüften drei Dateien. Die globale Sicherheitsinventarprüfung erfolgt separat am finalen Gesamtstand. Zwei dynamische Feldzugriffe wurden durch explizite feste Feldprüfungen ersetzt; es wurde keine neue Scanner-Ausnahme hinzugefügt.

## Nachprüfbare Plattformquellen

Die beiden ergänzten IPv6-Metadatenadressen wurden am 24.11.2026 in den offiziellen Anbieterunterlagen verifiziert:

- AWS: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-data-retrieval.html
- Google Cloud: https://docs.cloud.google.com/compute/docs/metadata/querying-metadata

Keine dieser Abfragen verändert die lokale Anlage oder ruft deren InfluxDB auf.
