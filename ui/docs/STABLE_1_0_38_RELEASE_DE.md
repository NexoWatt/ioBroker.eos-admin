# NexoWatt EOS 1.0.38 – Logo, direktes HTTPS und Web-App

Stand: 22.11.2026. Dieser gezielte Nachtrag baut auf dem vollständig
ausgelieferten Repository 1.0.37 auf. Er übernimmt dessen Anmeldung,
Smarthome-Modernisierung und bestehende EMS-Funktionen.

## Änderung

- Oben links auf der Anmeldeseite erscheint die vom Nutzer gelieferte
  Originaldatei des NexoWatt-EOS-Logos. Sie wird lokal ausgeliefert und für
  große und kleine Bildschirme eingebunden. Das bisherige N-Symbol und der
  zusätzliche ausgeschriebene Markenblock entfallen.
- Die Kennzeichnung oberhalb von „Willkommen zurück“ wird vollständig
  entfernt. Die Anmeldeseite braucht dieses Element auch technisch nicht mehr.
- Eigene sichtbare Plattformhinweise in Anmeldung, Einrichtung, Hilfetexten
  und Fehleransichten sind neutral als Benutzerkonto, Benutzerverwaltung,
  Systemverwaltung oder Datenpunkt formuliert.
- Der eingebaute Webserver kann seinen vorhandenen Port ausdrücklich als
  HTTPS-Listener betreiben. Zertifikat, Schlüssel und optionale Kette werden
  in der Systemverwaltung ausgewählt und vor dem Listenerstart geprüft.
  Die bisherige Fassung startete an diesem Port ausschließlich HTTP;
  ein direkter Aufruf mit `https://IP:Port` konnte dort nicht funktionieren.
  Ein ungültiges UI-Zertifikat sperrt nur diesen Zugang und verhindert keinen
  regulären Start der bestehenden autonomen Regelung. Nach Adapterstopp darf
  eine verspätete Zertifikatsantwort keinen neuen Listener mehr öffnen.
- Nach der bestätigten Anmeldung entfällt die veraltete Browserweiterleitung
  auf den vermeintlichen Admin-Port 8081. Die serverseitigen Rollenprüfungen
  für App-Center und Simulation bleiben aktiv. Einrichtungslinks verwenden
  den tatsächlich konfigurierten HTTPS-Transport.
- Die Anmeldeseite enthält jetzt dieselben App-/Homescreen-Metadaten und
  Icons wie die bestehende Web-App. Ein gemeinsamer öffentlicher Bootstrap
  prüft den Service Worker schon vor der Anmeldung sowie bei Wiederöffnung.
  Name, Start-URL, Scope und bisherige App-Icons bleiben erhalten. Cache v526
  entfernt Vorgängercaches; private Seiten und Livewerte bleiben ungecacht.
- Die 19 geschützten klassischen HTML-Einstiege laden den gemeinsamen
  Runtime-/Sitzungsbootstrap ausdrücklich vor der Bedienlogik. Auf mehreren
  direkten Seiten fehlte diese Einbindung bislang; damit fehlte bei
  Bedienbefehlen der benötigte CSRF-Header. Der zentrale Fetch-Wrapper setzt
  ihn nach bestätigter Sitzung automatisch. Der unabhängige tokenbasierte
  Stationsdisplay-Einstieg behält seinen bisherigen Vertrag.

Der Auftrag betrifft die sichtbare NexoWatt-Oberfläche. Technische Kennungen,
Paket-/Schnittstellenverträge, fremde Lizenzangaben und die historisch
nachvollziehbare Entwicklerdokumentation werden nicht umbenannt. Von Nutzern
selbst vergebene Namen, Datenpunkt-IDs und fremde Administrationsoberflächen
sind keine fest eingebauten Markenhinweise des NexoWatt-Frontends.

## Funktionserhalt und Umfang

