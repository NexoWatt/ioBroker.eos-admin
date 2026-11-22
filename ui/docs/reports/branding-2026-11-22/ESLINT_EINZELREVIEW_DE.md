# ESLint-Einzelreview – Branding, HTTPS und PWA 1.0.38

Stand: 22.11.2026. Geprüft wurde der Arbeitsstand NexoWatt UI 1.0.38 gegenüber dem tatsächlich ausgelieferten Quellstand 1.0.37. Der abschließende Vollscan nach den HTTPS-/PWA- und Lifecycle-Änderungen steht im Abschnitt **Abschlussreview HTTPS/PWA**. Die ersten Abschnitte halten den früheren reinen Branding-Zwischenstand fest.

## Ergebnis des reinen Branding-Zwischenstands

`npm run lint:security` endet nach gezielter Neubindung der vorhandenen Einzelreviews mit **Exit 0**. Der erste Aufruf hatte die geänderte Code-Hashbindung korrekt abgewiesen: `Reviewed source changed; re-review required: src-admin-tab/src/lib/adminConnection.ts`.

| Gate-Ergebnis | Anzahl |
|---|---:|
| Geprüfte maßgebliche Runtime-/Adminquellen | 181 |
| Aktuelle Scannerbefunde | 3097 |
| Weiterhin offene historische Befunde | 2957 |
| Bereits individuell bewertete Vorkommen | 140 |
| Neue oder verbotene blockierende Befunde | 0 |
| Nicht mehr vorhandene frühere Befunde | 103 |

Dies ist ein Regressionsnachweis. Die historischen Befunde bleiben offen; das Ergebnis behauptet weder einen befundfreien Sicherheitsscan noch vollständige ASVS-/CRA-Konformität. Es erfolgte hier keine Browser-, Geräte- oder Hardwareprüfung.

## Genau begrenzte Neubindung im Branding-Zwischenstand

Nur **16 bestehende Review-Einträge für 17 Vorkommen** hatten eine ungültig gewordene Hashbindung. Reale ESLint-Neuerfassung bestätigte für jeden Eintrag denselben Regel-Fingerprint und dieselbe Anzahl. Die betroffenen Quellen unterscheiden sich von 1.0.37 ausschließlich durch die ausdrücklich geprüften festen Anzeigetexte. Zusätzlich blieb ihr TypeScript-Syntaxbaum außerhalb der Stringliterale identisch.

| Quelle | Einträge / Vorkommen | Erneut geprüfter Zugriff und unveränderte Schutzgrenze |
|---|---:|---|
| `src-admin-tab/src/lib/adminConnection.ts` | 1 / 1 | `copyJsonValue`: Schreiben in ein neues Dictionary ohne Prototyp; `__proto__`, `prototype` und `constructor` werden zuvor verworfen. Tiefen- und Knotenbudget bleiben wirksam. Geändert wurden nur zwei sichtbare Proxy-Fehlermeldungen. |
| `src-admin-tab/src/pages/DynamicGridPage.tsx` | 6 / 7 | `textLabels` kopiert lokale Anzeige-Dictionaries in ein eingefrorenes Objekt ohne Prototyp. Die übrigen Fundstellen verwenden das Literal `readbackStateId`, intern gebildete Import-/Export-Limitnamen, eine konstante Command-Liste beziehungsweise die Union `points`/`storages`/`pvAssignments`. Die Antwortprüfung durch `parseDynamicGridResponse` bleibt erhalten. Geändert wurde nur der Datenpunkthilfetext. |
| `src-ts/runtime-executables/lib/smarthome-import.ts` | 9 / 9 | `common`, Aliasauflösung und Enumzuordnung lesen Metadaten; Alias-Kettenlimit und Zyklenerkennung bleiben erhalten. `sourceValues` und Herkunftsnormalisierung schreiben begrenzte skalare Werte in Dictionaries ohne Prototyp, nach Feldfamilien-, Längen- und Prototypschlüsselprüfung. `valueAt` und der Herkunftsabgleich lesen nur zuvor geprüfte Pfade zum Vergleich. Geändert wurde nur ein Alias-Prüfhinweis. |

