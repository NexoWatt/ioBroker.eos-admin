# Partnerlaufzeit: Bereitstellung und Betriebsgrenzen

Stand: 28.10.2026. Umsetzung auf Basis von 1.0.31 für den folgenden Lieferstand. Diese Beschreibung gilt für den eigenen Vertrag `nexowatt.partner.v1`. Sie behauptet keine bereits getestete Anbindung eines bestimmten Vermarkters und keine Produktivfreigabe.

## Zuständigkeiten

`PartnerRuntime` verbindet die lokalen App-/Lizenzprüfungen, den Fachdienst, das Replayjournal und den ausgehenden WSS-Client. Der Runtimeprozess schreibt keine Gerätedatenpunkte. Nur der bestehende Speicherwriter liest aktuell zulässige, noch nicht abgelaufene Steuerwünsche. Haushalt und reiner Speicherhandel benötigen für diese Partnerschnittstelle weder PV noch eine aktive Dynamic-NVP-App; technische Inbetriebnahme, reale Messungen und die bestehende Schreibhoheit bleiben erforderlich.

Der Installer verwaltet eine lokale Partnerkennung, WSS-Adresse, explizite App-/Ressourcenrechte und eine Geheimnisreferenz. Die Geheimnisse selbst gehören weder in diese Konfiguration noch in deren Backup. Das Paket enthält keine privaten Bereitstellungsdateien.

## Geheimnisreferenz und erlaubtes Ziel

`credentialRef` ist der Name einer Prozessumgebungsvariable. Er beginnt mit `NEXOWATT_PARTNER_` und enthält danach ausschließlich Großbuchstaben, Ziffern und Unterstriche. Der Wert der Variable ist ein JSON-Objekt von höchstens 64 KiB. Eine geschützte Dienstbereitstellung muss diese Variable vor dem Adapterstart setzen. Änderungen an der Prozessumgebung erfordern einen kontrollierten Neustart beziehungsweise eine neue, autorisierte Laufzeitinstanz.

| Feld im geheimen JSON | Typ und Bedeutung |
| --- | --- |
| `partnerId` | Dieselbe lokale Partnerkennung wie in der Installer-Konfiguration. |
| `allowedEndpoint.hostname` | Exakter DNS-Hostname. |
| `allowedEndpoint.port` | Ganzzahl zwischen 1 und 65535; für normales WSS üblicherweise 443. |
| `allowedEndpoint.path` | Exakter Pfad beginnend mit `/`. |
| `credentials.expiresAtMs` | Absoluter Ablaufzeitpunkt in Unix-Millisekunden. |
| `credentials.bearerToken` | Optionales dienstspezifisches Token; niemals in URL, Chat oder Repository kopieren. |
| `credentials.clientCertPem` und `credentials.clientKeyPem` | Optionales zusammengehöriges mTLS-Paar. |
| `credentials.caPem` | Optionales zusätzliches, lokal freigegebenes CA-Material. |
| `privateVpnAddresses` | Optional bis zu 32 einzeln freigegebene private IP-Adressen; keine Netzwerk-Wildcards. |

Mindestens Token oder mTLS ist erforderlich. Unbekannte Felder werden zurückgewiesen. Die WSS-Adresse in der UI muss exakt zum geheim bereitgestellten Ziel passen. Redirects, Zugangsdaten in URLs, Querystrings und URL-Fragmente sind nicht zulässig. DNS-Auflösung, IP-Prüfung, TLS-Gegenstellenprüfung und feste Bindung an die geprüfte IP bleiben auch im VPN aktiv. Ein VPN ersetzt weder TLS noch Authentifizierung.

