# Installierte Web-App: Registrierung und Wiederaufnahme

Stand: 22. November 2026, NexoWatt UI 1.0.38. Maßgeblich ist `src-ts/runtime-executables/www/pwa.ts`; Login, Startseite, Historie, Einstellungen, Speicherfarm und Energieherkunft laden denselben Bootstrap nach `runtime-base.js`. Die früheren einzelnen Registrierungen dieser Seiten wurden ersetzt, damit sie keine abweichenden Update-Optionen mehr setzen.

Der Bootstrap registriert den vorhandenen Worker `/sw.js` schon vor der Anmeldung. Er legt keine Sitzung an, verändert keine Rollen oder Anmeldeformulare und speichert keine Zugangsdaten. Die vorhandene serverseitige Authentifizierung und der Schutz privater Seiten/Daten bleiben eigenständige Voraussetzungen. Die Manifestidentität behält `start_url: "."` und `scope: "./"`; die vorhandenen App- und Maskable-Icons werden weiter verwendet.

## Ursprungsgrenze

Eine Registrierung erfolgt nur im obersten Fenster, wenn `NW_RUNTIME` ausdrücklich direkten Betrieb bestätigt und der Browser einen sicheren Kontext meldet. Erlaubt sind HTTPS sowie ausschließlich für lokale Entwicklung HTTP mit `localhost`, `127.0.0.1` oder `[::1]` bei ebenfalls bestätigtem sicherem Kontext. Fernzugriff über HTTP, Frames und der gemeinsame Admin-Proxy sind ausgeschlossen. Der Proxy erhält keinen Worker mit Kontrolle über den gesamten Admin-Ursprung.

Worker-URL und Scope werden absolut aus dem aktuellen eigenen Ursprung aufgebaut. Dadurch verändern weder `/static/login.html`, ein fremdes `base`-Element noch URL-Parameter den Zielworker. Der Scope ist weiterhin die Wurzel des direkten UI-Ursprungs. `updateViaCache: 'none'` verhindert die Verwendung des HTTP-Caches bei der Skriptprüfung durch die Worker-Update-API; dies macht keine Aussage über geschützte Laufzeitdaten oder eine erzwungene sofortige Aktivierung.

## Aktualisierung und Fehler

`pageshow`, erneute Sichtbarkeit und `online` stoßen eine Aktualisierungsprüfung an. Pro Seite gibt es höchstens einen laufenden Browserauftrag und einen zeitlich begrenzten Folgetimer. Wiederholte Ereignisse werden auf einen Versuch je 30 Sekunden zusammengefasst. Verborgene oder als offline gemeldete Seiten beginnen keinen neuen Versuch; beim Verbergen oder Verlassen wird ein geplanter Timer entfernt. Mehrfaches Laden des Bootstraps verdoppelt weder Registrierung noch Ereignisbeobachter.

Fehler bei Registrierung und Update werden abgefangen, ohne Login oder Bedienoberfläche zu überdecken. Ein späteres Wiederaufnahme-/Online-Ereignis darf erneut prüfen. Die Browser-APIs für Registrierung und Update besitzen keinen vom Helfer verwendbaren Abbruchvertrag: Ein hängenbleibender Auftrag wird nicht durch parallele Ersatzaufträge vervielfacht. Die App wird dafür weder blockiert noch automatisch neu geladen. Eine abgelöste Worker-Version wird nach den vorhandenen Worker-/Browserregeln aktiviert.

## Prüfung und Grenzen

`tsconfig.ui-pwa.json` prüft `pwa.ts` und die tatsächliche `runtime-base.ts` mit den strikten Basiseinstellungen einschließlich `exactOptionalPropertyTypes`. `scripts/verify-ui-pwa.cjs` führt diesen Typcheck aus und kompiliert die produktiven Quellen für isolierte VM-Verhaltenstests. Kontrollierte Browserereignisse und Worker-Antworten prüfen insbesondere direkte HTTPS-Registrierung, tatsächliche Proxyerkennung, Frame-/HTTP-Ausschlüsse, absolute URLs, Wiederaufnahme, Fehler, hängende Antworten und Grenzen für parallele Aufträge/Timer. Zusätzlich werden die tatsächliche HTML-Bootreihenfolge, Manifestidentität sowie PNG-Abmessungen der referenzierten Icons geprüft. Das bestehende `scripts/verify-runtime-base.cjs` hält alle sechs HTML-Einstiege nach und führt die direkte/Proxy-/Frame-Grenze des gemeinsamen Bootstraps ebenfalls aus.

Diese Prüfung ersetzt keine Installation auf einem echten Mobilgerät. Das Endgerät muss dem verwendeten HTTPS-Zertifikat vertrauen und den aufgerufenen Host beziehungsweise die IP-Adresse akzeptieren. Ein Wechsel von HTTP zu HTTPS oder ein anderer Host/Port ist ein anderer Browser-Ursprung; der Bootstrap überträgt keine bestehende App-Installation oder Cookies zwischen diesen Ursprüngen.

Primärreferenzen, am 22. November 2026 geprüft:

- [MDN: ServiceWorkerContainer.register und Scope](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)
- [MDN: updateViaCache](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/updateViaCache)
- [MDN: ServiceWorkerRegistration.update](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/update)