In `docs/security/eslint-reviewed-findings.json` wurden ausschließlich `sourceCodeSha256` und der datierte `review`-Vermerk dieser Einträge aktualisiert. Regeln, Fingerprints, Anzahlen, bestehende Begründungen und ursprüngliche Belegverweise blieben unverändert. Es wurden keine Ausnahmen ergänzt oder erweitert und keine Produktdateien für diesen Review geändert.

## Hashbindung im Branding-Zwischenstand

Die unveränderliche Datei `docs/security/eslint-legacy-baseline.json` ist bytegleich zum ausgelieferten Stand 1.0.37. SHA-256:

`c7fd7ea7039fdfff2c3f7e00abcbc00b76f4984c1f612edcf73bddaf62d8a3b9`

Neue Code-Hashes nach der vorhandenen Gate-Methode `codeSha256` (TypeScript-Druck ohne Kommentare, keine Rohdatei-Hashes):

- `adminConnection.ts`: `efc16f81b96bb19d0fe6ba05f97b487750e4832bd5f4fe87c6e4c738e9ccc5c4`
- `DynamicGridPage.tsx`: `b45dcb17f680544a57aeeb425368e31509b89b92c809caab82a94cc0a5516ee9`
- `smarthome-import.ts`: `5b55eff43ed643529251e30c0d1f10afd59c9529e96201f4d1d397e1a3ea0283`

Die vorhandenen Regeln, der Gate-Code und die unveränderliche Baseline wurden für das Branding nicht abgeschwächt oder ersetzt. Ein weiterer fachlicher Codewechsel erfordert erneut die vom Gate verlangte Prüfung.

## Abschlussreview HTTPS/PWA

Die folgende Nachprüfung gilt für den erneut eingefrorenen Produktstand einschließlich der abschließenden TLS-Lifecycle-Korrektur in `main.ts`. Sie ersetzt für den Abschluss die oben ausgewiesenen Zwischenstandszahlen und den früheren `adminConnection.ts`-Codehash. Der Vergleich erfolgte gegen die aus dem SHA-geprüften ausgelieferten ZIP wiederhergestellte Version 1.0.37, nicht gegen eine angenommene oder neu erzeugte Baseline.

### Tatsächlich ausgeführter Vollscan

Nach der inhaltlichen Nachprüfung und Hashneubindung wurde **`npm run lint:security` vollständig mit Exit 0 ausgeführt**. Das Gate kontrolliert für jede erfasste Quelle die eingeschalteten Regeln und verbietet Inline-Ausnahmen. Es prüft die Hashbindung sämtlicher vorhandener Einzelreviews vor der ESLint-Erfassung.

| Abschließendes Gate-Ergebnis | Anzahl |
| --- | ---: |
| Geprüfte maßgebliche Runtime-/Adminquellen | 183 |
| Aktuelle Scannerbefunde | 3097 |
| Weiterhin offene historische Befunde | 2957 |
| Individuell bewertete Vorkommen | 140 |
| Neue oder verbotene blockierende Befunde | 0 |
| Nicht mehr vorhandene frühere Befunde | 103 |
| Vorhandene Einzelreview-Einträge, unveränderte Gesamtzahl | 120 |

Die vollständige Regelverteilung des abschließenden Laufs lautet:

| Regel | Vorkommen |
| --- | ---: |
| `security/detect-object-injection` | 2380 |
| `security/detect-non-literal-fs-filename` | 50 |
| `@typescript-eslint/ban-ts-comment` | 72 |
| `security/detect-unsafe-regex` | 16 |
| `@typescript-eslint/no-explicit-any` | 563 |
| `security/detect-possible-timing-attacks` | 12 |
| `security/detect-non-literal-require` | 1 |
| `security/detect-non-literal-regexp` | 3 |

Diese Zahlen enthalten ausdrücklich offene historische Scanner-Hotspots. Der grüne Regressionsgate ist **kein befundfreier Sicherheitsscan und kein ASVS-/CRA-Konformitätsnachweis**. Die historischen Typbefunde werden dadurch nicht zu zulässigen Ausnahmen in strikten Modulen.

### Nachprüfung der geänderten Quellen

