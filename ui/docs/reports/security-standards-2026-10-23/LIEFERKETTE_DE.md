<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. Nutzung, Modifikation oder Verbreitung ohne ausdrückliche Erlaubnis untersagt. -->
# Lieferkettenprüfung – Sicherheitsstandards 23.10.2026

Prüfumfang: ausgelieferte 1.0.28-Lockdateien und korrigierter 1.0.29-Kandidat,
Root einschließlich Entwicklungswerkzeugen sowie Admin-Buildbaum. Node 24.19.0,
npm 11.9.0, Linux x64. Die Audit-Rohberichte enthalten die Datenbankantwort zum
jeweiligen Abruf; Abrufzeiten, Hashes und tatsächlich ausgeführte Befehle stehen
in `sca-check-evidence.json`. Die anschließende Versionskennzeichnung und Release-/SBOM-Bindung sind im
Hauptprüfbericht PRUEFBERICHT_DE.md dem vollständigen Stand 1.0.29 zugeordnet.

## Ergebnis und Korrekturen

Der aktuelle Online-Audit für 1.0.28 meldete drei betroffene Pakete im Rootbaum
(1 kritisch, 2 hoch) sowie zwei im Admin-Buildbaum (beide hoch). Das sind
**Paketbefunde**, keine fünf nachgewiesenen ausnutzbaren Adapter-Schwachstellen.
Ein Paket kann mehrere Advisories haben. Der neue Stand behebt diese Meldungen
mit fünf kompatiblen Patchupdates; keine Hauptversionsmigration und kein
`npm audit fix --force` wurden eingesetzt.

| Paket | 1.0.28 → Kandidat | Einordnung und Maßnahme |
| --- | --- | --- |
| proxy-addr | 2.0.7 → 2.0.8 | Transitive Laufzeitabhängigkeit von Express. CVE-2026-90711 / GHSA-jqcg-44mw-7w3h, kritisch laut Advisory. Betrifft bestimmte fehlerhaft konfigurierte IPv6-Vertrauensnetze und darüber vertraute X-Forwarded-For-Adressen. |
| @grpc/grpc-js | 1.14.4 → 1.14.6 | Nur Entwicklungsbaum: @iobroker/adapter-dev → @google-cloud/translate → google-gax. CVE-2026-101916 / GHSA-m9gg-hp2v-232j (hoch) und CVE-2026-101915 / GHSA-f596-whhp-79r4 (niedrig). Kein gRPC-Server-/getAuthContext-Aufruf in den geprüften Produktquellen gefunden. |
| follow-redirects | 1.16.0 → 1.16.1 | Nur Entwicklungsbaum: adapter-dev/deepl-node → axios. CVE-2026-111756 / GHSA-q3jh-wrc6-jgq8 und CVE-2026-111755 / GHSA-8r9p-f939-6h3c (hoch); Sonderformen von Headern bei Redirects können Zugangsdaten weitergeben. Die Produkt-Provider verwenden eigene native HTTP(S)-Pfade. |
| source-map-js | 1.2.1 → 1.2.2 | Nur Admin-Buildbaum über postcss. CVE-2026-93749 / GHSA-68fv-2mgg-jv7q: CPU-/Event-Loop-Blockade durch manipulierte Source-Map-Offsets. Kein im Feld laufender Source-Map-Dienst dadurch nachgewiesen. |
| vite | 7.3.6 → 7.3.7 | Admin-Entwicklungsserver/Buildwerkzeug, nicht die ausgelieferte statische Admin-Seite. Audit fasst fünf Advisories zusammen, u. a. CVE-2026-112942 / GHSA-587h-7wmj-h5pm (Windows-Editorstart), CVE-2026-112946 / GHSA-rq7h-c2jc-7f22 (Dev-Dateifreigabe) und CVE-2026-112945 / GHSA-9jrq-w75r-8gcw (Middleware). Direkte Mindestversion auf ^7.3.7 angehoben. |

**Endaudits:** Root einschließlich dev und Admin einschließlich dev: jeweils
Exit 0, keine bekannten Schwachstellen im aktuellen Auditdienst gefunden.
Dies gilt für die dokumentierten Lockdateien und den Abrufzeitpunkt. Es ist
kein Beweis, dass alle Abhängigkeiten fehlerfrei sind oder jede Verwendung
sicher ist. Eine lokale Testdatei oder private Daten wurden nicht übermittelt;
npm audit fragt den Paket-/Versionsbaum beim Auditdienst ab.

