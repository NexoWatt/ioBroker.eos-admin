# Gezielte Zweitprüfung der React-Proxyverknüpfungen

Datum: 03.11.2026. Verglichen wurden die abschließenden Quellen von NexoWatt UI 1.0.35 mit 1.0.34. Die Prüfung erfolgte in einem vom Implementierungsarbeitslauf getrennten KI-Arbeitslauf. Sie ist keine externe Zertifizierung oder vollständige Dateisicherheitsprüfung.

## Geprüfte Änderung und Schutzgrenzen

`DynamicGridPage.tsx`, `MeshCoordinatorPage.tsx` und `NotificationMailPage.tsx` ergänzen bei bestehenden lokalen Links ausschließlich den von `getRuntimeProxyBase()` validierten Ursprung und Instanzpfad. `EmbeddedEmsFrame.tsx` verwendet denselben Bezug für das dynamisch eingefügte Stylesheet. `dataPointPicker.ts` verwendet ihn für das vorhandene lokale Popupziel. Im direkten Runtimebetrieb bleibt der bisherige Rootpfad bestehen. Es werden keine fremden Zieladressen aus Queryparametern, Formularen oder Konfiguration übernommen.

Die bestehende PostMessage-Prüfung des Datenpunktdialogs auf Ursprung, konkretes Gegenfenster, Auftragskennung und begrenzte JSON-Werte bleibt gleich. Das Stylesheet bleibt eine feste lokale Ressource. Die Iframe-Höhenmeldung und ihr Zielursprung bleiben gleich. Die Links ändern weder eine Rolle noch die Rechte für Konfigurations- oder Geräteschreibzugriffe.

`App.tsx` entfernt vor der bestehenden Microgrid-Pfadentscheidung ausschließlich den validierten Proxy-Instanzpfad. Die Grenze wird mit einem abschließenden Slash geprüft. Die bestehenden React-Routen und `ProtectedRuntimeRoute`-Capability-/Rollenangaben bleiben unverändert.

Für alle sechs Dateien wurde zusätzlich der kommentarfrei gedruckte TypeScript-AST mit 1.0.34 verglichen, nachdem ausschließlich die deklarierten URL-Präfixänderungen, ihre Imports und die beschriebene Microgrid-Pfadnormalisierung im Vergleich rückgängig gemacht wurden. Ergebnis: vollständige AST-Gleichheit. Somit wurden in diesen Dateien keine weiteren Funktionen, Schutzbedingungen, Indexprüfungen, Konfigurationsmutationen oder Datenflüsse verändert.

## Bestehende ESLint-Einzelbewertungen

Die tatsächliche ESLint-Ausführung mit der vorhandenen Projektkonfiguration und der tatsächlichen Fingerprintfunktion aus `scripts/verify-eslint-security.cjs` bestätigt für alle sechs Dateien: keine neue oder in der Häufigkeit erhöhte Fundstellenkennung. Die sechs bestehenden Einzelbewertungen in `DynamicGridPage.tsx` und die 19 in `MeshCoordinatorPage.tsx` besitzen weiterhin jeweils dieselbe Kennung und Vorkommenszahl. Die begrenzten internen Schlüssel, Literal-Unionen, Schema-Decoder und lokalen Indexprüfungen sind von den Linkänderungen nicht betroffen. Die übrigen vier Dateien enthalten keine bestehenden Reviewed-Einträge.

Die vollständigen AST-Bindungen dürfen nach diesem gezielten Review wie folgt aktualisiert werden:

| Datei | AST-SHA-256 in 1.0.34 | AST-SHA-256 im geprüften 1.0.35-Stand |
| --- | --- | --- |
| `src-admin-tab/src/pages/DynamicGridPage.tsx` | `bc68abf463077f450969571d99ff2eea85a683d85f02a998eeed62e84f36d2f2` | `fb861b918aba1153ad482c27288f7967cd8dcf82e30acf73d055523da0f7d3db` |
| `src-admin-tab/src/pages/MeshCoordinatorPage.tsx` | `ee04a5fd3d5a009f343a0b19abc6a2aa4e6f31b6cf62434b9053d6157797da1b` | `c1b3e565bc760b75ffa1d8eb5d874b3d3b4bbf98e4b99bede76fd004b643bc4c` |

Der maschinenlesbare Beleg `react-proxy-link-review-evidence.json` enthält alte und neue Roh-/AST-Hashes aller sechs Dateien sowie jede der 25 vorhandenen Fundstellenkennungen und ihre bestätigte Vorkommenszahl. SHA-256 des JSON-Belegs: `b4833ae4305caccdc29a1d5c24410e6f0020b752cc09b140e372a899be925dd6`.

Aus diesem begrenzten Review bleibt kein konkreter offener Befund. Die ausgeführten Komponenten-, Typ-, Browser- und Releaseprüfungen werden zusätzlich in den jeweiligen Prüfbelegen ausgewiesen. Weder ein Kundenanlagentest noch vollständige ASVS-/CRA-Erfüllung wird daraus abgeleitet.
