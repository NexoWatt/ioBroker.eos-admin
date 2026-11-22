<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# Benutzer und Gruppenrechte im EOS

**Ergänzung 1.0.37:** Die lokale Gruppenzuordnung dieser Anleitung gilt für das
ausdrücklich gewählte Profil `iobroker`. Das Profil `eos` verwendet die
serverseitig bestätigte Rolle der konfigurierten zentralen Sitzung. Der alte
Trusted-Header-Weg wird in keinem der beiden Profile akzeptiert. Einrichtung und Migration:
[Anmeldeprofile 1.0.37](ANMELDEPROFILE_1_0_37_DE.md).

Stand: NexoWatt UI 1.0.34, 03.11.2026. Die vorhandenen lokalen ioBroker-Konten
bleiben die Quelle der Anmeldung. Die EOS-Rolle wird aus ihrer tatsächlichen
Gruppenmitgliedschaft bestimmt. Benutzer dürfen beliebige gültige Namen tragen;
der Name `admin`, `installer`, `kunde`, `user` oder `customer` verleiht selbst keine
Berechtigung. Es werden weder Konten noch Passwörter oder Gruppen automatisch geändert.
Jeder Benutzer meldet sich mit seinem eigenen lokalen ioBroker-Passwort an;
das Passwort eines Administrators gilt nicht für andere Benutzerkonten.

## Rollen und Standardgruppen

| EOS-Rolle | ioBroker-Gruppen, die standardmäßig zugeordnet sind | Umfang |
| --- | --- | --- |
| Administrator | `system.group.administrator`, `system.group.eosAdmin`, `system.group.nexowattAdmin` | Vollzugriff einschließlich Lizenz- und Benachrichtigungsverwaltung. |
| Installateur | `system.group.installer`, `system.group.eosInstaller`, `system.group.nexowattInstaller` | EMS-Einrichtung, technische Zuordnungen und Konfiguration; keine Lizenz- oder Benachrichtigungsverwaltung. |
| Kunde | `system.group.user`, `system.group.eosUser`, `system.group.nexowattUser` | Freigegebene Kundenbedienung und Kundeneinstellungen; keine technischen Zuordnungen oder EMS-Einrichtung. |

Beispiel: `system.user.dominique` erhält durch Mitgliedschaft in
`system.group.administrator` die EOS-Administratorrechte. Ein Konto namens
`system.user.admin` ohne passende Gruppenmitgliedschaft erhält diese Rechte nicht.
Dasselbe gilt für andere Anbieter und frei gewählte Benutzerkennungen.

Die EOS-Rollen sind Funktionsrollen dieser Anwendung. Die generischen
ioBroker-ACLs für Objekte, States oder Dateien entsprechen ihnen nicht eins zu
eins. Deshalb macht der Adapter eine fremde Gruppe weder aufgrund ihres Namens
noch aufgrund eines einzelnen ACL-Flags automatisch zum EOS-Administrator.
Eine Kundengruppe erlaubt Kundenbedienung und ist keine reine Leserolle.

## Eigene Gruppen zuordnen

In den Einstellungen der UI-Adapterinstanz im ioBroker-Admin den Reiter
**Sicherheit** öffnen. Dort stehen die Felder **ioBroker-Gruppen für
EOS-Administratoren**, **EOS-Installateure** und **EOS-Kunden**.

1. Die vorhandene Gruppe im ioBroker-Admin prüfen und ihre vollständige Objekt-ID
   übernehmen, beispielsweise `system.group.service_team`. Ein Anzeigename oder
   ein Benutzername gehört nicht in diese Felder.
2. Die Gruppen-ID im Feld der gewünschten EOS-Rolle eintragen. Mehrere IDs durch
   Komma trennen; höchstens 32 Einträge je Feld. Die eingebauten Standardgruppen aus der Tabelle bleiben
   zusätzlich gültig, auch wenn das Feld geleert wird.
3. Den gewünschten Benutzer im ioBroker-Admin als Mitglied dieser Gruppe
   eintragen. Eine Zuordnung im UI-Adapter erzeugt selbst keine Gruppe und keine
   Mitgliedschaft.
4. Die Adapterkonfiguration speichern und den UI-Adapter neu starten. Danach mit
   dem bestehenden Benutzer und seinem unveränderten Passwort anmelden.

Die Eingabe ist auf 8192 Zeichen pro Textfeld, 128 Zeichen pro Gruppen-ID-Suffix
und insgesamt 128 verschiedene zugeordnete Gruppen begrenzt. Gruppen-IDs werden
mit ihrer tatsächlichen Schreibweise verwendet. Die serverseitige Prüfung
akzeptiert in vorhandener Konfiguration auch Zeilenumbruch/Semikolon als Trenner
oder echte Textlisten; fremde Datentypen und übergroße Werte werden verweigert.
Gruppenmitglieder müssen direkte vollständige `system.user.*`-IDs sein; eine
Verschachtelung von Gruppen wird nicht als Mitgliedschaft aufgelöst. Je Gruppe
werden höchstens 10000 Mitglieder akzeptiert.