In dieser Abschlussrunde erforderten **9 bestehende Einträge für 10 Vorkommen** eine Neubindung: ein Eintrag in `adminConnection.ts` und acht Einträge mit neun Vorkommen in `main.ts`. Für jeden Eintrag wurden die tatsächliche Fundstelle, ihre Schlüsselherkunft und ihre Schutzgrenze gelesen und erneut mit der vollständigen ESLint-Erfassung abgeglichen. Alle Fingerprints und Anzahlen blieben gleich. Es wurde **kein neuer Review-Eintrag** hinzugefügt und keine bestehende Ausnahme erweitert.

| Quelle / Fundstelle im Abschlussstand | Inhaltliche Bewertung |
| --- | --- |
| `adminConnection.ts`, `copyJsonValue`, Zeile 178 | Der einzige bewertete Dictionary-Schreibzugriff ist gegenüber 1.0.37 unverändert: neues Objekt ohne Prototyp, vorherige Sperre von `__proto__`, `prototype` und `constructor`, Tiefen- und Knotenbudget. Der neue Transportvertrag liest Port und einen echten Boolean-`secure` aus genau dem angeforderten Instanzobjekt. Identität, Portbereich und Fehlerpfad werden geprüft; Herkunft des bestehenden Dictionaryschlüssels bleibt unverändert. |
| `main.ts`, `_nwPartnerAppActive`, Zeile 4982 | Appkennung kommt aus der vorhandenen Partner-Positivliste; `directMarketing` wird ausdrücklich auf `grid` abgebildet. Installations-, Aktivierungs- und Lizenzprüfung bleiben bestehen. Kein TLS-Aufrufer erweitert diese Kennungen. |
| `main.ts`, Partner-Hooks, Zeilen 4996, 5001 und 5002 | Availability und Telemetrie stammen weiterhin aus den durch vorhandene Regler erzeugten Dictionaries ohne Prototyp. Ressource, Boolean-Verfügbarkeit und Messfrische bleiben geprüft. Der State-Lesecallback wird weiterhin von festen internen Bilanz-/PV-/Netzprojektionen verwendet; die Transportänderung ergänzt weder fremde Propertypfade noch Geräteschreibzugriffe. |
| `main.ts`, `getStoredSession`, Zeile 13126 | Der Propertyname ist der intern aus der Sitzungsbindung gebildete `COOKIE_NAME`. `parseUiCookies` begrenzt Eingaben, verwirft doppelte Namen und liefert ein Dictionary ohne Prototyp. Die Server-Map, Bindungs-, Konten- und Ablaufprüfungen bleiben unverändert. |
| `main.ts`, `doAuthLogout`, Zeilen 13620 und 13624 | Der gleiche interne Cookie-Name dient nur dem Entfernen der zugehörigen Server-Sitzung und dem Schließen passender SSE-Clients. Der vorgelagerte CSRF-Vergleich und die EOS-Zuordnung bleiben unverändert. |
| `main.ts`, Diagnosezähler, Zeile 23022, zwei Vorkommen | Der Akkumulator bleibt `Object.create(null)`. Die vorherige Fehlerklassifikation liefert feste Labels. Die beiden Indexzugriffe verändern keine Prototyp-Setter; TLS/Startlogik ändert weder Labelherkunft noch Zielobjekt. |
| `InstallerPage.tsx` | Keine Scannerbefunde. Der neue gemeinsame Resolver liefert ein bestätigtes Instanzziel einschließlich TLS. Bis dahin sind Bedientasten gesperrt; Wechsel der Instanz und Effektabbau verwerfen späte Ergebnisse. Es wurde keine Ausnahme angelegt. |
| `RedirectPage.tsx` | Ein unveränderter historischer Index-Hotspot bleibt in der Baseline offen. Die Ziel-Literalmap und Aufrufstellen mit festen `targetKey`-Werten wurden gelesen. Neu werden Ziel/Instanz gebunden, späte Ergebnisse verworfen und der Öffnungstimer beim Effektabbau gelöscht. Kein neuer Hotspot und keine Umdeklaration des historischen Befunds als erledigt. |
| `ui-server-transport.ts` und `pwa.ts` | Beide neuen Quellen haben im tatsächlichen Scan null Befunde. Sie sind zusätzlich in `STRICT_TYPES` enthalten; Typunterdrückungen und `any` würden dort blockieren. Keine Einzelreview-Ausnahme erforderlich. |

