# Sicherheitsprüfung der SmartHome-Bedienoberflächen 9.0.9

Stand: 23.11.2026. Geprüft wurde das UI-Differenzbild gegen die 9.0.8-Quelle, einschließlich der drei neuen Darstellungs-/Interaktionshelfer und ihrer Einbindung. Dies ist eine begrenzte Änderungsprüfung, keine vollständige Sicherheits-, Anlagen- oder CRA-Freigabe.

## Umfang und bestehende Bewertungen

Die historische Scanner-Baseline `ui/docs/security/eslint-legacy-baseline.json`, die Scannerregeln und deren Herkunft bleiben unverändert. Der vorherige Prüfstand ist in [9.0.8 SECURITY_DELTA_REVIEW.md](../unified-9.0.8/SECURITY_DELTA_REVIEW.md) und dessen `raw/ui-security.json` dokumentiert. Historische offene Fundstellen werden durch diese Prüfung nicht pauschal freigegeben.

Für `www/smarthome.ts` existiert genau eine individuelle Scannerbewertung: die feste `up/stop/down`-Map im Beschattungs-ARIA-Label, Fingerprint `52036a960bd4a11ad596627a728fe5400f4c94c8e8d4aa6e47d5fe0d2d123625`. Die unveränderte Fundstelle und sämtliche drei Aufrufe wurden nachgelesen: ausschließlich feste Aktionsliterale, Ausgabe durch `setAttribute('aria-label', ...)`, keine dynamische Objektmutation. Vorhandene Schreib-, Zuordnungs- und Bewegungssperren bleiben wirksam; ein zugeordneter Stopp benötigt weiterhin keine Bewegungsfreigabe. Nur der geprüfte Gesamtdatei-Codehash und ein ergänzender Reviewvermerk wurden aktualisiert. Fingerprint, Anzahl, ursprüngliche Begründung und Beleg bleiben erhalten.

Der erste offizielle Gate-Lauf stoppte erwartungsgemäß an diesem veränderten Gesamtdatei-Hash. Eine separate, nur lesende Inventarisierung identifizierte anschließend genau einen neuen Scannerhinweis. Sie wurde nicht als erfolgreicher Gate-Lauf ausgegeben.

## Neue Einzelbewertung

| Quelle / Fingerprint | Anzahl | Bewertung |
| --- | ---: | --- |
| `www/smarthome-presentation.ts` / `3c0685158876e40604804f05528117f91dcfce4408a7f8d81d94cb5f4ad9cd6e` | 1 | `fieldUsable` liest `fields[field]`. Alle zwölf Aufrufstellen verwenden feste `StateField`-Literale: `on`, `level`, `position`, `currentTemp`, `setpoint`, `title`, `artist`, `playing`, `power`, `source`, `muted`. Gerätedaten wählen keinen Schlüssel. Der Zugriff verändert weder Objekt noch Prototyp und begründet keine Schreibberechtigung. Sein Ergebnis begrenzt ausschließlich die Darstellung vorhandener Rückmeldungen. |

Die neue Bewertung ist auf genau diese Fundstelle, Anzahl und den überprüften Gesamtdatei-Codehash begrenzt. Es wurden keine allgemeinen Regel-Ausnahmen, Typunterdrückungen oder Parser-Ausnahmen ergänzt.

## Geprüfte Daten- und Bediengrenzen

- **DOM-Ausgabe:** Die neuen Helfer erzeugen Elemente über DOM-Methoden und schreiben Geräte-/Medientexte ausschließlich mit `textContent`. Keine neuen HTML-Sinks, dynamische Skripte, URL-Navigationen oder Medienabrufe. Beschattungs-CSS erhält ausschließlich eine endliche Position von 0 bis 100; unbekannte oder ungültige Rückmeldung wird nicht als bestätigte Null ausgegeben. Die neue CSS-Datei lädt keine externen Ressourcen.
- **Befehlsgrenze:** Die vorhandenen neun SmartHome-POST-Routen und Nutzdaten bleiben erhalten. Der Helfer verwendet die vorhandene globale `fetch`-Anbindung mit deren Auth-/CSRF-Verhalten. Es kommen weder Backend-Routen noch Geräteerkennung, Adapterinstanzen, Protokollzugriffe oder zusätzliche Bibliotheken hinzu. Rechte, Lizenz und Aktorschutz werden weiterhin serverseitig geprüft.
- **Eingabeabsicht:** Der Touch-Helfer verzögert Range-Schreibereignisse bis zum bewussten Abschluss. Vertikales/diagonales Scrollen, vorangegangenes Scrollen, Pointer-Abbruch, Mehrfingerwechsel, entfernte/deaktivierte Elemente, Fokusverlust und Seitenwechsel verwerfen die ausstehende Eingabe. Tastatur/Maus behalten die vorhandenen Ereignisse. Die synthetische abschließende `input`-/`change`-Folge erzeugt keinen zusätzlichen Live-Preview-Schreibvorgang; eine im `input`-Handler entzogene Freigabe verhindert `change`.
- **Ressourcen und Fehler:** Feste Routen-Allowlist, begrenzte Geräte-ID und Nutzdaten, begrenzte Antwortverarbeitung, fünf Sekunden Deadline samt tatsächlichem Abort, begrenzte ausstehende Anfragen und Statusspeicher. Fehler liefern feste Meldungen ohne Antwort-/Konfigurationsinhalte. Es gibt keine automatische Befehlswiederholung. Seitenwechsel bricht noch ausstehende Browseranfragen ab; dies ist keine Rücknahme bereits serverseitig angenommener Befehle.
- **Rückmeldung:** Druckdarstellung bestätigt die Eingabe. „An EOS übergeben“ bestätigt ausschließlich eine erfolgreiche API-Antwort, keine physische Aktorausführung. Der dargestellte Gerätezustand stammt weiterhin aus der Rückmeldung; der Helfer erzeugt keine optimistischen Gerätewerte. Ältere Antworten dürfen neuere Befehlsmeldungen nicht überschreiben.
- **Lebenszyklus:** Einmalige globale Listener, `WeakMap` für Range-Bindungen, begrenzte `Map`-Einträge für Status und Anfragen sowie ein gemeinsamer Status-Aufräumtimer. Während einer Touch-Interaktion wird das betroffene Kachel-DOM nicht durch Polling neu erstellt. Helper-Skripte werden vor `smarthome.js` geladen.

