# Geräte und EEBus im EOS-Design

Stand: 23.11.2026. Ausgangspunkt: ausgeliefertes vollständiges Repository 9.0.6. Zielstand: 9.0.7, interne Prüfung; keine Geräte- oder Produktionsfreigabe aus dieser Darstellungskorrektur.

## Änderung und Ursache

Die Geräteansicht hatte trotz vorhandener dunkler CSS-Regeln einen weißen Reiterbereich und uneinheitliche Bedienelemente. Das lokal ausgelieferte Materialize verwendet spezifischere Selektoren wie `.m .tabs`, die mehrere bisherige EOS-Regeln überstimmten. Die neuen, auf den Geräteeditor begrenzten Regeln berücksichtigen diese Kaskade.

Geräte und EEBus verwenden die gemeinsame lokale Datei `modules/shared/eos-module.css`: vorhandenes NexoWatt-Logo, dunkelblaue/türkise Flächen, grüne Akzente, einheitliche Navigation, Seitenkopf, Formulare, Schaltflächen und Tastaturfokus. Die Navigation bietet Dashboard, Installer, Administration, Geräte, EEBus, Sicherung und Zertifikate. Aktive Seiten sind über `aria-current` gekennzeichnet. Keine externen Bilder, Schriften, Stylesheets oder zusätzlichen Laufzeitpakete werden geladen.

Der Geräteeditor behält seine Tabs, Import-/Exportaktionen und Herstellerformulare. Die breite Gerätetabelle scrollt bei wenig Platz innerhalb ihres Bereichs; keine Spalte wird verborgen. Der Dialog erhält lesbare Feldbeschriftungen über den Eingaben sowie eine deutlich abgesetzte Aktionsleiste. Der EEBus-Status und die Geräteliste stehen auf breiten Ansichten nebeneinander; kleine Ansichten verwenden eine Spalte. Die neue Zertifikatsseite verwendet dieselbe Navigation und Darstellung sowie zwei nebeneinanderliegende Schritte für Anfrage und Import auf breiten Ansichten. Versteckte Downloadlinks bleiben durch eine explizite `[hidden]`-Regel verborgen; die Freigabe erfolgt weiterhin ausschließlich durch ihre vorhandene Zustandslogik. Technische EEBus-Teststandhinweise und Kopplungsprüfungen bleiben sichtbar.

## Funktions- und Sicherheitsgrenzen

Alle 160 bestehenden Geräte-DOM-IDs sowie alle 10 EEBus-DOM-IDs, Elementtypen und funktionalen Attribute wurden gegen das unveränderte 9.0.6-Repository-ZIP verglichen und erhalten. Neu ist je eine Seitenüberschrift-ID. Konfiguration, Gerätetreiber, Datenpunktnamen und Kopplungsvorgänge werden durch diese Darstellungskorrektur nicht geändert. Die Speichersitzungs-Korrektur und automatische Bestandsmigration werden separat geprüft.

Das gemeinsame CSS wird über eine feste, authentifizierte Modulroute ausgeliefert; keine frei wählbare Dateiauslieferung. Anmeldestatus und Fehlermeldungen behalten ihre Live-Region. Das Wiederanmelden aus dem Gerätestatus bleibt ein sichtbarer Link. Die Benutzeroberfläche ist keine zusätzliche Rechteinstanz; die serverseitigen Prüfungen gelten weiterhin.

## Durchgeführte Prüfungen

- HTMLParser: geschlossene, korrekt verschachtelte Elemente in Geräte-, EEBus- und Zertifikatsseite; keine doppelten IDs; Vergleich der bisherigen IDs, Elementtypen und funktionalen Attribute mit 9.0.6 bestanden.
- PostCSS aus dem vorhandenen Frontend-Build: gemeinsames CSS, Geräte-CSS und EEBus-CSS ohne Parserfehler verarbeitet (67 / 183 / 31 Regeln).
- Kontrastberechnung für die festgelegten, deckenden Flächen: Standardtext 16,08:1; Nebeninformationen 9,65:1; Hauptschaltfläche 9,26:1; Fehlermeldung 9,57:1; aktive Navigation 10,96:1. Dies ist eine Farbpaarprüfung, keine vollständige Barrierefreiheitsabnahme.
- `node --test test/eos-module-http.test.cjs test/eos-module-editor-session.test.cjs`: 8 Prüfungen bestanden. Abgedeckt sind authentifizierte Assets, frische Rechte/CSRF, Sitzungswechsel und Erhalt ungespeicherter Formularwerte. Diese Tests prüfen keine Darstellung.
- Vorhandener Browsercheck `node --test modules/devices/checks/hostedEditor.check.js` mit den neuen lokalen Assetpfaden aktualisiert und aufgerufen. Chromium konnte in dieser Ausführungsumgebung wegen `socket() failed: Operation not permitted` nicht starten. Rohbeleg: `module-design-browser-blocked.log`. Das Ergebnis ist **blockiert**, kein bestandener visueller Nachweis.

## Noch am Zielsystem prüfen

Nach dem Update Geräte und EEBus mit einem angemeldeten Administrationskonto öffnen. Bei breitem und schmalem Browserfenster Navigation, Reiter, Herstellerformular, Dialogspeichern, Übernehmen sowie EEBus-Felder prüfen. Im Geräteeditor insbesondere FENECON öffnen, ohne Zugangsdaten oder Modellparameter ungewollt zu ändern. EEBus-Kopplung nur mit der vorgesehenen Gegenstelle und Fingerabdruckabgleich prüfen. Eine reale Browser-/Touch-Bedienprüfung bleibt bis dahin offen.
