# NexoWatt EOS 9.0.27 – Ladepunktzuordnung, Tarifpersistenz und Wiederanlauf

Stand: 26.11.2026. Ausgangspunkt: unveränderter vollständiger Lieferstand 9.0.26. Status: kontrollierter Integrationsteststand; keine Veröffentlichung und kein Eingriff in die Nutzeranlage. Abschließende Ergebnisse siehe PRUEFERGEBNISSE.json und raw/INDEX.json.

## Sollverhalten und Änderung

| Bereich | Befund in 9.0.26 / Korrektur in 9.0.27 |
| --- | --- |
| Interne OCPP-Erkennung | Automatische und ausdrücklich ausgelöste Erkennung verwenden denselben validierten Datenpunktvertrag und dieselbe physische Steueridentität. Wiederholtes Erkennen ergänzt fehlende verifizierte Datenpunkte, statt einen zweiten identischen Controller anzulegen. |
| Stationszuordnung | Neue automatisch angelegte EMS-Ladepunkte erhalten keine Stations-/Displaygruppe. Diese Zuordnung erfolgt manuell. Bereits bestehende manuelle Namen, Grenzwerte, Freigaben und Stationen werden erhalten. Eine physische OCPP-Steuergruppe ist nicht dieselbe Einstellung wie eine Stationsgruppe im UI. |
| OCPP-Quellen | Verwaiste Zustände eines entfernten separaten Adapters gelten nicht mehr als laufende Quelle. Eine tatsächlich konfigurierte separate Instanz bleibt erkennbar, auch wenn sie vorübergehend offline ist. Ein ausdrücklich übernommener interner Namensraum ist gegenüber dem früheren Standardbaum exklusiv. |
| Formular und Konflikte | Ein unverändertes Formular lädt vor Erkennung bzw. beim Öffnen der Ladepunktseite den aktuellen Stand mit passender Revision. Tatsächliche ungespeicherte Eingaben werden einschließlich noch nicht übernommener DOM-Werte erkannt und erhalten. Echte parallele Änderungen bleiben revisionsgeschützt; kein blindes Überschreiben. |
| Identität und Monitorzeilen | Auch Stromstellwert-, Strommess-, Fahrzeug- und bestätigte Limitfelder fließen in die Identität ein. Mehrdeutige oder gemischte physische Wurzeln werden zur Prüfung angezeigt. Eine aktive reine Monitorzeile erhält nicht nachträglich ihren ersten Schreibzugriff. |
| OCPP löschen | Eine ausdrücklich gespeicherte Löschung setzt eine dauerhafte, begrenzte Erkennungsausnahme. Hintergrundereignisse und Neustarts legen die Zuordnung nicht wieder an. Bewusste Erkennung und erneutes Speichern nehmen genau diese Ausnahme zurück. |
| Devices löschen | Ein bereits verbrauchter oder schon beim Entfernen bestehender Einrichtungsauftrag darf eine gelöschte EMS-Zeile nicht wiederherstellen. Erst ein neuer ausdrücklicher Einrichtungsauftrag darf sie erneut anlegen. Das gilt auch für ältere gespeicherte Bindungen. |
| Tibber-Persistenz | Der Installer-Abruf liefert die bestätigte Tarifkonfiguration mit maskierten Geheimnissen. Ein unveränderter Tarif wird bei anderen EMS-Änderungen nicht mitgeschrieben. Tatsächliche Feldänderungen werden gezielt übernommen; vor vollständiger Hydration bleiben HTTP- und Hintergrundmutationen gesperrt. |
| Modulstart | Eine einmal gescheiterte Start-Subscription blockiert nicht dauerhaft denselben Modulhost. Begrenzte Wiederholung, deduplizierte Subscriptions und Abbruch bei Stop; bewusste Moduldeaktivierung bleibt wirksam. |
| Repository-Werkzeuge | Generator und Patchwerkzeug übernehmen stopBeforeUpdate und Controllerprofil aus den Paketmetadaten. Das Reparaturwerkzeug bricht bei Fehlern ab, benutzt feste Prozessargumente und schaltet keine Instanz eigenmächtig ein. |