Der Transport beschafft keine OAuth-Tokens nach und nutzt keine eingebauten Geheimnisse. Er prüft den frühesten Ablauf aus lokalem Profil und Clientzertifikat. Zusätzlich prüft die Runtime vor jedem Auftrag-/Antwortzugriff den Ablauf anhand der Uhrzeit und einer beim Start abgeleiteten monotonen Frist. Eine zurückgestellte Systemuhr verlängert diese Laufzeit nicht. Die Bereitstellung und Rotation durch den tatsächlich gewählten Dienst ist im Projekt gesondert zu verifizieren.

## Dauerhafte Zustände

Unter dem absoluten ioBroker-Instanzdatenverzeichnis legt die Runtime an:

| Pfad | Zweck |
| --- | --- |
| `partner-runtime/` | Eigenes Verzeichnis mit POSIX-Modus `0700`. |
| `partner-runtime/journal.json` | Begrenztes Replayjournal ohne Tokens oder private Schlüssel; Modus `0600`. |
| `partner-runtime/revocation.json` | Dauerhafte Schranke für widerrufene Konfigurationsrevisionen; Modus `0600`. |
| `partner-runtime.initialized` | Marker außerhalb des Journalverzeichnisses, damit dessen späterer Verlust nicht als Erstinstallation behandelt wird. |

Ein Journal speichert höchstens 2048 Einträge und höchstens 1 MiB. Jeder angenommene Auftrag wird vor der Freigabe mit Datei-fsync, atomischem Rename und Verzeichnis-fsync gesichert. Lade- und Schreibvorgänge derselben Runtime werden serialisiert: Ein neuer Fachdienst nach einem Hot-Reload liest erst nach bereits begonnenen Schreibvorgängen seines Vorgängers. Neustarts stellen ausschließlich Replaykennungen wieder her, niemals aktive Steuerwünsche.

Der echte Erstaufbau erzeugt den Marker vor den Nutzdateien. Bricht er ab, sperrt die nächste Initialisierung bewusst. Fehlende, beschädigte, zu große, zu weit freigegebene oder symbolisch verlinkte Dateien sperren ebenfalls. Elternpfade dürfen keine Symlinks und keine ungeschützten fremden Schreibrechte enthalten. Die aktuelle POSIX-Prüfung ist für das Linux-Zielsystem bestimmt; Windows wird geschlossen abgewiesen, solange kein gleichwertiger ACL-Vertrag implementiert und geprüft ist.

Journal, Marker und Widerrufsdatei dürfen bei Updates und Rücksicherungen nicht einzeln gelöscht oder mit älteren Ständen kombiniert werden. Ein Bediener kann diese Sicherheitsgrenze nicht über die Weboberfläche zurücksetzen. Eine dokumentierte Wiederinbetriebnahme muss einen vollständig konsistenten Stand und die betroffenen Partnerrechte berücksichtigen.

## Widerruf, Konfigurationswechsel und Fehler

Widerruf entfernt vorhandene Wünsche und beendet den Transport synchron. Die API bestätigt einen dauerhaften Widerruf erst nach erfolgreicher Speicherung der Revisionsschranke. Auch wenn anschließend das Speichern der neuen Installer-Konfiguration scheitert, bleibt die bisherige Revision nach Refresh und Neustart gesperrt. Erst eine erfolgreich gespeicherte, ausdrücklich neu freigegebene höhere Konfigurationsrevision kann erneut verbinden. Normales Pausieren oder Herunterfahren setzt keine neue Widerrufsrevision.

Ist schon die Speicherung der Widerrufsdatei selbst unmöglich, bleibt die laufende Instanz gesperrt und die API meldet einen Fehler. Für einen vollständig fehlgeschlagenen Speichervorgang kann kein dauerhafter Nachweis behauptet werden. Datenträgerzustand, USV-/Dateisystemverhalten und Wiederanlauf müssen auf dem Zielsystem geprüft werden.

Ein absichtlicher Rollback aller Dateien durch denselben Betriebssystemnutzer oder einen Administrator lässt sich mit Dateirechten allein nicht verhindern. Hosthärtung, Dienstkontentrennung, geschützte Sicherungen und gegebenenfalls eine externe monotone Vertrauensquelle bleiben Teil des Systemkonzepts. Die implementierten Prüfungen erkennen Dateiverlust und inkonsistente lokale Zustände, ersetzen aber keine Hardware-Vertrauenswurzel.

