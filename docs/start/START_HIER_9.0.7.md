# NexoWatt EOS 9.0.7 – Update und Einrichtung

Diese Lieferung aktualisiert die vorhandene Instanz **eos-admin.0**. EOS Admin,
Dashboard, Geräte, EEBus und Sicherung nutzen die zentrale EOS-Systemlizenz.
Eine zweite Aktivierung im Dashboard oder Gerätemodul ist nicht erforderlich.
NexoWatt-Anteile bleiben proprietär; bestehende Fremdlizenzen bleiben erhalten.

## Update auf die bestehende Anlage

1. Vor dem Update die laufende Installation einschließlich Instanz-Datenverzeichnissen
   und ihrer privaten Geräteidentitäten sichern. Einen verwendbaren Rückfallstand behalten.
2. Das Paket `iobroker.eos-admin-9.0.7.tgz` über den ioBroker-Installationsweg in die
   bestehende Instanz übernehmen. Keine Neuinstallation von ioBroker und keine neue
   EOS-Instanz anlegen. Das Update benötigt einen kontrollierten Neustart; die
   unabhängigen Schutzfunktionen der Anlage müssen währenddessen wirksam bleiben.
3. Für Git die Dateien aus dem ZIP-Ordner `iobroker.eos-admin` in die Repositorywurzel
   übernehmen. Erst dein Upload stellt diesen Stand über Git bereit. Die Lieferung
   wurde nicht auf GitHub oder npm veröffentlicht. npm-Prüfkanal ist `next`.
4. Version **9.0.7**, `LICENSE_VALID` und `EOS_HTTPS_READY` prüfen.
   Vorhandener ioBroker Admin bleibt auf 8081, EOS auf HTTPS 8188.
5. In **Administration → Übernahme** das Ergebnis der Bestandsprüfung ansehen.
   Danach Geräte, Messwerte, History, Anmeldung und Regelung gezielt prüfen.

Direkter Einstieg: **https://192.168.10.153:8188/**

## Speichern und Oberfläche

Geräteeinstellungen werden verschlüsselt in einem getrennten Konfigurationsobjekt
abgelegt. Das Speichern verändert nicht mehr das eigene ioBroker-Instanzobjekt und
löst dadurch keinen Controller-Neustart mit anschließendem Sitzungsverlust aus.
Echte abgelaufene Sitzungen verlangen weiter eine Anmeldung; der Editor erhält den
Entwurf, wiederholt aber keinen Schreibvorgang automatisch.

Geräte und EEBus verwenden das gemeinsame EOS-Logo, dunkle Farben, responsive
Formulare und die gleichen Navigationswege. Der Installer enthält den Rückweg zur
Administration. Die Verwaltungsreiter umbrechen auf zusätzliche Zeilen.

## Bestehende Einzeladapter übernehmen

Die automatische Übernahme ist standardmäßig aktiviert. Sie kann in den
Instanzeinstellungen vor einem geplanten Start ausgeschaltet werden.

Der geprüfte Quellumfang umfasst NexoWatt UI 1.0.35–1.0.38, Devices 0.5.176,
EEBus 0.3.0 und NexoWatt Backup 1.0.10 auf demselben Host. Eine erfolgreiche
Übernahme bewahrt Einstellungen, ursprüngliche Datenpunkt-Namespaces, Zuordnungen
und verfügbare Geräteidentitäten. Die zentrale EOS-Lizenz bleibt maßgeblich.
Die alten Konfigurationen und Datenpunkte werden nicht gelöscht.

Vor dem Anhalten einer Altinstanz prüft EOS alle Kandidaten gemeinsam. Mehrdeutige
Instanzen, nicht lesbare geschützte Geheimnisse, nicht unterstützte Betriebsarten,
Versionskonflikte oder nicht sicher übernehmbare Abhängigkeiten blockieren die
Übernahme. Dann bleibt der Altbestand unverändert; die Statusseite nennt den Grund.
Insbesondere darf ein verborgenes EEBus-Identitätsschlüsselfeld nicht durch eine
neue Identität ersetzt und als 1:1-Übernahme ausgegeben werden.

Die Übergabe verwendet ein verschlüsseltes Journal und bestätigte Stop-/Startzustände.
Ist nach einem Fehler nicht sicher, welche Laufzeit noch schreibt, bleibt die neue
Schreibfreigabe gesperrt. Niemals alte und neue Laufzeit gleichzeitig auf dieselben
Geräte schreiben lassen. Die jeweilige Anlage einschließlich externer Skripte und
Nachrichtenintegrationen muss vor dem Kundeneinsatz abgenommen werden.

## Sicherung

Unter **Administration → Sicherung** steht das integrierte NexoWatt-Backup bereit.
Es benötigt für die unterstützten Funktionen keinen separaten ioBroker-Backitup-
Adapter. Der ioBroker-Controller bleibt die Grundlage der Systemsicherung.

