# Begrenzte Sicherheitsbetrachtung der Änderung 9.0.27

Dies ist die Änderungsauswirkungsanalyse, keine erneute vollständige Norm-/Produktzertifizierung. Herstellerverantwortung und Anlagenabnahme bleiben erforderlich. Der vorherige vollständige Repositorybestand mit seinen Nachweisen bleibt enthalten.

| Grenze / Risiko | Behandlung und Nachweis |
| --- | --- |
| Unvertrauenswürdige Geräteinventur; falsche Stellziele | Native OCPP-Wurzeln, Datentypen/Einheiten und gültiger Datenpunktvertrag werden geprüft. Vorhandene Monitorzeilen werden nicht still zu schreibenden Zeilen. Mehrdeutige Steueridentitäten erfordern Prüfung. Funktions- und Konflikttests. |
| Parallele Konfigurationsänderung (STRIDE Tampering; Konsistenzklasse CWE-362) | Bestehende serverseitige Mutationssperre und CAS-Revision bleiben aktiv. Nur nachgewiesen unveränderte Formulare übernehmen den aktuellen Snapshot. Löschmarkierungen werden unter derselben Sperre aus dem tatsächlichen Vorher-/Nachherbestand abgeleitet. HTTP/CAS-Rennen werden getestet. Dies ist keine behauptete ausnutzbare CVE. |
| Wiederanlage trotz Nutzerlöschung | Persistenter Geräte-/Auftragsbezug statt rückwirkender Reaktivierung alter Einrichtungswünsche. OCPP-Ausnahmen begrenzt und validiert, bewusste Wiederaufnahme über den normalen geschützten Speicherweg. Neustart-/Wiederherstellungstests. |
| Ressourcenverbrauch / DoS (STRIDE Denial of Service) | Bestehende IPC-Limits bleiben aktiv. Neue Listen und Startwiederholungen sind begrenzt, keine zusätzlichen Dauerdienste oder Poller. Ein Testmodell mit unabonnierten State-Echos traf korrekt das Schutzlimit; die Fixture wurde auf die reale Controller-Subscriptionsemantik korrigiert. Kein Hochsetzen des Limits zur Kaschierung. |
| Befehlsausführung im Repository-Reparaturwerkzeug | Keine Shell-Interpolation, feste Argumente, Abbruch beim ersten Fehler, keine pauschale Aktivierung fremder oder bewusst gestoppter Instanzen. Negative und positive Script-Tests. |
| Geheimnisse / Datenschutz | Keine neuen personenbezogenen Daten, Cloudziele, Zugangsdatenfelder oder Logs mit echten Schlüsseln. OCPP-Wurzeln und lokale Einrichtungskennungen bleiben in der vorhandenen Konfiguration/verschlüsselten Modulablage bzw. Installerpersistenz. Gezielter Geheimnisscan prüft den Lieferbestand. Kein vollständiger Datenschutz-Audit aus dieser Änderung abgeleitet. |
| Protokoll- und Anlagenwirkung | Bestehende OCPP/EEBus/Modbus-Transportwege und Freigaben bleiben. Keine neue IEC-62351-Konformitätsaussage. Physischer Dousida-PV-Stopp, Offlineverhalten und Schutzeinrichtungen müssen am Zielsystem geprüft werden. |

Produktionsaudit: zwei moderate Paketmeldungen zu einem bestehenden AJV-Advisory; konkret benötigte $data-Option in den geladenen OCPP-Validatoren deaktiviert. Details und verbleibende Abhängigkeitsschuld in ABHAENGIGKEITEN.md. Null hohe/kritische Auditmeldungen sind keine Garantie für allgemeine Sicherheit.

Zielrechte: keine zusätzliche Root-Berechtigung, Capability, Benutzergruppe oder privilegierte Hintergrundkomponente durch diesen Patch. Der Test-Controller und die Hardware-I/O sind isolierte Ersatzgrenzen. Ein vollständig installierter ioBroker-Dienstlauf auf dem Pi einschließlich Betriebssystemrechten ist kein Bestandteil dieses lokalen Nachweises.

Offen: echte Anlagen-/Browserabnahme, Langzeitbetrieb und Unterbrechung eines Updates auf dem Pi. Verantwortlich für die Feldabnahme: NexoWatt; vor breiter Produktionsausrollung prüfen. Der externe ioBroker-404-Wiederanlauf ist nachgestellt und abgegrenzt, aber auf der Nutzeranlage nicht forensisch abschließend nachgewiesen oder durch einen Controllerpatch geändert.


## Ergänzung Tarif-Persistenz

Der neue Installer-Tarifabruf maskiert Geheimnisse einschließlich objektförmiger REST-Header/Request-Bodies. Zweckbindung verhindert die Wiederverwendung alter Tokens bei Anbieter-, Ziel- oder Authentitätswechsel. Positive Hydration schützt HTTP-Konfiguration und automatische Geräte-/OCPP-Konfigurationsmutationen. Unveränderte Tarife werden bei allgemeinen EMS-Saves nicht übertragen. Reproduktion und Grenzen: TIBBER_NEUSTART.md. Keine neuen Rechte, Transportziele oder Dienste.

Lokale Softwareprüfungen: Linux x86_64, UID 1000/GID 1000, zusätzliche Gruppen: keine. Dies ist keine ARM64- oder Zielanlagenabnahme.
