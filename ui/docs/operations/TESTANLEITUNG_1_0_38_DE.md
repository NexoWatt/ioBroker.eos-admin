# NexoWatt EOS 1.0.38 – HTTPS und installierte Web-App testen

Stand: 22.11.2026. Diese Anleitung ergänzt die Anleitung zu 1.0.37. Der
Lieferstand ist ein vollständiges Repository zum Testen. Es wurde keine
Kundenanlage geändert und keine Veröffentlichung vorgenommen.

## 1. Vorhandenen Zugang festhalten

Vor dem Update Adapterversion, Konfiguration und die tatsächlich verwendete
Web-App-Adresse sichern. Hostname/IP, Protokoll, Port und gegebenenfalls
Proxy-Unterpfad gehören gemeinsam zum Zugang. Das Update ändert sie nicht
automatisch. Gerätezuordnungen, Smarthome-Konfiguration, Szenen und EMS-
Regelparameter werden von diesem Nachtrag nicht migriert.

Den vollständigen Repositoryinhalt über das übliche Installationsverfahren
übernehmen und die Instanz neu starten. Bei manuellem Überkopieren auf ein
altes Repository sichert die bestehende Release-Vorbereitung veraltete
Admin-Bundles außerhalb des Repositories; die Prüfungen kontrollieren sowohl
frisches Entpacken als auch diesen Überlagerungsfall.

## 2. Direkter HTTPS-Zugang mit IP und Port

Der alte eingebaute Listener sprach ausschließlich HTTP. Der HTTPS-Zugang
war damit auf einen vorgeschalteten sicheren Zugang angewiesen. Ab 1.0.38:

1. In der Instanzkonfiguration unter **Allgemein** den vorhandenen **Web-Port**
   und die passende **IP-Adresse / Bind-Adresse** prüfen.
2. **Direktes HTTPS für die Web-App aktivieren** einschalten.
3. Ein eigenes **öffentliches Serverzertifikat** und den dazugehörigen
   **privaten Schlüssel** aus der zentralen Zertifikatverwaltung auswählen.
   Bei einer aus mehreren Zertifikaten bestehenden Kette auch die
   **Zertifikatskette** auswählen. Der private Schlüssel wird hier nicht als
   Klartext eingegeben oder im Repository gespeichert.
4. Speichern und Instanz neu starten. Anschließend
   `https://<IP-ODER-HOSTNAME>:<WEB-PORT>/` öffnen.
5. Im Protokoll muss der Start des HTTPS-Listeners am eingestellten Port
   erkennbar sein. Bei einem Zertifikatsfehler bleibt der Listener geschlossen;
   es wird kein unverschlüsselter Ersatz gestartet.

Ein solcher geprüfter TLS-Konfigurationsfehler blockiert die Weboberfläche;
die bestehende autonome EMS-/SmartHome-Initialisierung läuft weiter. Der
Webverbindungsstatus bleibt dabei offline. Dies ersetzt keine Diagnose
anderer Start-/Anlagenfehler.

Beispiel für das Format: `https://192.0.2.10:8188/`. Diese Adresse ist ein
Dokumentationsbeispiel und gehört nicht zu einer Kundenanlage. Bei IPv6
steht die Adresse in eckigen Klammern, etwa `https://[2001:db8::10]:8188/`.

Für eine IP-Adresse benötigt das Zertifikat einen passenden IP-Eintrag im
Subject Alternative Name; bei einem Hostnamen einen passenden DNS-Eintrag.
Für eine zuverlässig installierbare Web-App muss das Endgerät der verwendeten
Zertifikatskette vertrauen. Ein eigener CA-Aussteller wird auf den verwalteten
Endgeräten entsprechend eingerichtet. Eine im Browser weggeklickte
Zertifikatswarnung ist kein belastbarer Web-App-/Service-Worker-Test.

Nach Zertifikatswechsel oder -erneuerung die Instanz kontrolliert neu starten;
die Zertifikate werden bei jedem Listenerstart neu geladen. Das Paket erzeugt
keine gemeinsamen Standardschlüssel und richtet keine automatische ACME-
Erneuerung ein.

## 3. Bestehender HTTPS-Proxy und getrennte Anmeldeprofile

Wenn der bisherige sichere Zugang bereits über den EOS-Admin oder einen
Reverse-Proxy funktioniert, bleibt dessen Adresse maßgeblich. Der interne
HTTP-Port kann weiter als Proxyziel betrieben werden. Direktes HTTPS ist
optional; bei seiner Aktivierung muss auch ein direkt auf diesen Port
verweisender Proxy das richtige Backendprotokoll verwenden.

Das eigenständige Profil prüft weiterhin das vorhandene Benutzerkonto und
erstellt eine eigene UI-Sitzung. Das integrierte EOS-Profil verwendet
ausschließlich die konfigurierte zentrale Sitzungsprüfung. Ein fehlerhaftes
Profil wechselt nicht in einen anderen Login. Benutzer erhalten ihre
freigegebene Bedienoberfläche; Installer/Admin ihre erlaubten Einrichtungen.
Direkte Unterseiten bleiben serverseitig geschützt. Es werden keine
Passwörter, Konten oder Geräteberechtigungen automatisch geändert.

