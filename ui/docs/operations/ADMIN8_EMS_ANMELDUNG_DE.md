<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# Admin 8: Benutzer und Anmeldung im EMS

**Ab 1.0.37:** Die expliziten Profile `iobroker` und `eos`, die verpflichtende
Anmeldung sowie HTTPS-/CSRF-Voraussetzungen stehen unter
[Anmeldeprofile 1.0.37](ANMELDEPROFILE_1_0_37_DE.md). Die folgende Beschreibung
des lokalen Passwortpfads bleibt für das Profil `iobroker` relevant; sie
beschreibt keine automatische Übernahme einer beliebigen Admin-Sitzung.

Stand: 1.0.35, 03.11.2026. Die lokale EMS-Benutzer-/Passwortanmeldung nutzt den öffentlichen ioBroker-Controllervertrag. Admin verwaltet die ioBroker-Benutzer; das EMS führt seine eigene Sitzung und prüft deren Rechte serverseitig. Admin-SSO/OAuth-Tokens werden nicht als EMS-Authentifizierung übernommen.

## Was in 1.0.32 fehlschlug

Vor der Passwortprüfung bildete der UI-Adapter unmittelbar `system.user.` plus Eingabe. Damit wurden gültige Anzeigenamen, `Admin` statt `admin` und bereits vollständige IDs verworfen, bevor die Controllerprüfung überhaupt lief. Außerdem wurde die vom Controller zurückgemeldete Konto-ID ignoriert. 1.0.33 löst zuerst das Konto auf und bindet Passwort, Rolle und Sitzung an dieselbe ID.

## Verwendbare Anmeldedaten

- Das Konto muss als ioBroker-Benutzer existieren, ein lokales Passwort besitzen und darf nicht gesperrt sein. Ein reines externes SSO-Konto ohne lokales Passwort kann diese Passwortanmeldung nicht verwenden.
- Verwende die interne Benutzerkennung, den vom Controller auflösbaren Anzeigenamen oder die vollständige ID. Die vollständige ID ist bei Namensgleichheit eindeutig; für das eingebaute Administratorkonto lautet sie `system.user.admin`.
- Das Passwort unverändert eingeben, einschließlich gewollter Leerzeichen. Niemals Passwörter oder gespeicherte Passwort-Hashes für eine Diagnose weitergeben.
- Jeder Benutzer verwendet sein eigenes lokales ioBroker-Passwort. Das Administratorpasswort ist kein Ersatz für das Passwort eines anderen Kontos.
- EMS-Einrichtung benötigt Admin- oder Installerrechte. Ab 1.0.34 bestimmt ausschließlich die tatsächliche Mitgliedschaft in zugeordneten ioBroker-Gruppen die lokale EOS-Rolle. Weder der Anzeigename noch eine interne Kennung wie `admin` oder `installer` vergeben allein Rechte. Ein anders benannter Benutzer in `system.group.administrator` erhält die Adminrolle.
- Eigene Anbietergruppen können im Reiter **Sicherheit** der UI-Adapterkonfiguration einer EOS-Rolle zugeordnet werden. Frühere Benutzer-Rollenlisten werden nicht mehr berücksichtigt; Migration und Gruppenbeispiele stehen unter [Benutzer und Gruppenrechte](BENUTZER_GRUPPENRECHTE_DE.md).

## Fehler unterscheiden

| Ergebnis | Bedeutung / Prüfung |
| --- | --- |
| 400 / ungültige Eingabe | Benutzername und Passwort müssen echte, nichtleere Texte innerhalb der Größenlimits sein. |
| 401 / Anmeldung abgewiesen | Passwortnachweis, aktives Konto oder konsistente Identität fehlen; die öffentliche Antwort verrät keine Kontodetails. |
| 403 / keine Berechtigung | Das authentifizierte Konto besitzt keine passende EMS-Rolle, oder eine vorgelagerte Origin-Prüfung hat die Anfrage abgewiesen. |
| 429 / zu viele Versuche | Angezeigte Wartezeit einhalten. Nach fünf Fehlversuchen kann dieselbe Quelladresse zehn Minuten gesperrt sein. |
| Netzwerk-/TLS-Fehler | URL, Protokoll und Port des UI-Adapters prüfen. Dies ist kein Beleg für ein falsches Passwort. |

Vor 1.0.33 als begrenzte Diagnose die interne kurze Kennung exakt eingeben, etwa `admin`. Eine Namenskollision oder ein anderer Kontofehler kann damit weiterhin bestehen; daher ersetzt dies das Update nicht. Nach mehreren Fehlversuchen erst die Sperrfrist abwarten.

Für eine weitere Diagnose nur UI-, Admin- und js-controller-Version, den Wortlaut der Meldung, den HTTP-Status und Zugriffsweg mitteilen. URLs ohne Tokens/Abfragewerte angeben. Keine Benutzerobjekte exportieren: Sie können Passwort-Hashes enthalten.

## Sicherheits- und Kompatibilitätsgrenze

Namensauflösung verwendet `getUserID`, Passwortprüfung `checkPassword` mit strengem Boolean-Ergebnis und identischer kanonischer Callback-ID. Die unterstützte Controller-Untergrenze im Adapter bleibt 6.0.11; der Quellvertrag wurde zusätzlich am versionierten Controller 7.2.5 abgeglichen. Der Hash wird ausschließlich für Sitzungswiderruf verarbeitet, niemals selbst als Passwortvergleich benutzt. Ein gemeinsames Budget von höchstens fünf Sekunden begrenzt die Kontoprüfung. Die anschließende Gruppenauflösung hat ab 1.0.34 ein eigenes gemeinsames Budget von höchstens fünf Sekunden. Nicht abbrechbare verspätete Controllerergebnisse erzeugen keine Sitzung oder Rechtefreigabe; dies ist keine Zusage einer Gesamtantwortzeit für alle weiteren HTTP-Verarbeitungsschritte.

Admin 8 nutzt eine eigene OAuth-/Sitzungsstrecke. Deren `/session`- und Refreshkorrekturen ersetzen die lokale EMS-Korrektur nicht. Ein vollständiger Admin-8-Systemtest, HTTPS-Proxyabnahme, mehrere UI-Instanzen mit demselben Host sowie externe SSO-Anbindung sind durch diesen Stand nicht nachgewiesen. Die bekannte HTTP-Runtime- und Cookie-Grenze ist in [der bestehenden Auth-Prüfung](../security/auth-review-de.md) dokumentiert.

## HTTPS-Admin ab 8.3

Für den gemeldeten HTTPS-Zugang über Admin 8.3.5 verwendet 1.0.35 den offiziellen Instanzproxy. Ein Timeout ist kein Passwortnachweis. Einrichtung und Grenzen: [HTTPS-Admin und Instanzproxy](ADMIN_HTTPS_PROXY_DE.md).