**Den Wiederherstellungsschlüssel einmal herunterladen und getrennt vom Gerät
sicher aufbewahren.** Ohne ihn lassen sich die verschlüsselten Sicherungen nach
Geräteverlust nicht öffnen. Er ist kein Lizenzschlüssel.

Zeitplan, lokale Ziele, SD/NAS und konfigurierte externe Speicherziele werden
im Modul verwaltet. Sicherungskompression und große Übertragungen laufen nur bei
Bedarf in einem eigenen Arbeitsprozess. Die vollständige Funktionsmatrix,
Voraussetzungen und Wiederherstellung stehen in [modules/backup/README.md](../../modules/backup/README.md).

Eine komplette Wiederherstellung erfolgt im Wartungsfenster bei gestopptem
Controller. Das enthaltene Werkzeug prüft und entschlüsselt Archive zunächst in
eine neue Ablage; es überschreibt nicht aus dem laufenden EMS die Installation.
Vor Kundeneinsatz eine Wiederherstellung auf einem separaten Testgerät durchführen.

## Eigene NexoWatt-Zertifikate

Unter **Administration → Zertifikate**:

1. Die tatsächlich verwendeten Namen und festen IP-Adressen eintragen und eine
   Zertifikatsanfrage erzeugen. Der private Geräteschlüssel bleibt auf dem EOS.
2. Auf dem getrennten Herstellerrechner mit `tools/eos-tls-issuer.cjs` eine
   NexoWatt-CA einrichten und die Anfrage signieren. Der private CA-Schlüssel
   gehört niemals in das Repository oder auf Kundengeräte.
3. Gerätezertifikat, öffentliches Stammzertifikat und unabhängig geprüften
   CA-Fingerabdruck im EOS importieren.
4. Die erste Umstellung wird beim nächsten geplanten Adapterneustart wirksam.
   Spätere Erneuerungen verwalteter Zertifikate können ohne Neustart erfolgen.
5. Auf jedem Bediengerät einmal dem öffentlichen NexoWatt-Stammzertifikat
   kontrolliert vertrauen. Erst dadurch akzeptiert der Browser die private CA.
   Bei iPhone/iPad ist nach manuellem Import zusätzlich das volle Vertrauen zu aktivieren.

Ausführliche Befehle und Windows-Hinweise:
[docs/unified/NEXOWATT_TLS_DE.md](../unified/NEXOWATT_TLS_DE.md).
Die Lieferung enthält Werkzeuge, keine produktiven Hersteller-Privatschlüssel.

## Zugang ohne Netzwerkscan

EOS kündigt standardmäßig **nexowatt.local** im lokalen Netz an:
**https://nexowatt.local:8188/**. Client und Netzwerk müssen mDNS zulassen.
Für mehrere Geräte eindeutige Namen vergeben und passende Zertifikate ausstellen.

**https://nexowatt/** benötigt zusätzlich die Kurznamensauflösung im Kundennetz und
HTTPS auf Port 443. Das Zertifikat allein richtet beides nicht ein.
Die vorbereitete systemseitige 443-Weiterleitung und Prüfungen stehen in
[deploy/NEXOWATT_LOCAL_HTTPS.md](../../deploy/NEXOWATT_LOCAL_HTTPS.md).
Das Adapterupdate installiert keinen Betriebssystemdienst und verleiht keine Rootrechte.

Ohne gültige Sitzung erscheint die Anmeldung; mit gültiger Sitzung das Dashboard,
sobald Erstpasswortwechsel und Lizenzaktivierung abgeschlossen sind. Beim Wechsel
zwischen IP und Namen einmal unter dem gewünschten Namen anmelden.

## RAM und Abnahme

Abgelaufene History- und Erkennungsdaten werden jetzt auch im Leerlauf freigegeben;
gleichzeitige Erkennungsanfragen teilen einen Objektabruf. EMS-Taktzeiten, Messwerte
und fachliche Regelung bleiben erhalten. Ein isolierter Test mit 25.000 Objekten
hielt danach rund **46,9 MiB weniger Heap** fest. Das ist keine Messung der gesamten
Anlage und keine zugesagte Verringerung der gemeldeten rund 630 MB RSS.

Gleiche Anlage und Browserlast vor/nach dem Update vergleichen: nach zehn Minuten
RSS/Heap/CPU prüfen, History und Geräteerkennung benutzen, nach mindestens einer
Minute erneut messen. Gerätekommunikation und Reglerreaktion parallel beobachten.

Diese Version ist eine automatisiert geprüfte **Integrationstestlieferung**.
Konkrete Ergebnisse und offene Hardware-, Browser-, Speicherziel- und
Wiederherstellungsprüfungen stehen im
[Prüfbericht](../reports/unified-9.0.7/PRUEFBERICHT.md).
Sie ist keine pauschale Serienfreigabe oder CRA-Konformitätserklärung.
