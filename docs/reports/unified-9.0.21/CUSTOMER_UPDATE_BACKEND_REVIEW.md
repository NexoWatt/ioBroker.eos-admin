# Kunden-Updates: Backendprüfung 9.0.21

Der neue Ablauf erlaubt einem angemeldeten EOS-Kunden nach ausdrücklicher Bestätigung ausschließlich ein Update des Pakets `iobroker.eos-admin`. Er verleiht keine allgemeinen ioBroker-Administrationsrechte. Die getrennte HTTP-Prüfung muss Anmeldung, Passwortwechselpflicht und CSRF prüfen; der Dienst verlangt die aktuelle Autorisierung erneut unmittelbar vor dem Start des Wartungsarbeiters.

## Ablauf und Grenzen

- Die Versionsprüfung verwendet ausschließlich den festen HTTPS-Endpunkt `registry.npmjs.org/iobroker.eos-admin/latest`. Nur eine neuere stabile Version derselben Hauptversion mit passender Node-Version wird vorbereitet. Die Anzeige wird sechs Stunden zwischengespeichert; manuelle Wiederholungen haben eine Mindestpause.
- Vorbereiten lädt Metadaten, offizielle npm-Registry-Schlüssel und das exakt benannte Archiv innerhalb eines gemeinsamen externen Fünf-Sekunden-Budgets. TLS-Prüfung, feste URLs, Weiterleitungsverbot und Größenbegrenzungen gelten auch beim Lesen des Antwortinhalts.
- Die npm-ECDSA-Registry-Signatur bindet Paketname, Version und SHA512-Integrität. Anschließend werden Archivbytes, beide Paketidentitäten (`package.json` und `io-package.json`), Tar-Pfade und Dateihashes geprüft. Das Archiv wird dabei weder entpackt noch ausgeführt. Die lokale Archivprüfung hat ein eigenes Abbruchbudget.
- Eine private, verschlüsselte Sicherung der eigenen Konfiguration wird vor dem Start erstellt. Sie ist eine Konfigurationssicherung, kein vollständiges Systembackup. Änderungen zwischen Vorbereitung und Bestätigung erfordern eine erneute Vorbereitung.
- Erst die ausdrückliche Startaktion erstellt einen dauerhaften Auftrag und startet den festen Wartungsarbeiter. Dieser bleibt absichtlich über den von ihm ausgelösten EOS-Stopp hinweg aktiv. Browserabbruch oder Antwortverlust lösen keine automatische Wiederholung aus.
- Das Wartungsprofil ist zunächst auf Linux, einen nicht privilegierten Systembenutzer, js-controller 7.2.5 und genau eine lokale EOS-Instanz begrenzt. Auch eine weitere deaktivierte EOS-Instanz verhindert diesen Kundenablauf, weil die Paketdateien gemeinsam wären.
- Ein unklarer Ausgang bleibt gesperrt und benötigt die normale Administration beziehungsweise SSH. Nur ein nachgewiesener Fehler vor Installation oder eine vom Arbeiter bestätigte Wiederaufnahme der unveränderten alten Version erlaubt eine neue ausdrückliche Vorbereitung. Es gibt keine automatische erneute Installation oder automatische Wiederherstellung von Einstellungen.
- Nach Neustart reicht ein erfolgreicher Prozess-Exit nicht aus: Die Zielversion muss laufen und vorhandene Konfigurationswerte müssen erhalten sein. Neue Standardfelder sind zulässig; alte Werte und Arrays müssen gleich bleiben. Eine abgeschlossene Prüfung wird dauerhaft markiert, damit spätere bewusste Kundenänderungen nicht als Updateschaden erscheinen.

## Tatsächlich ausgeführte Prüfungen

`test/eos-customer-updates.test.cjs` besteht unter Node **22.23.4** und **24.22.3** aus jeweils **16 erfolgreichen Fällen**. Die Tests prüfen echte kryptographische Signaturen, echte private Dateien und einen lokalen HTTPS-Server mit tatsächlicher TLS-Zertifikatsprüfung. Sie decken unter anderem falsche Identitäten, manipulierte Signaturen und Archive, ungültige Zertifikate, Weiterleitungen, übergroße oder hängende Antworten, Tar/PAX-Grenzen, Dateilesefehler, Abbruch, Einmalstart, Verlust der Startantwort, Neustartbehandlung, Autorisierungsentzug und Konfigurationserhalt ab.

Der vom Dienst erzeugte Auftrag wird im Test vom tatsächlichen Parser des Wartungsarbeiters akzeptiert; Archiv-, Manifest- und Snapshot-Hashes werden dabei gegengeprüft. Die Tests starten keinen echten Installationsprozess. Die separate Controller-Integration ist daher ein eigener Nachweis und wird hier nicht als bereits bestanden vorausgesetzt.

Der strikte TypeScript-Lauf mit `tsconfig.eos-customer-updates.json` und ESLint für Dienst und Transport sind erfolgreich. Zusätzlich akzeptiert die endgültige Archivprüfung das echte ausgelieferte Archiv 9.0.20 mit 2.554 Dateien; die Paket- und Laufzeitidentitäten sind im Rohbeleg dokumentiert.

Die Rohbelege sind in dieser Lieferung enthalten: [Node 22](raw/customer-update-service/service-node22.log), [Node 24](raw/customer-update-service/service-node24.log), [TypeScript](raw/customer-update-service/typecheck.log), [ESLint](raw/customer-update-service/lint.log), [Archivprüfung 9.0.20](raw/customer-update-service/real920-archive-inspection.json) sowie die [Prüfquittung mit Befehlen, Exitcodes und Quellhashes](raw/customer-update-service/service-verification.json). Historische Ausführungspfade in der Quittung dokumentieren die Testumgebung; zum Lesen der Belege wird diese Umgebung nicht benötigt.

## Aussagegrenze zu Herkunft und Sicherheit

Die Signatur bestätigt die Integrität des Pakets im npm-Registry-Vertrauensmodell. Sie ist keine unabhängige Herstellersignatur von NexoWatt. Ein Controller-/npm-Installationslauf kann zusätzliche Abhängigkeiten entsprechend den Paketangaben beziehen; die Root-Archivprüfung allein belegt keine vollständig deterministische oder herstellerunabhängig signierte Abhängigkeitskette. Quellprüfung und Tests ersetzen weder Anlagenabnahme noch CRA-Konformitätsbewertung oder Zertifizierung.

Die bestehenden Sicherheitsquarantänen für unbeaufsichtigte Installationen bleiben bestehen. Dieser Ablauf ist eine getrennte, ausdrücklich vom angemeldeten Benutzer gestartete Wartungsaktion.