Der erneute Vergleich von `DynamicGridPage.tsx` und `smarthome-import.ts` bestätigt weiterhin ausschließlich die oben dokumentierten festen Branding-Textänderungen. Die bereits dafür gebundenen Hashes und Bewertungen bleiben gültig.

### Abschließender TLS-Lifecycle-Diff

Die zuletzt ergänzte Behandlung in `onReady` wurde ebenfalls in ihrem tatsächlichen Kontext geprüft. Nur der eigene `UiTlsConfigurationError` wird lokal aufgefangen; andere Serverstartfehler werden weitergegeben. Die UI bleibt bei Zertifikatsfehlern ohne Listener, `info.connection` wird nicht auf erfolgreich gesetzt und die bisherige autonome EMS-/SmartHome-Initialisierung wird fortgesetzt. Ausgegeben werden die festen Fehlercodes und Meldungen des Helfers, keine fremden Zertifikatsfehler oder Schlüssel.

`startServer` prüft den vorhandenen Shutdown-Guard sowohl am Eingang als auch unmittelbar nach dem asynchronen Zertifikatslesen, bevor ein HTTP-/HTTPS-Listener entstehen kann. `onReady` kehrt bei Shutdown zurück; der bereits vorhandene `finally`-Pfad gibt den Installer-Mutationstoken dabei weiterhin frei. Die Änderung erzeugt keinen HTTP-Fallback und berührt die oben nachgeprüften Partner-, Cookie-, Logout- und Diagnosezugriffe nicht. Die statische Bewertung ersetzt die gesonderten echten HTTPS-/Shutdown-/Startablauftests nicht.

### Abschließende Codehashes und unveränderte Prüfregeln

Die folgenden Werte sind `codeSha256` nach der bestehenden Gate-Methode, also TypeScript-Druck ohne Kommentare, keine Rohdatei-Hashes:

| Quelle | Abschließender Codehash |
| --- | --- |
| `src-ts/runtime-executables/main.ts` | `5fbefa230ec5b15e7cfb556c4a302c4263495650e724172c43c2e21a50da3388` |
| `src-admin-tab/src/lib/adminConnection.ts` | `d53e10c54597c2a27082428196dbccfd7dcbbc51755437ba5376b859f8505fca` |
| `src-admin-tab/src/pages/InstallerPage.tsx` | `08da3daba457ca504a09a2fd5053699669362378e3cc355f1859788d4a61f250` |
| `src-admin-tab/src/pages/RedirectPage.tsx` | `7a795c98175bab9045c4eaad38f7d490acff08e11bfc760e3e8e88807e30d026` |
| `src-ts/runtime-executables/lib/ui-server-transport.ts` | `701833cbcb5c6861bd145515854951c58c81e8830e47afa6b07e29473c2d661c` |
| `src-ts/runtime-executables/www/pwa.ts` | `f2491ee09c97a1e40b13268759532aaa266d45294595a9682fd73e767408d2de` |

`eslint.config.cjs` ist bytegleich zu 1.0.37, SHA-256 `e26c551cf94d16544dd21426bd53f33ec666b084d751e1e0a3817998dbbcca14`. Die historische Baseline ist ebenfalls bytegleich; ihr oben dokumentierter Hash gilt unverändert. Der tatsächliche Diff von `scripts/verify-eslint-security.cjs` gegenüber 1.0.37 besteht ausschließlich aus der Aufnahme von `ui-server-transport.ts` und `pwa.ts` in `STRICT_TYPES` durch den Hauptbearbeiter. Regeln, Bewertung, Fingerprinting und Ausnahmeverbote wurden nicht abgeschwächt.

Für diese Abschlussprüfung wurden ausschließlich `docs/security/eslint-reviewed-findings.json` und dieser Bericht geändert. Im JSON wurden nur die Codehashbindung und der konkrete datierte Reviewtext der genannten vorhandenen Einträge erneuert; Regeln, Fingerprints, Anzahlen, Begründungen und ursprüngliche Belege blieben erhalten. Ein weiterer Produktcodewechsel hebt diese Abschlussbindung wieder auf und muss erneut geprüft werden.
