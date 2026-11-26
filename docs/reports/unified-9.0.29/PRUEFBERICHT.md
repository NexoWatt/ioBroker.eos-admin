# EOS 9.0.29 – Lokale Ausstellung eines HTTPS-Gerätezertifikats

**Ausgangspunkt** · EOS 9.0.28 mit Zertifikatsanfrage im Adapter und getrenntem Hersteller-Aussteller.

Die EOS-Administration bietet jetzt einen zweiten Weg zur Ausstellung. Ein Administrator kann einen Entwurf erzeugen, beide öffentlichen PEM-Dateien und das Stammzertifikat auch als `.cer` herunterladen und den angezeigten SHA-256-Fingerabdruck prüfen. Die Übernahme gilt erst nach einer eigenen Bestätigung. Ein bereits bestehendes Zertifikat bleibt bis dahin nutzbar. Die Hersteller-Ausstellung und der Import externer Zertifikate bleiben verfügbar.

## Maßgebliche Prüfungen

| Bereich | Sollverhalten |
| --- | --- |
| Rechte und Sitzungen | Nur zugelassene Administratoren laden den Entwurf herunter oder ändern ihn. Schreibaktionen prüfen den Ursprung und den Sitzungsnachweis. |
| Namen | Die lokale Ausstellung akzeptiert nur Namen und Adressen der EOS-Instanz. Abweichende Angaben und Wildcards werden verworfen. |
| Schlüssel und Ausgabe | Die öffentlichen PEM-Downloads, das DER-Stammzertifikat (`.cer`) und der SHA-256-Fingerabdruck gehören zur gleichen Entwurfskennung. Der private Geräteschlüssel bleibt in der Instanz. Der pro Ausstellung erzeugte CA-Signierschlüssel wird nach dem Vorgang nicht aufbewahrt. |
| Erzeugen und Übernehmen | Erzeugen ändert die aktive Identität nicht. Übernahme prüft Entwurfskennung, bestätigten Fingerabdruck, Geräteschlüssel, Namen, Laufzeiten und Zertifikatskette. Unpassende oder bereits verbrauchte Kennungen werden abgelehnt. |
| Rotation und Fehler | Ein neuer Entwurf hat einen anderen lokalen Stamm. Abruf vor Übernahme dient dem kontrollierten Trust-Import auf den Endgeräten. In Konflikt- und Speicherfehlerfällen bleibt der bisherige Zugang überprüfbar. |
| Bestehender Import | Hersteller-CA, Zertifikatsanfragen und externe Übernahme bleiben in ihrem bisherigen Ablauf nutzbar. Erstaktivierung nach regulärem Neustart, laufender Kontextwechsel bei bereits verwalteter Identität. |

## Ergebnisse und Nachweise

| Prüfung | Ergebnis |
| --- | --- |
| Vollständiges `npm test` unter Node.js 22 | v22.23.4, 2730 erfasst, 2728 bestanden, 2 ausgelassen |
| Vollständiges `npm test` unter Node.js 24 | v24.22.3, 2730 erfasst, 2728 bestanden, 2 ausgelassen |
| Typprüfung, Lint und Builds | Bestanden |
| Gezielte Zertifikatsprüfungen | Je 20 bestanden unter Node.js 24 im Quellstand und unter Node.js 22 im erzeugten Laufzeitstand |
| HTTPS mit lokaler Ausstellung | Erfolgreicher Verbindungsaufbau über Gerätename und IP mit dem neuen Vertrauensanker nach erneutem Start des HTTPS-Servers |
| Audit der Laufzeitabhängigkeiten | Zwei bereits bekannte moderate Meldungen im OCPP-Abhängigkeitsbaum. Keine Meldungen der Stufen hoch oder kritisch. |
| Import des Vertrauensankers auf echten Endgeräten | Offen |

Die Prüfungen liefen unter Linux mit OpenSSL 3.5.9, synthetischen Zertifikaten und temporären Datenverzeichnissen. Zwei umgebungsabhängige Tests wurden in beiden Gesamtläufen ausgelassen, weil `nginx` und `setfacl` fehlten. Der [Anwenderablauf](../../unified/NEXOWATT_TLS_DE.md) beschreibt den Vertrauenswechsel auf Endgeräten. Der Praxistest auf Raspberry Pi und iPhone ist offen.