## Funktions- und Sicherheitsgrenzen

Bereits vorhandene doppelte EMS-Zeilen werden wegen möglicherweise unterschiedlicher manueller Grenzen und Stationen nicht automatisch zusammengeführt. Sie bleiben als Konflikt sichtbar. Nach „Neu laden“ muss die überzählige bzw. alte Zeile bewusst gelöscht und gespeichert werden; die Korrektur verhindert neue Doppelanlagen.

Neue elektrische Grenzwerte werden nicht erfunden. Die Erkennung richtet die belegbaren Datenpunktverknüpfungen ein; die Installateurfreigabe mit gültigen Grenzen bleibt erforderlich. Vorhandene Regelmodi, Lizenzprüfungen, Leserechte, Laufzeittrennung und ausdrücklich deaktivierte Konfigurationen werden nicht aufgehoben. Der neu gemeldete Tibber-Verlust wurde über den tatsächlichen App-Center-Speicherweg bis zum Neustart nachgestellt und korrigiert; Details in TIBBER_NEUSTART.md.

Der normale Installer-Speicherweg bleibt authentifiziert, serialisiert und revisionsgeschützt. OCPP-Löschausnahmen werden serverseitig aus der tatsächlichen Änderung abgeleitet, nicht aus frei vorgegebenen Clientdaten. Maximal 128 physische OCPP-Wurzeln, mit Validierung beim Laden und Wiederherstellen. Die Ausnahme entfernt die EMS-Zuordnung, nicht die OCPP-Verbindung oder fremde ioBroker-Datenpunkte.

Devices inventarisiert seine gespeicherten Geräte und besitzt keinen OCPP-Treiber. Es liest nicht zusätzlich den internen OCPP-Gerätebaum ein. Gleiche belegte Stellziele dürfen keine zweite Regelung erzeugen. Unterschiedliche Protokolle und beliebige Alias-Ketten lassen sich jedoch nicht allein anhand gleicher Namen oder IP-Adressen sicher als dasselbe Gerät erkennen; keine behauptete universelle physische Deduplizierung.

Es entstehen keine neuen Dienste, Benutzer, Ports, Berechtigungen oder privilegierten Befehle. Die Prüfungen verwenden isolierte Controller-, Lizenz- und Transportgrenzen; sie bescheinigen keine vollständige Anlagenprüfung unter dem ioBroker-Dienstkonto.

## Ressourcen

Kein zusätzlicher dauerhafter Poller und keine Änderung der EMS-Regelintervalle. Erkennung nutzt die bestehenden Auslöser und begrenzte Identitätsmengen. Gelöschte Geräte erzeugen keine fortwährenden Wiederanlageversuche. Startup verwaltet höchstens acht Subscriptioneinträge und begrenzte Retry-Wartezeiten. Die 5-Sekunden-Anzeige und die Regelung werden durch diesen Patch nicht verlangsamt. Ein belastbarer Vergleich von RAM, CPU und Regelzeit auf dem Raspberry Pi ist noch nicht gemessen; keine zugesagte MB-Einsparung.

## Abschließende Softwareergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| Node.js 22.23.4, vollständiges npm test | 2.709 erfasst; 2.707 bestanden; 0 Fehler; 2 ausgelassen |
| Node.js 24.22.3, vollständiges npm test | 2.709 erfasst; 2.707 bestanden; 0 Fehler; 2 ausgelassen |
| Backend-, UI-, Admin-, Installer- und Modulbuild | Alle erfolgreich |
| Verbindliche Gesamt-Typprüfung und Linting | Erfolgreich |
| Gezielte reale Devices-HTTP-/IPC-Pipeline | Je 15/15 unter Node22 und24 |
| Nginx-/POSIX-ACL-Prüfung | Mangels nginx bzw. setfacl ausgelassen |
| Tatsächlicher Browserlauf | Vom Betriebssystem vor Seitenaufruf blockiert |