Zwei im zusätzlichen Code-Review gefundene Randfälle wurden korrigiert und erneut geprüft:

1. Stopp-Anfragen verwenden einen eindeutigen Sequenzschlüssel. `STOPP → AB → STOPP` erzeugt auch bei noch offener erster Antwort drei Fetch-Aufrufe. Ältere Fehler überschreiben die neueste Stopp-Rückmeldung nicht. Normale Anfragen bleiben auf 48 ausstehende Vorgänge begrenzt; Stopp kann die reservierte Kapazität bis insgesamt 64 nutzen.
2. Normale Antworten sind beim Streaming auf 128 KiB begrenzt, vollständige Timer-Antworten auf 1 MiB. Eine Fixture mit 2.200 Timern oberhalb von 128 KiB wird vollständig angenommen; über 1 MiB wird der Stream abgebrochen. Die zusätzliche Kapazität umfasst den bestehenden Übernahmevertrag von 512 KiB je gesichertem UI-State samt Antwortumschlag. Der Backend-Timerbestand selbst hat keine entsprechende Größenobergrenze: Antworten über 1 MiB bleiben eine ausdrücklich bekannte UI-Grenze und können trotz bereits erfolgter Speicherung als unbestätigt erscheinen. Es erfolgt keine automatische Wiederholung.

## Ergebnis und Grenzen

Der offizielle Gate-Lauf wurde nach den gezielten Einzelbewertungen und den Feedback-Korrekturen mit Exitcode 0 abgeschlossen:

```sh
NEXOWATT_LINT_REPORT=/workspace/scratch/741f792566ea/setup-909/ui-security.json node ui/scripts/verify-eslint-security.cjs
```

| Messgröße | Ergebnis |
| --- | ---: |
| Geprüfte Quellen | 193 |
| Aktuelle Scannerfundstellen | 3.104 |
| Historische offene Fundstellen | 2.955 |
| Individuell bewertete aktuelle Fundstellen | 149 |
| Unbewertete neue oder verbotene Fundstellen | 0 |
| Früher inventarisierte, derzeit abwesende Fundstellen | 108 |

Nach Ende des Laufs wurden sämtliche gespeicherten Review-Codehashes erneut mit den aktuellen Quellen verglichen: keine Abweichung. Rohdaten: `raw/ui-security.json`, Ausgabe: `raw/ui-security.log`.

Die drei Helfer wurden nach dem abschließenden Quellreview gemeinsam unter Node.js 24.22.3 ausgeführt:

```sh
node --test ui/test/unified/smarthome-feedback.test.cjs ui/test/unified/smarthome-touch.test.cjs ui/test/unified/smarthome-presentation.test.cjs
```

**26 Tests bestanden**, keine Fehler oder übersprungenen Tests. Sie prüfen unter anderem Textausgabe mit HTML-artigen Metadaten, keine zusätzlichen Bildanforderungen, ungültige Gerätedaten, Schreibschutz, Qualitätszustände, Scroll-/Abbruch-/Mehrfingerfälle, HTTP-/JSON-/Netzwerkfehler, wirklichen Abort, Ressourcenbegrenzung, wiederholten Stopp und große Timer-Antworten. Rohprotokoll: `raw/ui-security-behavior.log`. Diese DOM-Fixtures sind kein visueller Browser- oder Hardware-Nachweis.

Die zusätzlich bereitgestellten aktuellen Audit-Rohdaten wurden mit 9.0.8 abgeglichen: Runtime-Abhängigkeiten ohne gemeldete Schwachstelle; vollständiger Entwicklungsbaum mit 14 moderaten Hinweisen. Paketnamen, Schweregrade, betroffene Bereiche und Advisory-Referenzen dieser Hinweise sind in der geprüften Projektion identisch zum 9.0.8-Bestand. Diese Altbefunde werden dadurch nicht aufgehoben; der UI-Umbau fügt keine Abhängigkeit hinzu.

Die visuelle Browserabnahme bleibt offen. Der lokale Chromium-Prozess konnte nicht starten; der anschließende Cloud-Browser-Zugriff scheiterte, weitere Umgehungswege wurden durch die Sicherheitsprüfung untersagt. Es wurden danach keine alternativen Browserzugriffe versucht. Native Touch-Ereignisreihenfolge, Darstellung auf realen Endgeräten und physische Aktorbestätigung sind hier nicht abschließend nachgewiesen.

Eine erfolgreiche Scanner-Regressionsprüfung bedeutet ausschließlich, dass keine unbewerteten neuen oder verbotenen Scannerfundstellen verbleiben. Die bestehenden offenen Scannerhinweise und die Grenzen des vorherigen Prüfstands gelten fort.
