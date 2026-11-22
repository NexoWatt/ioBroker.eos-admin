# Automatische Produkt-SBOM und Veröffentlichungsprüfung

Stand: 29.09.2026, NexoWatt UI 1.0.22. Die SBOM ist ein nachvollziehbares Inventar und Integritätsnachweis; sie bestätigt keine CRA-Konformität und ersetzt keine Sicherheits- oder Anlagenprüfung.

## Automatischer Ablauf

1. `npm run release:generate-manifest` führt zuerst `npm run sbom:cra:release` aus. Das vorhandene Release-Versiegelungsverfahren erzeugt danach sein Dateimanifest. Die SBOM entsteht damit automatisch **vor** der bewussten Versiegelung des Releasekandidaten.
2. Die SBOM-Erzeugung liest Root-/Admin-Lockfiles, Paketdateien und den archivierten Rollup-Buildnachweis. Sie installiert keine Pakete, baut keine Produktquellen und verändert keine Freigabeentscheidung.
3. `npm run publish:check` und damit der vorhandene npm-Veröffentlichungsweg rufen den SBOM-Verifier auf. Diese Prüfung arbeitet ausschließlich mit Node-Bordmitteln: kein npm-Unterprozess, kein Netz, kein Build und keine Neugenerierung/Versiegelung. Eine frische vollständige Repository-ZIP benötigt zum Veröffentlichen deshalb keine `node_modules` und keine bestimmte npm-Minorversion für dieses Gate.
4. Fehlende oder veränderte Inventare, Quellen, Lockfiles oder Paketdateien blockieren die Veröffentlichung. Nach einer sachlichen Änderung müssen Build, passende Prüfungen und Release-Versiegelung bewusst erneut erfolgen. Das Veröffentlichungs-Gate repariert oder überdeckt einen veränderten Stand nicht.

`npm run sbom:check` führt dieselbe schreibfreie Kontrolle separat aus.
`npm run test:sbom` prüft die Automatik mit synthetischen, temporären Repositories.
Die Erzeugung selbst benötigt ein npm mit `npm sbom`-Unterstützung; die veröffentlichte Prüfung benötigt nur das deklarierte Node.js ≥22. Die Windows-Ausführung des Generators nutzt den von `npm run` bereitgestellten JavaScript-CLI-Pfad ohne Shell-Konkatenation. Die hier protokollierten Tests liefen auf Linux, nicht auf einem echten Windows-System.

## Was im npm-Paket enthalten ist

| Datei | Zweck |
| --- | --- |
| `release-manifests/sbom-product.cdx.json` | CycloneDX 1.5: NexoWatt-Produkt, Root-Produktionsreferenz und tatsächlich zum Admin-JavaScript beitragende Pakete. |
| `release-manifests/sbom-product-evidence.json` | SHA-256 der Produkt-SBOM sowie Hash/Größe jeder anderen expliziten Paketdatei und der automatisch von npm beigefügten `package.json`; zusätzliche Quell-/Lockfilebezüge. |
| `release-manifests/admin-bundle-components.json` | Nachweis aus dem tatsächlichen Rollup-Buildgraphen: gerenderte npm-Module, Quellbezüge und finale Assethashes. |
| `scripts/verify-cra-sbom.cjs` | Abhängigkeitsfreie, schreibfreie Kontrolle der ausgelieferten Nachweise. |

Die Produkt-SBOM und ihr Evidence-Dokument sind von ihrer eigenen Paketdateiliste ausgenommen, um eine unmögliche Hash-Selbstreferenz zu vermeiden. Die Evidence-Datei bindet die SBOM; die später bewusst erzeugte Release-Versiegelung bindet beide Dateien zusätzlich an das geprüfte Artefakt. Diese Mechanik ist kein digital signierter Herkunftsnachweis.

## Quellen, frische ZIP und bereits vorbereitetes npm-Paket