Die beiden Anmeldeprofile bleiben technisch getrennt. Die lokale Anmeldung
nutzt das bestehende Konto; EOS prüft weiterhin seine zentrale Sitzung.
Rollen, Passwortprüfung, CSRF, Abmeldung und sichere Rücksprünge erhalten
ihren bestehenden Vertrag. Kein Standardkonto und kein neues Passwort werden
erzeugt. Die zusätzlichen Transportfelder sind optional: `secure` bleibt für
Bestandskonfigurationen ohne dieses Feld deaktiviert; bestehender interner
HTTP-/HTTPS-Proxybetrieb wird nicht automatisch umgestellt. Für direktes
HTTPS ist die dokumentierte Zertifikatauswahl erforderlich. EMS-Regelung,
Anlagenzuordnungen und Gerätedaten werden nicht migriert. Es gibt keine neue
Laufzeitabhängigkeit.

Die zuvor ausdrücklich als offen festgestellten Energieerweiterungen werden
mit 1.0.38 nicht als umgesetzt erklärt: eigener Volleinspeiser-Netzpfad und
Historienchart, freie optionale Nulleinspeise-Messpunktwahl mit NVP-Rückfall
sowie verbindliche Viertelstunden-Tradingreservierungen bleiben offen.

## Update, HTTPS und Web-App prüfen

1. Vorherigen Adapterstand und Konfiguration sichern. Das vollständige Paket
   über das bestehende Installationsverfahren übernehmen und Adapter neu starten.
2. Browserseite vollständig neu laden; für einen eindeutigen Sichttest ein
   privates Fenster öffnen. Bestehende Konten und Anmeldeprofile weiterverwenden.
3. Auf Desktop und Smartphone prüfen: vollständiges EOS-Logo oben links,
   kein zusätzliches N-Symbol/Schriftzug und keine Profilkennzeichnung rechts.
   Formular und Logo dürfen auch bei schmaler Ansicht nicht abgeschnitten sein.
4. Lokale Anmeldung, zentrale Anmeldung, falsches Passwort, Abmeldung und
   rollenabhängigen Einstieg mit den vorhandenen Testkonten prüfen.
5. Wenn direktes HTTPS benötigt wird: in den allgemeinen Einstellungen
   aktivieren, eigene Zertifikate ausdrücklich auswählen und neu starten.
   Die verwendete IP oder der Hostname muss zum Zertifikat passen und das
   Endgerät muss dessen Aussteller vertrauen. Den bisherigen sicheren
   Proxyzugang nicht allein für diesen Nachtrag umstellen.
6. Bereits installierte Web-App am bisherigen Zugang schließen und erneut
   öffnen. Logo, Startseite, Anmeldung, Rücksprung, Gerätebedienung und
   Wiederverbindung prüfen. Ändert sich der Zugang tatsächlich von HTTP auf
   HTTPS oder wechseln Host/Port, muss die Homescreen-Verknüpfung auf den
   neuen Ursprung zeigen; ein Update kann einen fremden Ursprung nicht
   übernehmen.
7. Einrichtungsansichten öffnen und die neutralen Texte kontrollieren;
   eine bestehende Gerätebedienung mit tatsächlicher Rückmeldung durchführen.

Bei Rückfall den gesicherten 1.0.37-Stand über das bestehende Verfahren
wiederherstellen. Keine Datenmigration ist Bestandteil dieser Änderung.
Die neue [HTTPS-/Web-App-Testanleitung](operations/TESTANLEITUNG_1_0_38_DE.md)
beschreibt die konkreten Einstellungen, Zertifikatgrenzen und Fehlerbilder.
Die ausführliche Anleitung zu Profilen und Bestandsanlagen bleibt unter
[Einrichtung und Testanlage](operations/TESTANLEITUNG_1_0_37_DE.md) gültig;
ihre technischen Profilbezeichnungen sind Entwickler-/Betriebsangaben.

## Nachweise und Freigabe

[Änderungs- und Prüfbericht](reports/branding-2026-11-22/PRUEFBERICHT_DE.md).
Die originale Logodatei ist unverändert; ihr SHA-256 lautet
`1ccf55be6d457b4e1891dd7f37adff64a386ed8c633e522e86b9adce055f1d95`.
Produkt-SBOM und Artefaktmanifest werden für 1.0.38 neu gebunden.

Der Lieferstand ist ein Testpaket. Diese Version ist nicht für den Produktivbetrieb freigegeben. `release-manifests/release-status.json`
bleibt `review`, `productionApproved:false`. Historische Prüfberichte werden
erhalten und nicht als neue Browser-/Geräteprüfung dieses Nachtrags ausgegeben.
