<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# HTTPS-Zugang über ioBroker-Admin

**Aktueller Einstieg ab 1.0.37:** Die lokale Konto-/Passwortanmeldung gilt nur
für das ausdrücklich konfigurierte Profil `iobroker`. Eingebettete Ansichten
zeigen keine Passwortmaske mehr; **Anmeldung öffnen** öffnet die separate
Loginseite, anschließend im ursprünglichen Bereich **Erneut prüfen** verwenden.
Im Profil `eos` erfolgt die Anmeldung zentral über EOS Admin; es gibt keinen
lokalen Passwort-Fallback. Einrichtung und aktuelle Testschritte stehen unter
[Anmeldeprofile 1.0.37](ANMELDEPROFILE_1_0_37_DE.md) und
[Testanleitung 1.0.37](TESTANLEITUNG_1_0_37_DE.md).
Die nachfolgende Beschreibung und ihre damaligen Update-Schritte dokumentieren
den Transportstand 1.0.35; die aktuelle Profilanleitung hat für die Anmeldung
Vorrang. Die unten verlinkten Prüfergebnisse bleiben historische Nachweise.

Stand: NexoWatt UI 1.0.35, 03.11.2026. Anlass ist die auf Admin 8.3.5 gemeldete Meldung „signal is aborted without reason“ beim Statusabruf und anschließend bei der Anmeldung. Der Nutzer bestätigt HTTPS. Der bisherige Tab übernahm das HTTPS-Protokoll für den separaten UI-Port, während dessen Server HTTP verwendet. Ein solcher Transportabbruch ist kein Beleg für ein falsches Passwort.

## Neuer Verbindungsweg

Ab Admin 8.3 stellt ioBroker einen Instanzproxy bereit. Der HTTPS-Admin-Tab nutzt beispielsweise `/proxy/nexowatt-ui.0/api/strict-auth/login` auf seinem eigenen Origin. Ein öffentlicher Admin-Unterpfad wie `/admin/` wird beibehalten. Der Browser erhält keinen automatischen HTTP-Rückfall. Die ausgewählte Instanz ist im Proxy-Pfad gebunden; Zugangsdaten werden nicht auf alternativen Ports ausprobiert.

Die vorhandene Adminsitzung berechtigt nur den Zugang zum Proxy. EOS verlangt weiterhin das eigene lokale ioBroker-Kontopasswort und prüft die tatsächlichen Gruppen. Es gibt kein neues Standardpasswort und keine automatische Übernahme der Adminrolle. Der Adminproxy selbst lässt nur Mitglieder von `system.group.administrator` durch. Andere EOS-Installateur-/Kundenkonten nutzen weiterhin den direkten beziehungsweise separat abgesicherten EOS-Zugang; ihnen wird durch dieses Update keine ioBroker-Administratorgruppe zugewiesen.

Das normale Adapterupgrade überträgt `common.adminTab.proxy: true` aus dem Paket in die Instanzobjekte. Nur Dateikopieren oder das Hochladen von Webseiten ist kein vollständiger Metadaten-Upgrade. Das Update öffnet keine Firewallports und ändert keine Benutzer oder Passwörter.

## Update und Prüfung

1. Bestehende Adapterkonfiguration sichern und den vollständigen Stand 1.0.34 als Rückfall bereithalten.
2. 1.0.35 über den normalen ioBroker-Adapterupgrade installieren. Danach den UI-Adapter neu starten und den Admin vollständig neu laden.
3. Im HTTPS-Admin den NexoWatt-Tab öffnen. Der Benutzerplatzhalter heißt nun „ioBroker-Benutzername“; anmelden mit dem eigenen Konto und dessen lokalem Passwort.
4. Die gewünschte Rolle und eine erlaubte Funktion prüfen. Bei einem Administrator zusätzlich EMS Apps, VIS und die benötigten Fachseiten öffnen. Die Adresse muss unter demselben HTTPS-Origin und Instanzproxy bleiben.
5. Falsches Passwort, fehlende EOS-Gruppe, entfernte Gruppenmitgliedschaft sowie Abmeldung prüfen. Keine dieser Situationen darf eine geschützte Funktion freigeben.

Die Laufzeitseiten verwenden den Proxy-Unterpfad für lokale Dateien, API-Aufrufe, Ereignisströme und Navigation. Externe Links werden nicht zum Proxy umgebogen. Der vorhandene Root-PWA-Serviceworker wird im Proxybetrieb nicht registriert; dadurch wird der Admin nicht mit einer EOS-Offlineschicht überlagert. Der direkte EOS-Betrieb bleibt ein eigener Zugriffsweg. Sein PWA-Cache wurde für die geänderten Frontenddateien fortgeschrieben.

