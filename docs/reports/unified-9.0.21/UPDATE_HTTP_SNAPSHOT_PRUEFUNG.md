# Abgegrenzte Prüfung: Update-HTTP und Konfigurationssnapshot

Stand: 24.11.2026. Dieser Bericht ergänzt [PERSISTENZ_STABILITAET.md](PERSISTENZ_STABILITAET.md) um die neu hinzugefügten Update-Helfer. Die nachstehenden Befunde betreffen deren ersten, noch nicht veröffentlichten 9.0.21-Stand. Sie werden ausdrücklich nicht als Fehler der 9.0.20-Baseline ausgewiesen.

## Befunde und Korrekturen

| Kennung | Beobachtung vor der Korrektur | Korrektur und Nachweis |
| --- | --- | --- |
| 921-UPD-SNAP-01 | Die geschützte UI-Konfigurationshülle enthielt den erhaltenen Namespace `nexowatt-ui.3`; der Snapshot las trotzdem `eos-admin.0`. Die Laufzeit hydratisiert diese Migrationsdaten aus dem Modulstore und muss sie nicht in `instance.native` ablegen. | `readEosUpdateConfiguration()` löst den Namespace nach dem Lesen der maßgeblichen UI-Hülle auf, behält die Migrationsmetadaten aller Module und liest die tatsächlichen Installer-/Kundeneinstellungen. Test vor Korrektur: erwartetes `nexowatt-ui.3`, tatsächlich `eos-admin.0`. |
| 921-UPD-SNAP-02 | Falsche Objektidentität/ACL, fehlende als erforderlich markierte Legacy-Zustände und verschachtelte v2-Hüllen wurden nicht zuverlässig abgelehnt. | Exakte eigene Objekt-IDs, Store-ACL und Revision; genau eine äußere v2- und innere v1-Hülle; eingeschränkter Legacy-UI-Namespace und bekannte erforderliche JSON-Zustände. Ungültige Hüllen/Entschlüsselung liefern ausschließlich `EOS_UPDATE_CONFIGURATION_INVALID`. |
| 921-UPD-HTTP-01 | Ein geschlossener Client konnte einen später ausgewerteten Autorisierungs-Callback weiterhin erfolgreich verwenden. Eine blockierte Authentifizierungsabfrage hatte keine HTTP-Frist oder Zulassungsgrenze. | Maximal acht laufende Anfragen; 20 Sekunden Antwortfrist einschließlich Authentifizierung; Autorisierung nach Frist/Verbindungsende dauerhaft falsch. Eine nicht abbrechbare DB-Operation behält ihren Platz bis zu ihrem tatsächlichen Abschluss. Tests injizieren gehaltene Sessionabfragen und späte Service-Fortsetzung. |
| 921-UPD-HTTP-02 | Der Express-Standardfehler für defektes JSON lieferte HTML/Parserdetails; beliebige ausschließlich großgeschriebene interne Fehler wurden ausgegeben. | JSON maximal 1 KiB, Parsing erst nach Autorisierung; feste JSON-Fehler 400/413. Nur `UPDATE_*`-/`EOS_UPDATE_*`-Fehlercodes werden übernommen, andere Fehler erscheinen als `UPDATE_UNAVAILABLE`. |
| 921-UPD-HTTP-03 | Die unabhängige Gegenprüfung hielt acht angefangene JSON-Bodies offen. Nach acht HTTP-504 blieb die nachfolgende gültige Anfrage dauerhaft bei 429, solange die Body-Transporte offen waren. | Der Parser ist als abbrechbare Arbeit an ein Abbruchsignal gebunden. Nach Frist/Verbindungsende wird der unvollständige Body-Transport geschlossen und seine Zulassung freigegeben; nicht abbrechbare DB-/Serviceoperationen behalten ihre Zulassung. Derselbe unabhängige Reproducer zeigt nach acht HTTP-504 jetzt 200 für die gültige Anfrage. |
| 921-UPD-SNAP-03 | Eine nur abschließende Gesamtgrößenprüfung konnte vor ihrer Ablehnung ein übergroßes JSON-Zwischenergebnis erzeugen. | Kumulative UTF-8-Bytebilanz einschließlich JSON-Escapes, Schlüsseln und Trennzeichen während der Traversierung; Größenprüfung der Konfigurationszeichenfolge vor `JSON.parse`. Tests decken kumulierte Werte, Escape-Vergrößerung, exakte 8-MiB-Grenze und nicht mehr besuchte übergroße Teilbäume ab. |

Die Vorher-Rohlogs liegen unter [Snapshot vor Korrektur](raw/persistence/921-new-update-snapshot-before.log) und [HTTP vor Korrektur](raw/persistence/921-new-update-http-before.log). Im ersten HTTP-Testlauf enthielt das Testgerüst zusätzlich zwei eigene Ungenauigkeiten: GET-Anfragen sendeten einen Body, und der Test behandelte ioBrokers `enduser` fälschlich als verbotene EOS-Rolle. `UnifiedSessions` bildet diese Rolle ausdrücklich auf den zulässigen `customer` ab. Diese Gerüstfehler wurden korrigiert und werden nicht als Produktbefunde gezählt. Die unabhängigen Vorher-Befunde zu Verbindungsabbruch, fehlender Zeit-/Zulassungsgrenze und Parserfehlern bleiben davon unberührt.

