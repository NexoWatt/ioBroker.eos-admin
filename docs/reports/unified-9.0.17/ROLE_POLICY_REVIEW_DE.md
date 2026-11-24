# Gemeinsame EOS-Rollenzuordnung

Stand: 24.11.2026, Änderung für 9.0.17 auf Basis 9.0.16.

Die Prüfung der Koexistenzkorrektur zeigte unterschiedliche Rollenzuordnungen zwischen HTTP und Socket: HTTP berücksichtigte zusätzliche bestehende Konfigurationsnamen und feste Gruppen-IDs; der Socket-Cache nutzte eine kleinere Auswahl. `src/lib/eosRolePolicy.js` bündelt diese reine Zuordnung. Sie liest oder schreibt keine Datenbankobjekte und verändert keine Gruppenmitgliedschaft oder Plattform-ACL.

Die bestehenden HTTP-Gruppen-IDs bleiben als Kompatibilitätsvertrag erhalten. HTTP und Socket verwenden anschließend dieselben Einstellungen und exakten IDs:

| EOS-Rolle | Bestehende feste Gruppen-IDs, jeweils unter `system.group.` | Unterstützte Konfigurationsfelder |
| --- | --- | --- |
| Admin / Service | `administrator`, `nexowatt-service`, `eos-service` | `eosAdminOnlyGroups`, `eosSecurityAdminGroups`, `eosAdminOnlyGroup`, `eosServiceGroups`, `eosNexoWattServiceGroups` |
| Installateur | `installateur`, `installateure`, `installer`, `techniker`, `inbetriebnahme`, `integrator` | `eosInstallerGroups`, `eosInstallateurGroups`, `eosCommissioningGroups` |
| Endnutzer | `endkunde`, `endkunden`, `kunde`, `kunden`, `user`, `users` | `eosEndUserGroups`, `eosEndkundeGroups`, `eosCustomerGroups` |

Die Zuordnung benötigt tatsächliche Mitgliedschaft in der jeweiligen Gruppe. Ein Benutzername wie `system.user.admin`, ein Gruppen-Anzeigename, eine Beschreibung oder ein ähnliches Präfix verleiht keine Administratorrolle. Mehrfachmitgliedschaften verwenden die bestehende Reihenfolge Admin, Installateur, Endnutzer. Nur konfigurationsseitige Kurz-IDs werden wie bisher normalisiert. Deaktivierte eigene Konfigurationszeilen werden nicht hinzugefügt; die festen historischen HTTP-IDs bleiben auch bei leeren Konfigurationslisten erhalten.

Der Rückgabewert `enduser` bei fehlender Rolle oder ungültiger Identität authentifiziert keinen Benutzer. Session-, Kontoaktivierungs-, Ablauf-, Passwortwechsel- und Widerrufsprüfungen bleiben verbindlich in den aufrufenden HTTP-/Socket-Grenzen. Die gemeinsame Zuordnung erzeugt keine zusätzlichen Gruppen und ändert keine globalen Dateirechte.

## Nachweis

```sh
node --test --test-reporter=tap test/eos-role-policy.test.cjs
./node_modules/.bin/eslint -c eslint.unified.config.mjs src/lib/eosRolePolicy.js test/eos-role-policy.test.cjs
```

Lokaler Lauf mit Node.js 24.22.3: **6 Tests bestanden**, Lint bestanden. Die Tests decken die unveränderten festen Gruppen-IDs, sämtliche Konfigurations-Aliase, deaktivierte Zeilen, konkrete Mitgliedschaften und deren Entfernung, Prioritäten, verbotene Namens-/Präfixableitung, fehlende Identität, Eingabegrenzen und Nichtveränderung der Eingabekonfiguration ab. Rohbelege: `role-policy.tap`, `role-policy-lint.log`.

Die Integration in `src/main.ts` und `src/lib/web.ts`, deren Typprüfung sowie die Session- und HTTP-/Socket-Regressionen werden im gemeinsamen Versionsnachweis geführt. Dieser reine Policy-Test ist kein Ersatz für diese Integrationsprüfungen und kein Test auf der Kundenanlage.
