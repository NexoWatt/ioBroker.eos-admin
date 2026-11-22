# 1.0.38 – Gezielte Gegenprüfung von HTTPS und Web-App-Start

Stand: 22.11.2026, 08:03 UTC. Geprüft durch einen getrennten Review-Arbeitsschritt.
Dies ist eine lesende Quell-/Diffprüfung, kein Penetrationstest, keine externe
Zertifizierung und keine Geräteabnahme.

## Umfang und Vergleichsbasis

Unveränderte Vergleichsbasis: ausgepacktes Lieferpaket 1.0.37 unter
`status-review-20261122/extracted/NexoWatt_UI_1.0.37`. Ziel: 1.0.38-Arbeitsstand.
Geprüft wurden die Änderungen in `main.ts`, der neue TLS-Transporthelper,
`pwa.ts`, die geänderte Service-Worker-Oberfläche und die HTML-Startreihenfolge.
Die entsprechenden Änderungen im manuell typisierten Main-Spiegel wurden
gegengeprüft. Kein Vollscan und keine zusätzliche Testsuite wurden gestartet.

## Relevante Befunde und Nachprüfung

| Kennung | Befund | Nachgeprüfte Korrektur |
| --- | --- | --- |
| UI38-S01 | `onReady` wartete vor EMS-, Timer- und NexoLogic-Initialisierung auf den Webserver. Ein neuer Zertifikatsfehler hätte deshalb zusätzlich zur gesperrten UI den autonomen Start verhindert. | Nur ein tatsächlicher `UiTlsConfigurationError` wird am Webserverstart lokal behandelt. Der Verbindungsstatus bleibt falsch; es wird kein Ersatzlistener geöffnet. Anschließend werden die vorhandene Konfiguration und autonome Regelung initialisiert. Andere Fehler werden weiterhin weitergereicht. Bei laufendem Shutdown wird nicht fortgesetzt. |
| UI38-S02 | Während der asynchronen Zertifikatsabfrage konnte `onUnload` bereits abgeschlossen sein. Eine danach noch rechtzeitige positive Antwort hätte einen neuen HTTPS-Listener öffnen können. | `startServer` prüft `_nwShuttingDown` vor dem Anlegen der Express-Anwendung und erneut unmittelbar nach der Zertifikatsabfrage. Der feste Abbruchfehler wird nicht als Zertifikats-Konfigurationsfehler verschluckt. `onReady` kehrt bei Shutdown innerhalb des bestehenden `try/finally` zurück. |

Beide Korrekturen wurden im aktualisierten Produktcode lesend nachgeprüft.
Die TLS-Listenersequenz und die neue lokale Fehlerbehandlung in `onReady` sind
zwischen kanonischer Quelle und typisiertem Main-Spiegel byteidentisch. Der
Spiegel enthält zusätzlich die vorgesehenen Transportfelder im Konfigurationstyp.
Die gesamte Datei ist wegen vorhandener Typblöcke nicht als byteidentisch bezeichnet.
Die gesonderten Laufzeitfälle für tatsächlichen `onReady`-Ablauf und Shutdown
gehören zum Integrationsprüfbericht; dieser Vermerk behauptet deren Ergebnis nicht.

## Erhaltene Sicherheitsgrenzen

- `secure` fehlt oder ist `false`: Der bestehende HTTP-/Proxy-Listenerpfad bleibt
  erhalten. `secure:true`: ausschließlich geprüfte HTTPS-Optionen. Andere Werte,
  fehlende Auswahl, ungültige PEM-Inhalte, unpassender Schlüssel, abgelaufene
  Zertifikate oder ungültige Ketten ergeben einen festen Fehler. Es gibt keinen
  Zertifikatsfehlerpfad zu einem HTTP-Ersatzlistener.
- Der Helper begrenzt Zertifikatslesen, PEM-Größen, Zertifikatsanzahl und
  Handshakezeit. Er fordert TLS ab 1.2, wählt keine gemeinsamen Standardzertifikate
  und erzeugt keine Schlüssel oder Zertifikatsdateien. Ausstehende nicht
  abbrechbare Controllerabfragen werden nicht durch parallele Ersatzabfragen
  vervielfacht. Fremde Fehlermeldungen und PEM-Daten werden redigiert.