Der zusätzliche unabhängige Body-Reproducer ist unter [http-slowbody-repro.cjs](raw/persistence/http-slowbody-repro.cjs) abgelegt. [Vorher-Beobachtung](raw/persistence/http-slowbody-before-observation.json) dokumentiert ausdrücklich die ursprüngliche Tool-Konsolenausgabe und ist kein nachträglich ausgeführter Baseline-Test. [Nachher-Rohlog](raw/persistence/http-slowbody-after.log) stammt aus dem erneut ausgeführten unveränderten Reproducer. Nach den engen Korrekturen meldete die unabhängige Codeprüfung keinen weiteren blockierenden Befund im geprüften Helper-Umfang.

## Umfang und Verhalten

`src/lib/eosUpdateSnapshot.ts` liest ausschließlich das eigene Instanzobjekt, die fünf Konfigurationsobjekte `devices`, `eebus`, `backup`, `ui`, `migration`, neun bekannte UI-Konfigurationszustände sowie höchstens 512 Einträge des passenden `settings.*`-Teilbaums. Es gibt keine Schreib-API im Reader. Zwei unabhängige, begrenzte Lesedurchläufe werden nach kanonischer JSON-Normalisierung verglichen. Laufende Moduländerung/Migration bzw. abweichende Inhalte führen zu `EOS_UPDATE_CONFIGURATION_BUSY`/`EOS_UPDATE_CONFIGURATION_CHANGED`. `false`, `0`, leere Zeichenfolgen und bewusst leere Listen werden erhalten; benötigte Legacy-JSON-Konfiguration darf nicht fehlen oder zu einer ungültigen primitiven Darstellung werden. Geheimnisse verbleiben im serverseitigen Snapshot, der nachgelagert verschlüsselt wird.

`src/lib/eosCustomerUpdateHttp.ts` prüft die echte zentrale Sitzungsgrenze einschließlich Ursprung, schreibender CSRF-Prüfung, verpflichtendem Erstpasswort und Rollen `admin`, `installer`, `customer`. Die eng begrenzte Updatefähigkeit erteilt keine allgemeinen ioBroker-Administratorrechte. Vorbereitungs- und Start-Callbacks prüfen die aktuelle Sitzung erneut, einschließlich unmittelbar späterem Sitzungs-/Rollen-/Passwortentzug. Zulässig sind nur leere Check-Anfragen, eine stabile numerische Version bei Prepare sowie Plan-ID und ausdrückliche Bestätigung bei Start; keine URLs, Pfade, Befehle oder zusätzlichen Schlüssel.

Die 20-Sekunden-HTTP-Frist wurde mit dem zentralen Release-Verantwortlichen unter Berücksichtigung des bestehenden 5-Sekunden-Gesamtbudgets für externe Transfers abgestimmt. Langsame Übertragungen können damit kontrolliert fehlschlagen; eine erfolgreiche Aktualisierung über beliebig langsame Netze wird nicht zugesichert. Ein abgelaufener oder geschlossener Request gewinnt durch einen späteren DB-Erfolg keine Startberechtigung zurück.

## Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `test/eos-customer-update-snapshot.test.cjs` und `test/eos-customer-update-http.test.cjs`, Node 22.23.4 | 20 bestanden, 0 Fehler, 0 ausgelassen |
| Dieselben Dateien, Node 24.22.3 | 20 bestanden, 0 Fehler, 0 ausgelassen |
| Konfiguriertes ESLint für beide Helfer | Bestanden |
| Backend `tsconfig.build.json --noEmit` | Bestanden |
| `tsconfig.eos-customer-updates.json`, beide Helfer zusätzlich in `files` | Bestanden, vollständig strenger Vertrag einschließlich `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns` |

Die Tests führen die tatsächlichen TypeScript-Helfer aus; die HTTP-Prüfungen verwenden einen echten lokalen Express-Listener, rohe HTTP-Anfragen und die produktive `UnifiedSessions`-Implementierung. Nur Datenbank und nachgelagerter Update-Service sind kontrollierte Fixtures. Die asynchronen Gegenprüfungen halten Operationen gezielt an und prüfen, dass nach Sitzungsentzug, Clientabbruch oder Zeitablauf kein späterer Service-Effekt freigegeben wird.

Rohlog und Ausführungsbeleg mit Befehlen, Laufzeit, Node-Version sowie Hashes der tatsächlich geprüften zwei Helfer, zwei Tests und strikten Typkonfiguration: [Node 22](raw/persistence/921-update-helpers-final-node22.log), [Receipt Node 22](raw/persistence/921-update-helpers-final-node22.receipt.json), [Node 24](raw/persistence/921-update-helpers-final-node24.log), [Receipt Node 24](raw/persistence/921-update-helpers-final-node24.receipt.json). Kleinere Typ-/Lintprüfungen haben eigene Rohlogs ohne nachträglich erfundene Zeitbelege.

## Grenzen

Diese Teilprüfung weist weder eine reale Kundeninstallation noch einen vollständigen Update-/Rollback-Zyklus am js-controller nach. Paketquelle, Signaturprüfung, verschlüsselte Dateisicherung, Wartungsprozess, Neustart und grafischer Kundenablauf gehören zu den separaten Service-/Worker-/Integrationsprüfungen. Der Snapshot ist ein begrenzt doppelt gelesener Konsistenznachweis, keine Datenbanktransaktion über alle ioBroker-Objekte. Eine dauerhaft blockierte Datenbankabfrage hält die betreffende Zulassung bewusst fest. Es gibt keinen automatischen Restore und keine Mutation fremder Administratorrechte, Adapter oder globaler Konfiguration durch diese Helfer.

Aus diesen Ergebnissen folgen keine allgemeine Fehlerfreiheit, vollständige Anlagenfreigabe oder CRA-Konformität.