## Fehler einordnen

| Meldung / Status | Bedeutung und nächster Schritt |
| --- | --- |
| EOS meldet JSON-401 „Benutzername oder Passwort ist falsch“ | Eigenes ioBroker-Konto und dessen Passwort prüfen; gegebenenfalls die angezeigte Sperrfrist abwarten. |
| Admin-Proxy verlangt Anmeldung / nicht berechtigt | Zuerst die Adminsitzung und Mitgliedschaft in der ioBroker-Administratorgruppe prüfen. Dies ist getrennt von der EOS-Rolle. |
| Proxy nicht verfügbar / 404 | Admin mindestens 8.3 und vollständiges Metadaten-Upgrade prüfen. In der tatsächlichen UI-Instanz muss `common.adminTab.proxy` aktiv sein. |
| Proxy-Ziel nicht erreichbar / 502 | UI-Instanz läuft? Port, Bind-Adresse, gemeinsamer Host und interne Verbindung prüfen. Ein neues Passwort beseitigt diesen Fehler nicht. |
| Zeitüberschreitung / Netzwerkfehler | Der Transport beziehungsweise die Antwort blieb aus. Die Oberfläche behauptet daraufhin keine fehlende Rolle oder erfolgreiche Anmeldung. |
| EOS verweigert die Fachrolle / 403 | Das bestätigte Konto besitzt keine zugeordnete Rolle für die gewünschte Funktion. |

Bei Supportfragen UI-, Admin- und Controller-Version, Meldung, Statuscode und Zugriffsweg ohne Passwort, Sitzungstoken oder vollständige Benutzerobjekte angeben. Es werden keine Passwörter zur Diagnose benötigt.

## Betriebsgrenzen

- Der offizielle Proxyvertrag wurde am Quellstand Admin 8.3.5 geprüft. „Admin 8“ allein garantiert diese Funktion nicht; ältere 8.x-Stände vor 8.3 haben sie nicht.
- Der Proxy verwendet `native.bind`, `native.port` und `native.secure`. Die UI-Runtime berücksichtigt bei ihrer Bind-Adresse zusätzlich das ältere Feld `native.ip`. Bei individuell gesetzten Bind-Adressen müssen beide Verträge zur tatsächlich erreichbaren Adresse passen. Das Update erweitert keine Bind-Adresse automatisch.
- Beim Standardbetrieb auf demselben ioBroker-Host führt Admin die interne Verbindung zum HTTP-UI-Server über Loopback. Bei getrennten ioBroker-Hosts muss die interne Verbindung separat abgesichert und abgenommen werden. Der Browserzugang über HTTPS belegt nicht automatisch Verschlüsselung jedes internen Netzsegments.
- Die optionalen HTTPS-Upstream-Einstellungen des offiziellen Adminproxys liegen außerhalb des NexoWatt-Vertrags. Dessen Quellstand 8.3.5 deaktiviert dort die Zertifikatsprüfung. Für dieses Update wurde daher kein solcher HTTPS-Upstream als geprüfte Sicherheitsfunktion freigegeben.
- Statusabfragen haben ein lokales Fetch-/Body-Budget von sechs Sekunden, Anmeldungen zwölf Sekunden für die getrennten serverseitigen Konto- und Gruppenprüfungen. Diese Fristen betreffen die lokale EOS-Anmeldung, nicht die separat begrenzten externen Wetter-/Tarifdienste. Abgebrochene Browserabfragen sind kein rückwirkender Abbruch bereits laufender serverseitiger Verarbeitung.
- Der konkrete Host, Reverse-Proxy, Zertifikatsbestand und Anlagenbetrieb des Nutzers wurden nicht aus der Ferne geprüft. Lokale Software-, Proxy- und Browsertests ersetzen diese Abnahme nicht.

Ein Rückfall auf 1.0.34 stellt dessen früheren Transport wieder her und behebt den HTTPS-Portkonflikt nicht. Benutzer-/Gruppenmodell und eigene Kontopasswörter bleiben in beiden Ständen erhalten.

Nachweise: [Prüfbericht](../reports/admin-https-2026-11-03/PRUEFBERICHT_DE.md), [offizieller Proxyvertrag](../reports/admin-https-2026-11-03/ADMIN_PROXY_QUELLEN_DE.md), [Benutzer und Gruppen](BENUTZER_GRUPPENRECHTE_DE.md).
