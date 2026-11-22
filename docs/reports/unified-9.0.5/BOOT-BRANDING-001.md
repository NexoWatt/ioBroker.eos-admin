# BOOT-BRANDING-001 – NexoWatt EOS Startanzeige

Stand: 22.11.2026. Geltung: EOS-Admin-Frontend unter `/system/`.

## Befund und Änderung

Die Anmeldung verwendete bereits NexoWatt-Grafiken. Der anschließende
React-Startpfad in `App.tsx` nutzte jedoch weiterhin den unveränderten `Loader`
aus `@iobroker/gui-components`. Ohne einen unterstützten Herstellerpräfix wählt
dieser den ioBroker-Community-Loader. Die HTML-Wurzel blieb bis zum React-Start
leer. Ein zweiter Aufruf des gleichen Fremd-Loaders lag im Dokumentationsdialog.

Ein kleiner lokaler `EosLoader` ersetzt diese beiden Aufrufe. Er verwendet die
bereits vorhandene Grafik `img/eos/nexowatt-eos-brand-wide.png` (1200 × 342).
Die HTML-Startanzeige vor dem Laden der JavaScript-Bundles, der React-Start,
der Verbindungswartebildschirm und der Dokumentationsladezustand zeigen damit
dieselbe EOS-Grafik. HTML und React teilen eine lokale CSS-Datei. Die Anzeige
besitzt einen Status für Hilfstechnologien, eine feste Bildproportion und
berücksichtigt reduzierte Animationen. Bestehende übersetzte Lade- und
Verbindungstexte bleiben im React-Pfad erhalten.

Keine Änderung an Anmeldung, Lizenzprüfung, Rechten, Backend, Ports,
Drittanbieter-Lizenzhinweisen oder dem getrennten ioBroker Admin.
Keine neue Abhängigkeit und kein externer Grafikabruf.

## Geänderte Quellen

- `src-admin/index.html`
- `src-admin/public/css/eos-boot-loader.css`
- `src-admin/src/components/EosLoader.tsx`
- `src-admin/src/App.tsx`
- `src-admin/src/components/Markdown.tsx`

## Durchgeführte Prüfung

- `npm run check-ts` in `src-admin`: Exit 0.
- Echter React-Server-Render (`react-dom/server`) des neuen Bausteins, normal
  und kompakt: erwartete EOS-Grafik und Statusattribute, korrekte Maskierung
  von Textinhalten. Exit 0.
- HTML-Startmarkup, eingebundene CSS-Datei, PNG-Abmessungen und lokale
  Pfadauflösung von `/system/` sowie `/system/index.html`: erfolgreich geprüft.
- Vorhandene Grafik visuell angesehen; vorhandene NexoWatt-EOS-Wortbildmarke
  mit Unterzeile „Energy Operation System“, keine neu erzeugte Grafik.
- Headless-Chromium-Start versucht. In dieser Ausführungsumgebung beendet
  Chromium bereits vor dem Seitenaufruf mit
  `socket() failed: Operation not permitted`. Deshalb liegt hier **kein**
  Browser-Screenshot und **kein** Nachweis eines kompletten Frontend-Starts
  oder einer Anmeldung am Kundengerät vor.

Der abschließende Frontend-Build und seine Quellen-/Artefaktprüfung werden
zusammen mit den weiteren Änderungen von 9.0.5 ausgeführt. Die oben genannten
Ergebnisse beziehen sich auf die geänderten Quellen und den React-Baustein.