## 4. Installierte Web-App, Logo und Aktualisierung

Die bestehende App heißt weiterhin **NexoWatt EOS**. Manifest-Start-URL,
Scope, Darstellung als eigenständige App und vorhandene Homescreen-Icons
bleiben identisch. Auf der Anmeldung wird das gelieferte Original-EOS-Logo
verwendet. Die App-Metadaten und Icons sind auch vor der Anmeldung verfügbar.

Die geschützten Bedienseiten laden die gemeinsame Sitzungsprüfung vor ihrer
Anwendungslogik. Dadurch erhalten bestehende eigene Bedienbefehle nach
bestätigter Anmeldung automatisch den erforderlichen CSRF-Header. Die
Serverprüfung bleibt aktiv; Maschinen-/Stationsdisplay-Zugänge werden nicht
auf eine interaktive Benutzeranmeldung umgestellt.

Am unveränderten Zugang die Web-App schließen und wieder öffnen. Der
öffentliche Update-Bootstrap prüft den Service Worker auch auf der
Anmeldeseite. Bei Wiederöffnung, Sichtbarwerden oder wiederhergestellter
Verbindung werden Updates zusammengefasst geprüft. Im Admin-Proxy und in
eingebetteten Frames wird kein Worker für den übergeordneten Admin installiert.

Auf dem Testgerät prüfen:

- Start vom Homescreen bleibt in der NexoWatt-Web-App; App-Icon und Name sind
  korrekt. Das Original-EOS-Logo erscheint auf der Anmeldung.
- Ohne Sitzung erscheint die Anmeldung. Nach Anmeldung führt der Rücksprung
  auf die zulässige Start-/Zielseite desselben Zugangs; kein Port-8081-Sprung.
- LIVE, History, Smarthome, Detailbedienung und bestehende Gerätezustände laden
  mit einer gültigen Sitzung. Bedienungen müssen durch reale Rückmeldungen
  bestätigt werden; die lokale Softwareprüfung ersetzt keine Geräteprüfung.
- Abmelden und erneut vom Homescreen öffnen: geschützte Inhalte bleiben
  gesperrt, bis erneut eine Sitzung bestätigt ist.
- Verbindung unterbrechen und wiederherstellen: die gebrandete
  Verbindungsansicht ermöglicht erneutes Laden. Private Seiten, Messwerte,
  Konfiguration und APIs werden nicht aus einem alten Offlinecache geöffnet.

Wechselt tatsächlich Protokoll, Hostname/IP, Port oder Proxy-Unterpfad, zeigt
eine vorhandene Homescreen-Verknüpfung weiterhin auf ihren alten Zugang.
Dann die neue sichere Adresse im Browser öffnen und diese Verknüpfung
entsprechend neu anlegen. Ohne einen solchen Adresswechsel ist keine
Neuinstallation allein wegen dieser Version vorgesehen.

## 5. Fehler unterscheiden

| Beobachtung | Prüfen |
| --- | --- |
| HTTPS antwortet nicht | `secure` aktiviert, eigene Zertifikate gewählt, Instanz gestartet, tatsächlicher Web-Port, Bind-Adresse und Erreichbarkeit. |
| Browser zeigt Zertifikatsfehler | Verwendete IP/DNS-SAN, Gültigkeitszeit, Gerätesystemzeit, vollständige Kette und Vertrauen auf dem Endgerät. |
| Browser funktioniert, Homescreen nicht | Gespeicherte App-Adresse mit dem funktionierenden Zugang vergleichen; Worker-/App-Update am gleichen Ursprung prüfen. |
| Nach Login falscher Port | Prüfen, ob wirklich 1.0.38 samt neuer Webdateien geladen ist; Legacy-Portweiterleitung ist in diesem Stand entfernt. |
| EOS-Sitzung wird abgewiesen | Zentrale Login-/Prüf-URL, konfiguriertes Profil und vorhandenen Proxyvertrag prüfen; kein lokaler Ersatzlogin. |
| Nach Neustart Zertifikatfehler im Log | Auswahl, Schlüsselpaar und Kette korrigieren; der Server öffnet absichtlich keinen HTTP-Ersatz. |

## Prüfumfang dieses Pakets

Der aktuelle [Prüfbericht](../reports/branding-2026-11-22/PRUEFBERICHT_DE.md)
trennt lokale HTTPS-/Authentifizierungs- und PWA-Vertragsprüfungen von der
offenen Browser-/Homescreen-Abnahme auf echten Endgeräten. Zertifikate der
Testserver werden nur temporär erzeugt; ihre privaten Schlüssel sind kein
Bestandteil der Lieferung. Technische Grenze und feste Fehlercodes stehen im
[TLS-Vertrag](../security/UI_TLS_TRANSPORT_HELPER_DE.md).
