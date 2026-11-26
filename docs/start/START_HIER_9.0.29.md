# NexoWatt EOS 9.0.29 – Einstieg

## Installieren oder aktualisieren

1. Bei einer vorhandenen Anlage Konfiguration und die bisherige TLS-Identität über die dafür vorgesehenen geschützten Sicherungen sichern.
2. Den Adapter `iobroker.eos-admin` in ioBroker aktualisieren. Dabei bei einer vorhandenen Anlage dieselbe Instanz und das vorhandene Datenverzeichnis verwenden.
3. Prüfen, ob EOS und die eingerichteten Module betriebsbereit sind. Ein neues Zertifikat wird erst erstellt, wenn ein Administrator es anfordert.

## HTTPS direkt auf EOS einrichten

1. **Administration → Zertifikate** öffnen, die tatsächlich verwendeten Namen und Adressen wählen und ein Zertifikat lokal erzeugen.
2. Das öffentliche Stammzertifikat zum Installieren als `.cer` herunterladen. Den angezeigten SHA-256-Fingerabdruck vergleichen und das bestätigte Stammzertifikat auf deinem Endgerät installieren. Beide öffentlichen Zertifikate stehen auch als PEM bereit.
3. **Für dieses EOS übernehmen** auswählen. Das erste verwaltete Zertifikat wird nach einem regulären Adapterneustart verwendet.
4. Die Adresse, die im Zertifikat enthalten ist, erneut aufrufen. Bei späteren lokalen Neuausstellungen den neuen Stamm zuerst auf den Endgeräten hinterlegen, solange die bisher vertraute Verbindung noch funktioniert.

Details zu Endgeräten, Trust-Download, Erneuerung und der getrennten Hersteller-Ausstellung findest du im [Zertifikatsleitfaden](../unified/NEXOWATT_TLS_DE.md).

## Git-Übernahme und Prüfung

Verwende den Adapterordner `iobroker.eos-admin` aus der vollständigen ZIP. Nutze für veröffentlichte Installationen den für diese Version vorgesehenen Paketbezug. Ein Link auf npm-Metadaten setzt die dortige Veröffentlichung voraus. Mit `npm pack --dry-run` kannst du den Paketinhalt und die Verpackungsprüfungen prüfen.

Der [Prüfbericht](../reports/unified-9.0.29/PRUEFBERICHT.md) nennt die Nachweise und offenen Punkte.