## proxy-addr: Betroffenheit und Regression

Der vulnerable Bibliothekspfad wurde lokal auf synthetischen Adressen
reproduziert: 2.0.7 vertraut `203.0.113.10` bei `::ffff:10.0.0.0/8` und `::/1`.
2.0.8 weist beide Fälle zurück. Der korrekte gemappte Bereich `/104` und
`10.0.0.0/8` akzeptieren interne und verwerfen externe Testadressen weiter.

Die **konkrete Ausnutzbarkeit im Adapter wurde nicht nachgewiesen**: Die
Produktsuche fand keine Aktivierung von Express `trust proxy` und keine
Verwendung von `req.ip`/`req.ips` in der geprüften Hauptquelle. Die eigene
Clientadressfunktion liest `req.socket.remoteAddress` beziehungsweise
`req.connection.remoteAddress` (1.0.28: main.ts 12275–12276). Das ist eine
Quellbewertung des gelieferten Standes und keine Prüfung einer unbekannten
Reverse-Proxy-/Zielsystemkonfiguration. Das Patchupdate ist trotzdem erforderlich,
um das verwundbare Paket aus dem Lieferbaum zu entfernen.

Reproduktionskern (lokal, ohne Netzwerk; Altmodul aus unverändertem
1.0.28-Abhängigkeitsbaum, Neumodul aus separater 1.0.29-Installation):

```js
for (const subnet of ['::ffff:10.0.0.0/8', '::/1']) {
  assert.equal(oldProxy.compile(subnet)('203.0.113.10'), true);
  assert.equal(proxyaddr.compile(subnet)('203.0.113.10'), false);
}
assert.equal(proxyaddr.compile('::ffff:10.0.0.0/104')('10.10.1.2'), true);
assert.equal(proxyaddr.compile('::ffff:10.0.0.0/104')('203.0.113.10'), false);
assert.equal(proxyaddr.compile('10.0.0.0/8')('10.10.1.2'), true);
assert.equal(proxyaddr.compile('10.0.0.0/8')('203.0.113.10'), false);
```

Die sechs vorhandenen HTTP-/Parserregressionen bestanden auf dem aktualisierten
Abhängigkeitsbaum: gültiges JSON, Größenlimit, defektes JSON, Query-Verarbeitung
nach Fehlern, präparierter qs-constructor/isBuffer-Fall, ungültiges Parserlimit.
Ein vollständiger Build, Gesamtregression und Feldtest gehören nicht zu diesem
Teilbericht; deren tatsächlichen Status führt der Hauptprüfbericht.

## Änderungen und Vertrauensgrenzen

Nur diese Lockeinträge sowie die direkte Vite-Mindestversion wurden verändert.
Die eigenen ioBroker-/Express-/Mail-/React-Laufzeitverträge bleiben bestehen.
Neue Laufzeitpakete wurden nicht eingeführt. Die installierten npm-Bäume liegen
in separaten Verzeichnissen, nicht in den bisherigen Symlink-Zielbäumen.
Die Installationen erfolgten mit `--ignore-scripts`, ohne Veröffentlichung.
Quellcode-/Lizenzlogik, Gerätezuordnungen und EMS-Regelung wurden in dieser
Teilaufgabe nicht verändert. Die Produkt-SBOM wurde nach dem abschließenden Build für 1.0.29 erzeugt;
der verbindliche Endstand und die Prüfbelege stehen im Hauptprüfbericht.

## Quellen (am 23.10.2026 geöffnet)

- [Hersteller-Advisory proxy-addr](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h)
- [gRPC-Zertifikatsbewertung](https://github.com/advisories/GHSA-m9gg-hp2v-232j)
- [gRPC-Fehlerausgaben](https://github.com/advisories/GHSA-f596-whhp-79r4)
- [follow-redirects Array-Header](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8)
- [follow-redirects Regex](https://github.com/advisories/GHSA-8r9p-f939-6h3c)
- [source-map-js 1.2.2 Herstellerrelease](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2)
- [source-map-js Advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)
- [launch-editor/Vite Windows](https://github.com/advisories/GHSA-587h-7wmj-h5pm)
- [Vite Dateigrenze](https://github.com/advisories/GHSA-rq7h-c2jc-7f22)
- [Vite Middleware](https://github.com/advisories/GHSA-9jrq-w75r-8gcw)