Im vollständigen Repository prüft der Verifier zusätzlich sämtliche aufgezeichneten Quell-/Lockfilehashes. Änderungen an Root-`package.json`, Root-Lockfile, Admin-Konfiguration, Admin-Einstiegsdokument oder verwendeten Admin-Quellen bleiben nicht unbemerkt. Unvollständige vorhandene Quellverzeichnisse werden nicht als fertiges Laufzeitpaket akzeptiert.

Eine frische ZIP ohne Entwicklungsabhängigkeiten kann den unveränderten archivierten Admin-Buildgraphen nutzen. Der Generator gleicht dessen Versionen mit dem Admin-Lockfile ab und verlangt passende Quellen und Assets. Sobald ein lokaler Admin-`node_modules`-Baum vorhanden ist, müssen auch die aufgezeichneten gerenderten Module zu diesem Baum passen. Ein unvollständiger oder veränderter Baum wird nicht stillschweigend übernommen.

Ein vorbereitetes npm-Laufzeitpaket enthält keine TypeScript-/Admin-Quellbäume. Dort bleiben die SBOM-, Buildnachweis- und sämtlichen Paketdatei-Hashes Pflicht; nicht enthaltene Quellbelege werden ausdrücklich nicht als erneut geprüft ausgegeben. Ein später durch Installation angelegtes Root-Lockfile macht dieses Paket nicht nachträglich zu einem vollständigen Quellrepository.

## Grenzen zum Live-System

Die Root-Abhängigkeiten sind **der für das Release aufgelöste Referenzbaum aus dem Lockfile**. Ein ioBroker-Host kann npm-Semverbereiche später anders auflösen; diese SBOM gibt deshalb nicht vor, den tatsächlichen Live-Bestand des Kunden zu kennen. Die im Browser gebündelten npm-JavaScript-Pakete sind dagegen durch den aktuellen Buildgraphen und die ausgelieferten Assethashes belegt.

Die Produkt-SBOM inventarisiert nicht automatisch andere ioBroker-Adapter, Controller, Node-Laufzeit, Betriebssystem, Hardware oder Firmware. Eine vollständige Anlagen-/Geräte-SBOM muss am tatsächlich installierten System erfasst werden. Das Gate führt keinen aktuellen Advisory-Scan aus; die getrennten Audit-/CI-Prüfungen bleiben erforderlich.

Die vorhandenen sieben Inventare und `sbom-index.json` beschreiben getrennte Quell-/Prüfumgebungssnapshots. `npm run sbom:cra -- --require-installed` aktualisiert diese weiterhin und erzeugt zusätzlich die Produkt-SBOM. Der automatische `--release`-Modus schreibt ausschließlich Produkt-SBOM und Produkt-Evidence; er macht alte installierte Snapshots nicht durch neue Zeitstempel scheinbar aktuell.

## Ausgeführte Nachprüfungen

`scripts/verify-cra-sbom-regressions.cjs` führt 17 Prüfgruppen aus: echte Offline-Erzeugung ohne beide Dependencybäume; unverändertes Artefaktmanifest; automatisch enthaltene `package.json`; klare Live-Inventar-Abgrenzung; schreibfreie Kontrolle ohne npm auf PATH; geänderte Root-Abhängigkeiten; geändertes Lockfile; geänderte Admin-Assets/-Quellen; manipulierte oder fehlende SBOM; fehlende Hashzeile; fehlender Buildnachweis; unvollständiger Admin-Dependencybaum; vorbereitetes npm-Paket ohne Quellen; unvollständiges Quellrepository; ungültige Pfade und Graphreferenzen.

Rohbelege: `docs/reports/cra-2026-09-29/sbom-automation-regressions.log` und `.execution.json`. Es wurde kein echtes Paket veröffentlicht und kein Kundensystem angesprochen. Den tatsächlichen npm-Pack-/Extraktionsnachweis und weitere Releaseprüfungen führt der zentrale Prüfbericht.

Formatquellen: [npm sbom](https://docs.npmjs.com/cli/v11/commands/npm-sbom/) und [CycloneDX 1.5 JSON](https://cyclonedx.org/docs/1.5/json/), geprüft am 29.09.2026.