Eine nicht zugeordnete Gruppe erhält keine EOS-Rolle. Nicht lesbare, ungültige oder
deaktivierte Gruppendaten dürfen keine Rechte freigeben. Ein Lesefehler, ein
ungültiges vorhandenes Gruppenobjekt oder eine ungültige Gruppenkonfiguration
verweigert die gesamte lokale Rollenauflösung. Eine nicht vorhandene Gruppe
gilt als fehlende Mitgliedschaft. Mitgliedschaften werden
serverseitig beim Anmelden und bei nachfolgenden autorisierten HTTP-Zugriffen
erneut gelesen; ein Rechteentzug wird nicht erst nach der Sitzungsdauer wirksam.
Die Gruppenprüfung hat ein eigenes gemeinsames Zeitbudget von höchstens fünf
Sekunden. Nicht abbrechbare ioBroker-Aufrufe können danach noch ausstehen, ihre
verspäteten Ergebnisse gewähren jedoch keine Rechte. Das Budget ist getrennt von
der ebenfalls begrenzten Konto-/Passwortprüfung.

## Umstellung von 1.0.33 und älter

Vor dem Update Konfiguration sichern und im ioBroker-Admin sicherstellen, dass
mindestens ein vorgesehenes Administratorenkonto tatsächlich Mitglied einer
zugeordneten Administratorgruppe ist. Eine zweite funktionsfähige
ioBroker-Admin-Sitzung erleichtert die Prüfung und die Korrektur von
Gruppenzuordnungen außerhalb des EMS.

Frühere `accessControl.adminUsers`, `accessControl.installerUsers`,
`accessControl.customerUsers` und `auth.installerUsers` sowie die bisher
eingebauten Namensausnahmen verleihen ab 1.0.34 keine EOS-Rechte mehr. Die dort
genannten Konten vor der Umstellung den beabsichtigten ioBroker-Gruppen zuordnen.
Der Adapter übernimmt solche Namenslisten nicht automatisch in Gruppen, weil
dadurch ungewollte bisherige Berechtigungen dauerhaft festgeschrieben würden.

Vorhandene zusätzliche Gruppenzuordnungen bleiben nutzbar; die ältere
Gruppenliste `auth.installerGroups` wird weiterhin als Installateur-Zuordnung
berücksichtigt. Nur die Benutzernamenlisten entfallen. Benutzer mit mehreren
zugeordneten Fachrollen erhalten die höchste berechtigte Rolle:
Administrator vor Installateur vor Kunde. Gruppenmitgliedschaften deshalb
gemeinsam prüfen, wenn eine Rolle entzogen werden soll.

Bis einschließlich 1.0.36 gab es eine optionale Trusted-Header-Anbindung an
einen ausdrücklich konfigurierten Gateway/Proxy. **Ab 1.0.37 gewährt dieser
historische Weg keine Identität oder Rolle mehr**, auch nicht mit einem alten
konfigurierten Geheimnis. Das Profil `iobroker` prüft das lokale Konto und seine
Gruppen; das Profil `eos` prüft die zentrale Sitzung serverseitig. Vertraute
Proxy-IP-Adressen dürfen den HTTPS-Transport beschreiben, aber keine Benutzer-
oder Rollenprüfung ersetzen.

Für einen Rückfall kann der gesicherte Stand 1.0.33 eingespielt werden. Dabei gilt
wieder dessen ältere, auch an Benutzernamen gebundene Rechtevergabe. Ein Rückfall
ist daher kein gleichwertiger Ersatz für die gruppenbasierte Sicherheitskorrektur.

## Kurze Anlagenprüfung

- Ein berechtigtes Konto mit frei gewähltem Namen anmelden: Die vorgesehene Rolle
  und deren Funktionen müssen erreichbar sein.
- Mit einem Kundenkonto anmelden: Kundenbedienung muss funktionieren; technische
  Einrichtung, Lizenz- und Benachrichtigungsverwaltung müssen gesperrt bleiben.
- Ein Konto ohne zugeordnete Gruppe prüfen: Trotz richtigem Passwort keine
  EOS-Freigabe. Auch der Name `admin` darf daran nichts ändern.
- Ein angemeldetes Testkonto aus seiner berechtigenden Gruppe entfernen:
  Nachfolgende autorisierte HTTP-Zugriffe müssen die entzogenen Rechte ablehnen.
- Mit falschem Passwort anmelden: Keine Sitzung. Nach mehreren Fehlversuchen die
  angezeigte Sperrfrist abwarten.

Diese Anleitung ist ein Sollablauf für die konkrete Installation. Sie bestätigt
keinen bereits ausgeführten Live-Test und keine allgemeine Produktivfreigabe.
Bei Problemen nur UI-/Admin-/Controller-Version, Meldung und HTTP-Status ohne
Passwort, Token oder Benutzerobjekt weitergeben. Ergänzende Hinweise:
[Admin-8-Anmeldung](ADMIN8_EMS_ANMELDUNG_DE.md) und
[bestehender Auth-Sicherheitsbericht](../security/auth-review-de.md).