Die zwei Auslassungen sind vollständig in den Rohlogs ausgewiesen. Die npm-Testgruppen enthalten jeweils 1.916, 55, 642, 4 und 92 Tests. Maschinenlesbare Ergebnisse: PRUEFERGEBNISSE.json; Loghashes: raw/INDEX.json. Die fertigen Paket-/Git-Installationen und Publish-Dry-Runs werden danach gegen den versiegelten Stand ausgeführt und außerhalb des unveränderten Quellpakets unter Liefernachweise dokumentiert.

## Prüfmethodik

Die unveränderte 9.0.26 reproduziert mehrere neue Regressionen: OCPP-Vertragsprüfung 4 von 5 Fällen, Frontend-Aktionen 12 von 14, Devices-Idempotenz 5 von 7 und Modulstart 5 von 7. Baseline-Fehlerlogs sind Reproduktionsnachweise und keine Ergebnisse des korrigierten Stands.

Der abschließende vollständige Testlauf wurde mit echten Node.js 22.23.4 und 24.22.3 ausgeführt. Die vorhandenen Testgruppen umfassen unter anderem Lizenz-/Sitzungsgrenzen, Installer-CAS, Tarifpersistenz, Gerätezuordnung, Energiefluss, Ladebetrieb, Module und Sicherung. Reale lokale InfluxDB- und separate OCPP-Protokollfixtures sind eingebunden; physische Wallbox, Zähler und Raspberry Pi sind nicht angeschlossen. HTTP-/IPC-Tests führen die tatsächlichen Handler und Kindprozesse mit den dokumentierten Controller-/Hardware-Doubles aus.

Frontend-Handler wurden funktional und über den tatsächlichen HTTP/CAS-Weg geprüft. Der zusätzliche Chrome-Lauf wurde vom Betriebssystem vor dem Laden der Seite blockiert (Process-Singleton-Socket: Operation not permitted). Daher keine behauptete bestandene Browser-/Touch-Abnahme. Große übernommene Dateien mit bestehendem @ts-nocheck sowie der Legacy-Modulhost sind nicht plötzlich vollständig streng typgeprüft; neue typed Helfer, deklarierte JS-Prüfbereiche und verbindliche Gesamtprüfungen sind getrennt zu verstehen.

## Bekannte Grenzen und Anlagenabnahme

1. Auf dem Pi mit der Dousida Energyline: verbinden, genau eine EMS-Zuordnung beobachten, manuelle Station zuweisen, erneut erkennen und zweimal speichern; kein Duplikat und keine verlorene Einstellung.
2. OCPP- und Devices-Zeile ausdrücklich löschen, Adapter neu starten und erneute Geräteereignisse abwarten; keine Wiederanlage. Bewusste erneute Einrichtung muss weiterhin möglich sein.
3. Physische Rückmeldungen und PV-Ladestopp mit zu geringem Überschuss prüfen. Die Zuordnungskorrektur allein ist kein Nachweis für sämtliche Regelungs- und Wallboxfirmware-Fälle.
4. Echter ioBroker-Updatezyklus, Neustart nach Stromausfall, Langzeitbetrieb und Ressourcenmessung auf dem Zielgerät bleiben offen. Ein Paket kann eine vom Controller deaktivierte eigene Instanz nicht selbst ausführen; Details und reproduzierter npm-404-Pfad in UPDATE_WIEDERANLAUF.md.
5. Abhängigkeitsscan und konkrete Erreichbarkeitsbewertung siehe ABHAENGIGKEITEN.md. Offene Meldungen werden nicht als grüner Audit dargestellt. Keine CRA-/IEC-Zertifizierung oder pauschale Fehlerfreiheitsgarantie.

## Lieferung

Das vollständige Repository ist für den bestehenden Git/npm-Weg vorgesehen. Der tatsächliche Paketinhalt und ein normaler Git-Export werden mit aktivierten Produktions-Installationsskripten unter beiden Node-Versionen geprüft. Die separaten Liefernachweise enthalten die tatsächlichen Ergebnisse; die Quelle wird nach der Versiegelung nicht um solche nachträglichen Belege verändert. SHA256SUMS.txt bindet die ausgelieferten Archive an ihre Bytes.