- `ui-access-policy.ts`, `auth.ts`, `runtime-base.ts` und der Proxy-HTML-Sender
  sind gegenüber 1.0.37 byteidentisch. Die Main-Diffs lockern keine Rollen-,
  HTTP-Login-, CSRF-, Cookie- oder Origin-Prüfung. Nativer TLS-Transport wird
  bereits über den tatsächlichen verschlüsselten Socket erkannt.
- Die Maschinen-Ausnahmen erhalten ihre bestehenden eigenen Tokenverträge.
  `dc-station-display.html` ist byteidentisch und lädt weder Benutzer-Authwrapper
  noch PWA-Bootstrap. Ein ausdrücklich auf TLS umgestellter Listener benötigt
  passende HTTPS-Clientadressen; die Änderung öffnet keinen zweiten HTTP-Port.

## HTML- und PWA-Start

In genau **19 geschützten Runtime-HTML-Seiten** stehen `runtime-base.js` und
anschließend `auth.js` vor den übrigen Anwendungsskripten. Beide frühen Skripte
sind synchron, ohne `defer` oder `async`. Damit ist der vorhandene
Sitzungs-/CSRF-Wrapper auch im direkten Betrieb vor den App-Aufrufen installiert.
Die serverseitigen Gates bleiben zusätzlich wirksam.

Genau **sechs PWA-Einstiege** laden den gemeinsamen Bootstrap:
`login.html`, `index.html`, `history.html`, `settings.html`, `storagefarm.html`
und `energy-ledger.html`. Auch dort ist `runtime-base.js` bereits geladen.
Die Loginseite verwendet ihren eigenen Loginablauf und wird nicht mit dem
Benutzerseiten-Authwrapper versehen.

`pwa.ts` registriert ausschließlich im bestätigten direkten sicheren Kontext,
nicht im Admin-Proxy oder in Frames. Worker-URL und Scope sind an den eigenen
Ursprung gebunden; Queryparameter bestimmen kein Ziel. Gleichzeitige Aufträge
und Wiederholungen sind begrenzt. Registrierung oder Update schalten keine
Sitzung frei, laden die Seite nicht automatisch neu und blockieren bei Fehlern
nicht die Anmeldung. Der Service Worker hält weiter nur öffentliche
Bild-/Schriftressourcen. Die neue Offlineansicht enthält keine privaten
Anlagendaten; die entfernte private Offline-Shell wird nicht wiederhergestellt.

## Ergebnis und Grenzen

Nach den zwei nachgeprüften Korrekturen wurde im genannten Diffumfang kein
weiterer materieller Sicherheits- oder Kompatibilitätsbefund festgestellt.
Das ersetzt weder die gesonderten funktionalen Prüfläufe noch die Prüfung der
tatsächlichen Zertifikatsnamen/IP-Adressen, Browser-Vertrauensstellung,
installierten Web-App, Proxyinstallation oder Anlagenhardware.

## Quellenbindung bei Abschluss

| Quelle | SHA-256 |
| --- | --- |
| `src-ts/runtime-executables/main.ts` | `3fc8371335619306eba22118ae3a75fe4a26e4edd8a1edf0232b007ebee3893e` |
| `src-ts/runtime-executables/lib/ui-server-transport.ts` | `8c95ad0ba9391432427d7448dd1a6443cd2c6910da46405023d0e342a0231412` |
| `src-ts/runtime-executables/www/pwa.ts` | `cae266c2f9d5010485a639a17b0270111c6c1b1cb6d3eed51a75e6a330af898c` |
| `src-ts/runtime-executables/www/sw.ts` | `50ba9fef41b8e1b7f564ef1355aaefd578cb7eaccfd288be12a4ff4b02d7a15c` |
| `src-ts/runtime-executables/lib/ui-access-policy.ts` | `1411973bbdef3000e723fcee3ffbce899f4890f3f10ac78897cab0414200f32a` |

<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