Bei Verbindungsabbruch werden Aufträge verworfen. Ein Reconnect reaktiviert sie nicht. Bereits bekannte Befehlskennungen führen nicht erneut zur Ausführung. Eine Quittung `ACCEPTED` bezeichnet ausschließlich einen gespeicherten, überprüfbaren Steuerwunsch; eine Gerätebestätigung wird daraus nicht abgeleitet.

## Datenprojektionen in Version 1

Alle Werte sind feste fachliche Projektionen. Fremde State-IDs, Konfigurations-JSON, Kundenkennungen, Zählerseriennummern und Kontodaten sind kein Bestandteil dieser Schnittstelle.

| App/Ressource | Gelieferter Umfang |
| --- | --- |
| Bilanz, `site` | Letztes abgeschlossenes, vollständiges Herkunftsintervall mit numerischen kWh-Summen sowie ursprünglichem Intervall- und Aktualisierungszeitpunkt; höchstens 30 Minuten seit Intervallende. Kein Durchreichen der Bilanz-Rohdaten. |
| Direktvermarktung, `site` | PV-Leistung sowie Netto-Netzleistung aus Import minus Export in W; beide Netzrichtungen müssen als echte, begrenzte Messwerte vorliegen. Fehlt eine Seite, wird sie nicht als Null ausgegeben. |
| Arbitrage, `single` oder freigegebene dynamische Gruppenkennung | Ausschließlich vom bestehenden Writer erstellte fachliche Messwertprojektion mit SoC, Speicherleistung, Netzleistung und ihren ursprünglichen Messzeitpunkten. |
| Arbitrage, `farm` | In dieser Ausbaustufe nicht verfügbar; vor Freigabe ist eine sichere Zuordnung und Freigabe je physischem Speicher erforderlich. |

Leistungs-/SoC-Telemetrie ist nur bei höchstens 15 Sekunden alten, endlichen, echten Zahlen verfügbar. Die ursprünglichen Messzeitpunkte dürfen höchstens fünf Sekunden auseinanderliegen. Fehlende oder veraltete Messwerte ergeben `available: false`; sie werden weder als Null noch als frisch ausgegeben. Positiver Speicherleistungswert bedeutet Entladen; positive Netzleistung bedeutet Bezug.

Direktvermarktung meldet in dieser Ausbaustufe `curtailmentSupported: false`. Zeitpläne, anbieterfremde Protokolle, eine echte Börsenanbindung, Tokenbeschaffung und Gerätebestätigungen sind nicht implementiert. Der Partner muss den dokumentierten EOS-Vertrag unterstützen oder über einen gesondert geprüften Konnektor angebunden werden.

## Nachweis

`node scripts/verify-partner-runtime.cjs` kompiliert die beteiligten Sicherheitsmodule tatsächlich unter TypeScript strict und prüft 20 Szenariogruppen mit temporärer echter Dateipersistenz und einem kontrollierten Transportersatz. Dazu gehören fehlende Dateien, Rechte/Symlinks, Revisionssperre nach fehlgeschlagenem Konfigurationscommit und Neustart, Credentialablauf, fehlende Messungen, auslaufende alte Socketgenerationen sowie ein künstlich angehaltener Journal-Schreibvorgang während des Hot-Reloads.

Der Test ersetzt keine Prüfung mit realem Vermarkter, realem DNS/TLS-Netz, Zielhardware, Datenträgerausfall oder Speicherinbetriebnahme. Transport-, Fachdienst-, Writer- und Gesamtreleaseprüfungen werden separat mitgeführt. Die Dokumentation ist ein CRA-/IEC-Nachweisbaustein und keine Konformitätserklärung.
