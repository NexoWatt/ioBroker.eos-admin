# NexoWatt EOS 9.0.6 – Geräte, EEBus und lokaler Zugang

Diese Version aktualisiert die vorhandene Instanz **eos-admin.0**. EOS Admin,
Dashboard, Gerätemodul und EEBus gehören zu einem Adapter und verwenden die
zentrale EOS-Systemlizenz. Eine zweite Lizenz im UI oder in den eingebetteten
Modulen ist nicht nötig. Bestehende ältere Lizenzen werden nur im ursprünglich
signierten Umfang anerkannt. NexoWatt-Anteile bleiben proprietär.

## Aktualisieren

1. Vollständiges ioBroker-Backup einschließlich EOS-Instanzdaten erstellen.
   Lizenzspeicher `storage.key` und `license.enc` gemeinsam sichern; öffentliche
   Prüfschlüssel, Gerätekonfiguration und bestehende Pairing-Informationen schützen.
2. Das Paket `iobroker.eos-admin-9.0.6.tgz` über den ioBroker-Installationsweg in
   die vorhandene Instanz übernehmen. Keine neue Instanz und keine Neuinstallation
   von ioBroker anlegen. Während des Updates ist die enthaltene Regelung gestoppt;
   die unabhängigen Schutzfunktionen der Anlage müssen wirksam bleiben.
3. Bei Git die Dateien im ZIP-Ordner `iobroker.eos-admin` in die Repositorywurzel
   übernehmen. Erst nach deinem Upload ist genau dieser Stand über Git verfügbar.
   Diese Lieferung wurde nicht automatisch auf GitHub oder npm veröffentlicht.
   Bei npm bleibt der Prüfkanal `next` vorgesehen.
4. Version 9.0.6, `LICENSE_VALID` und `EOS_HTTPS_READY` kontrollieren.
   Vorhandener ioBroker Admin bleibt auf 8081; EOS bleibt auf HTTPS 8188.

Direkter Einstieg: **https://192.168.10.153:8188/**

## Admin, Installer und Navigation

Im Installer gibt es den Rückweg zur EOS-Administration für Administratoren und
zum Dashboard. Die markierte Admin-Leiste ist in zwei Bereiche aufgeteilt:
oben die Hauptnavigation, darunter die umbrochenen Verwaltungs- und Modulreiter.
Auf schmalen Bildschirmen sind weitere Zeilen möglich. Geräte und EEBus haben
richtige Einträge und Konfigurationsseiten, keine Platzhalter.

## Geräte und EEBus übernehmen

Beide Module sind enthalten, zunächst aber deaktiviert. Bestehende einzelne
Adapter laufen deshalb nach dem Update nicht ungefragt als zweite Geräteinstanz
im EOS weiter.

1. Die bisherige `nexowatt-devices.N` beziehungsweise `eebus.N`-Instanz sichern,
   deaktivieren und ihren vollständigen Stopp abwarten.
2. In EOS **System → Geräte** beziehungsweise **EEBus** öffnen und die alte
   Instanz über die angebotene Importfunktion übernehmen. Import bedeutet noch
   keine Aktivierung. Bei laufender, aktivierter oder nicht sicher gestoppter
   Altinstanz blockiert EOS die Übergabe.
3. Die übernommenen Geräteparameter prüfen. Neue Geräte-Datenpunkte liegen unter
   `eos-admin.0.devices`, EEBus-Daten unter `eos-admin.0.eebus`. Alte Datenpunkte
   bleiben erhalten. Bestehende EOS-Zuordnungen auf die neuen Datenpunkte prüfen
   und bewusst umstellen; es findet keine ungeprüfte globale Umschreibung statt.
4. EEBus-Geräte nach dem Import neu koppeln und Zertifikat-Fingerabdruck/SKI an
   der Gegenstelle vergleichen. Private Identitätsschlüssel und alte Freigaben
   werden nicht automatisch in einen neuen Vertrauenskontext übernommen.
5. Zunächst Diagnose/Testmodus und Messwerte prüfen, anschließend gezielt die
   benötigten Schreibfunktionen freigeben. EEBus-CLS-Übernahme benötigt sowohl
   die entsprechende Option als auch abgeschalteten Testmodus. Die konkrete
   Gegenstelle muss separat in Betrieb genommen werden.

HTTPS-Geräte mit eigener CA benötigen deren **öffentlichen** CA-Inhalt im
Geräteprofil. Eine abgeschaltete Zertifikatsprüfung wird nicht übernommen.
Keine privaten Schlüssel oder Passwörter im Chat/Repository hinterlegen.

## Gerät ohne Netzwerkscan finden

EOS kündigt standardmäßig **nexowatt.local** im lokalen Netz an:

**https://nexowatt.local:8188/**

Dafür benötigt das Gerät keinen Routereintrag. Client und Netzwerk müssen mDNS
zulassen. Bei einem Namenskonflikt stoppt nur die Ankündigung; der IP-Zugang
bleibt bestehen. Mehrere EOS-Geräte bekommen unterschiedliche Namen.

Für **https://nexowatt.local/** ohne Port ist einmalig die vorbereitete
systemseitige Weiterleitung von 443 nach 8188 erforderlich. Die Dateien und
konkreten Prüf-/Einrichtungsschritte liegen in
[deploy/NEXOWATT_LOCAL_HTTPS.md](deploy/NEXOWATT_LOCAL_HTTPS.md) und
[deploy/systemd/README.md](deploy/systemd/README.md).
Das Adapterupdate allein installiert keinen Betriebssystemdienst.
Das Zertifikat muss den gewählten Namen enthalten und auf dem Bediengerät
vertrauenswürdig sein. Eine vorhandene IP-Sitzung gilt nicht automatisch für den
neuen Namen; dort einmal anmelden, danach denselben Namen weiterverwenden.

Der kurze Name **https://nexowatt/** hängt zusätzlich von der Kurznamensauflösung
des jeweiligen Netzes/Betriebssystems ab. Der vom Gerät selbst angekündigte
standardisierte lokale Name lautet **nexowatt.local**.

Ohne gültige Sitzung erscheint die Anmeldung. Mit gültiger Sitzung geht der
Einstieg ins Dashboard, sobald Erstpasswortwechsel und zentrale Aktivierung
abgeschlossen sind. Login- und Zugriffsschutz bleiben auch über 443 wirksam.

## Abnahme und Rückfall

Nach dem Update History, Livewerte, Installer-Rückweg, Admin-Navigation und
Abmeldung prüfen. Anschließend kontrollierter Neustart und erneute Anmeldung.
RAM/CPU unter derselben Geräte- und Datenlast wie vorher über mindestens
30 Minuten beobachten; eine feste Ersparnis gegenüber den genannten 750 MB
ist noch nicht am Zielgerät gemessen.

Bei Modulproblemen das betroffene integrierte Modul deaktivieren, seinen Stopp
bestätigen und erst dann den gesicherten Altadapter reaktivieren. Niemals beide
Instanzen gleichzeitig auf dieselben Geräte schreiben lassen. Alte Konfiguration
und Datenpunkte nicht zur Fehlerbehebung löschen.

Dieser Stand ist eine **Integrationstestlieferung**, keine pauschale Serienfreigabe
oder CRA-Konformitätserklärung. Der [Prüfbericht](docs/reports/unified-9.0.6/PRUEFBERICHT.md)
unterscheidet ausgeführte Softwaretests und offene Geräte-/Netzwerkabnahme.
