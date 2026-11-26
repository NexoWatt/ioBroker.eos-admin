# NexoWatt EOS 9.0.31 – Einstieg

## Aktualisieren und auf dem iPhone prüfen

1. Die bestehende Konfiguration über die vorgesehene Sicherungsfunktion sichern und `iobroker.eos-admin` in derselben Instanz aktualisieren.
2. Die EOS-Startseite in Apple Safari über die gewohnte HTTPS-Adresse öffnen. Bei Bedarf anmelden. Der Pfad `/apple-touch-icon-eos-v2.png` an dieser Adresse dient als direkter Abrufcheck für das neue NexoWatt-Symbol.
3. Von der EOS-Startseite aus **Teilen → Zu Home-Bildschirm hinzufügen** wählen und **Als Web-App öffnen** eingeschaltet lassen. Die Vorschau sollte das NexoWatt-Symbol und die EOS-Startadresse zeigen. Sobald die Vorschau stimmt, kann eine frühere Verknüpfung ersetzt werden. [Apple-Anleitung](https://support.apple.com/de-ch/guide/iphone/iphea86e5236/26/ios/26)
4. Wenn die Vorschau wieder ein „N“ anzeigt, die iOS-Version und das Ergebnis des direkten Bildabrufs erfassen. Ein Test über eine weitere bereits vertrauenswürdige EOS-Adresse mit demselben Adapterstand hilft, Adress- von Installationsproblemen einzugrenzen.

Die vorhandene Vertrauenskonfiguration gilt weiter. Bei einem Rückfall die gesicherte Konfiguration und den vorherigen Paketstand in derselben Instanz wiederherstellen.

## Git und npm

Den vollständigen Ordner `iobroker.eos-admin` aus der ZIP übernehmen. `npm pack --dry-run` prüft den Paketinhalt und die Paketregeln lokal. Der [ioBroker-Repository-Eintrag](../../nexowatt-eos-admin-repository-entry-v9-0-31.json) verweist auf die Paketversion und setzt deren npm-Veröffentlichung voraus.

[Prüfbericht](../reports/unified-9.0.31/PRUEFBERICHT.md) · [Zertifikatsleitfaden](../unified/NEXOWATT_TLS_DE.md)
