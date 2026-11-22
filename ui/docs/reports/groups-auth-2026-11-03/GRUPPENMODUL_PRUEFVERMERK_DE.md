<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# Gruppenbasierte EOS-Rollen – Modulprüfung

Stand: NexoWatt UI 1.0.34, 03.11.2026. Grundlage ist der vollständig übernommene Stand 1.0.33. Dieser Teilbericht betrifft ausschließlich `src-ts/runtime-executables/lib/iobroker-user-roles.ts`, seine strikte Typprüfung und synthetische Regressionen. HTTP-Integration, gesamter Produktbuild und Lieferarchiv werden im übergeordneten Prüfbericht gesondert nachgewiesen.

## Anforderung und Änderung

Jeder authentifizierte ioBroker-Benutzer kann unabhängig vom Benutzernamen eine EOS-Rolle erhalten. Maßgeblich ist die direkte Mitgliedschaft seiner vollständigen, bereits authentifizierten Konto-ID in einer zugeordneten ioBroker-Gruppe. Die Namen `admin`, `installer`, `kunde`, `user` oder `customer` sowie frühere konfigurierbare Benutzerlisten vergeben keine Rolle. Anzeigenamen von Konten oder Gruppen werden für Rollen nicht ausgewertet.

Die bisherigen Standard- und Aliasgruppen bleiben erhalten. Die Konfigurationsfelder `accessControl.adminGroups`, `accessControl.installerGroups` und `accessControl.customerGroups` ergänzen vollständige Gruppen-IDs; das ältere Gruppenfeld `auth.installerGroups` bleibt kompatibel. Nicht zugeordnete Gruppen erhalten keine automatische EOS-Berechtigung. Bei mehreren gültigen Mitgliedschaften oder einer bewusst mehrfach zugeordneten Gruppe gilt die Reihenfolge Admin, Installer, Customer. Diese Zuordnung ist eine lokale EOS-Funktionsrolle und keine automatische Übersetzung sämtlicher ioBroker-Objekt-ACLs.

## Sicherheitsgrenzen

- Ein bestehendes Gruppenobjekt benötigt die exakt angefragte `_id`, den Typ `group`, ein `common`-Objekt und ein Array gültiger vollständiger `system.user.*`-IDs. Direkte Mitgliedschaften werden exakt verglichen; es gibt keine Namensähnlichkeit, Teilzeichenfolgen oder verschachtelte Gruppenauswertung.
- `common.enabled` darf fehlen oder Boolean sein. `false` vergibt keine Rechte; vorhandene Strings, Zahlen, Objekte oder `null` machen das Objekt ungültig. Diese Validierung wurde bei der Gegenprüfung ergänzt und erneut getestet.
- Fehlende Gruppen sind normal. Fehlerhafte Konfiguration, fehlerhafte bestehende Gruppenobjekte oder Leseausfälle verweigern die gesamte Rollenauflösung; zuvor gelesene Teilrechte werden nicht verwendet. Das kann bei einer beschädigten zugeordneten Gruppe auch andere Anmeldungen blockieren. Die Korrektur erfolgt durch einen berechtigten Administrator an der Gruppen-/Adapterkonfiguration, nicht durch eine Authentifizierungsumgehung.
- Gruppenzuordnungen werden pro Zugriff aktuell gelesen. Entfernung eines Mitglieds, Deaktivierung oder Löschung einer Gruppe wirkt bei der nächsten Prüfung; weitere Mitgliedschaften können eine niedrigere Rolle erhalten.
- Ein gemeinsames monotones Budget von höchstens 5.000 ms gilt für alle Gruppenlesevorgänge zusammen. Die lokale ioBroker-API bietet keinen Abbruch. Nach Zeitablauf werden verspätete Ergebnisse verworfen und keine weiteren Lesevorgänge gestartet; späte Promise-Ablehnungen sind behandelt. Diese Frist beschreibt keine Abbruchgarantie des Datenbankauftrags und keine harte Echtzeitgarantie des JavaScript-Prozesses.

Konfigurationsgrenzen: höchstens 32 Einträge je Feld, bei CSV höchstens 8.192 Zeichen, höchstens 128 unterschiedliche Gruppen insgesamt, höchstens 128 Zeichen im kanonischen ID-Suffix und höchstens 10.000 Mitglieder pro Gruppe. Gruppenlisten akzeptieren Text mit Komma, Semikolon oder Zeilenumbruch sowie reine String-Arrays. Leere Einträge werden ausgelassen. Groß-/Kleinschreibung und vom Controllervertrag unterstützte Unicode-Zeichen bleiben erhalten; interne IDs werden nicht umbenannt oder neu normalisiert.

## Tatsächlich ausgeführte Prüfungen

Umgebung: Linux, Node.js v24.22.1, TypeScript und ESLint aus dem vorhandenen Lockfile. Befehl: `node scripts/verify-iobroker-user-roles.cjs`. Der Befehl prüft zunächst `tsconfig.iobroker-user-roles.json` strikt und führt anschließend dieselbe kanonische Quelle mit synthetischen Gruppenobjekten aus.

20 benannte Prüfgruppen decken Standard-/Fremdgruppen, beliebige Kontonamen, fehlende namensbasierte Privilegien, Rollenpriorität, alte Gruppenfelder, ignorierte Benutzerlisten, Eingabetypen und Größenlimits, kanonische IDs, Objekt-/Mitgliederprüfung, Widerruf, Gruppenfehler, gemeinsame Deadline und späte Ablehnungen ab. Ergebnisse, tatsächlicher Exitcode, Laufzeit, Rohlog und SHA-256-Bindungen stehen in `iobroker-user-roles-results.json` und `iobroker-user-roles.log`. Die gezielte ESLint-Prüfung des neuen Moduls ist in `iobroker-user-roles-eslint.json` dokumentiert.

Ein zunächst ungültig gewählter synthetischer Kontosuffix mit Unicode-Kategorie `Lo` wurde durch einen im bestehenden Controller-/Auth-Vertrag zulässigen griechischen Kontonamen ersetzt. Der Produktvalidator wurde dafür nicht aufgeweicht. Die ergänzte `enabled`-Typprüfung hat eigene negative und positive Fälle.

## Grenzen und Abnahme

Dies sind Modul- und Typprüfungen mit synthetischen ioBroker-Objekten. Sie belegen keine Anmeldung an einer realen Admin-8-Installation, keinen Hardwaretest, keine vollständige CRA-/IEC-Konformität und keine Herstellerfreigabe. Vor der Anlagenprüfung müssen bisher nur über Benutzerlisten oder Namensregeln berechtigte Konten einer passenden Gruppe zugeordnet werden. Die genaue Migration und die tatsächlichen HTTP-Regressionsbelege liegen bei der übergeordneten Änderung.
