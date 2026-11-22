<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# Getrennter Review: Gruppenbasierte Anmeldung und Rechte

Stand: 03.11.2026, NexoWatt UI 1.0.34 auf vollständiger Basis 1.0.33.
Die Prüfung wurde als getrennte KI-gestützte Aufgabe durchgeführt. Sie ist keine
externe Zertifizierung, kein Penetrationstest eines Livesystems und keine
Hersteller-Produktivfreigabe.

## Prüfumfang und Ergebnis

Geprüft wurden die neue Gruppenpolicy, ihre Einbindung in die tatsächlichen
Anmelde- und Sitzungswege, weitere Benutzernamenvergleiche im Backend/Frontend,
die Konfigurationsgrenze sowie die fünf bisher einzeln bewerteten Main-ESLint-
Hotspots. Im geprüften Änderungsumfang wurde kein zusätzlicher Freigabeblocker
gefunden. Die nachfolgend genannten Betriebsgrenzen bleiben bestehen.

Die unabhängigen synthetischen Prüfungen bestanden **14 Prüfgruppen** unter
Node.js v24.22.1. Ausgeführt wurde `node independent-group-review.cjs`; die
bereinigten Resultate stehen in [independent-group-review.json](independent-group-review.json).
Die Quellfassung des Gruppenmoduls trägt SHA-256
`c835b25eff79526f750fafe864a36f8460173434117243c11bcb96294a906b81`.
Die mitgelieferte Prüfroutine verwendet TypeScript aus den installierten
Entwicklungsabhängigkeiten, kompiliert isoliert in ein temporäres Verzeichnis
und ändert den Produktcode nicht.

Abgedeckt sind beliebige kanonische Kontonamen, explizit zugeordnete fremde
Gruppen, die Wirkungslosigkeit alter Benutzernamenlisten, exakte Objekt-/Mitglieds-
IDs, fehlende/deaktivierte/geänderte Gruppen, Rollenpriorität, ungültige
Objektstruktur und Konfiguration, Lesefehler, Zeitablauf mit später Promise-
Ablehnung, eingefrorene Policylisten und die Gleichheit der Rollen-Capabilities
mit dem bestehenden vertrauenswürdigen Gatewaypfad. Neue HTTP-Integrationstests
wurden zusätzlich inhaltlich geprüft; deren Ausführung und Gesamtregression
werden im Hauptprüfbericht separat belegt.

## Fachliche und sicherheitsbezogene Prüfung

- Die bisherige automatische Rollenvergabe anhand von `admin`, `installer`,
  `kunde`, `user`, `customer` und weiteren Benutzernamenlisten ist aus der lokalen
  Rollenentscheidung entfernt. Die verbleibende Erwähnung alter Listen erzeugt
  nur einen festen Migrationshinweis ohne Kontonamen oder Geheimnisse.
- Die Passwortprüfung liefert die kanonische Konto-ID. Beide Loginrouten und
  vorhandene Sitzungen übergeben genau diese Identität an die Gruppenauflösung.
  Gruppen werden bei nachfolgenden autorisierten HTTP-Zugriffen erneut gelesen.
- Ein vorhandenes Gruppenobjekt muss die angefragte `_id`, den Typ `group`, eine
  gültige `common`-Struktur und direkte vollständige Benutzer-IDs besitzen.
  Ein vorhandenes `common.enabled` muss ein Boolean sein. Lesefehler und
  ungültige konfigurierte Gruppen sperren die gesamte Rollenauflösung; eine
  teilweise bereits gefundene Adminrolle wird nicht zurückgegeben.
- Der neue Gruppenabgleich und die unveränderten Browseransichten vergeben
  keine Rechte aus einem angezeigten Namen. Browseransichten verwenden Rolle
  und Capabilities der Serverantwort; der Server prüft die Zugriffe selbst.
- Die technischen Installer-Save-/Import-Schnittstellen erlauben `auth` und
  `accessControl` nicht als Rootkonfigurationsfelder. Ein EOS-Installateur kann
  die neue Administrator-Gruppenzuordnung darüber nicht selbst erweitern.
- Die festen `system.user.admin`-Einträge für den Besitz interner ioBroker-
  Objekte sind Speicher-ACLs und keine zusätzliche lokale EMS-Anmelderegel.
  Sie wurden nicht sachfremd verändert.

## Bestehende ESLint-Bewertungen

Die fünf vorhandenen Main-Bewertungen umfassen sechs tatsächliche dynamische
Zugriffe. Jeder Zugriff und seine nächste umschließende Funktion wurden mit
1.0.33 über die kommentarlos gedruckte TypeScript-Struktur verglichen: alle
unverändert. Dies betrifft die begrenzte Partner-App-Auswahl, Ressourcen-
Verfügbarkeit, State-/Telemetrie-Lesezugriffe und den Diagnosezähler mit
prototyplosem Objekt. Fingerprints, Häufigkeiten und Begründungen dürfen deshalb
beibehalten und an die geänderte Gesamtdatei gebunden werden. Dies ist keine
pauschale Sicherheitsfreigabe von `main.ts`.

Die Einzelhashes stehen in [review-main-bindings.json](review-main-bindings.json).
Der geprüfte Main-Rohdateihash lautet
`ee0432dd6ff8514556f9d734a63b34141622baf2b7df29e46f0c150bfe6bc882`;
der für das Gate maßgebliche kommentarlose AST-Codehash lautet
`1236a46a163b7cca76e9084388ac23b944c3e2e2633608d1c8814c8216709d1a`.
Spätere Build-/Dokumentationsbindung und Vollarchivhashes werden im finalen
Lieferstand zusätzlich geprüft.

## Kompatibilität und Grenzen

Der versionierte öffentliche Controllercode wurde direkt gelesen:
[ioBroker.js-controller v7.2.5, adapter.ts](https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/adapter/src/lib/adapter/adapter.ts).
`checkGroup` prüft die direkte Mitgliedschaft mittels vollständiger Benutzer-ID
in `common.members`. `calculatePermissions` aggregiert ioBroker-ACLs und hat
zusätzlich eine Sonderbehandlung des eingebauten `system.user.admin`.
EOS übernimmt diese Benutzernamen-Sonderbehandlung bewusst nicht: Auch dieses
Konto benötigt nun eine passende tatsächliche Gruppenmitgliedschaft. Die
Migrationsanleitung muss deshalb vor dem Update beachtet werden.

EOS-Funktionsrollen bilden die generischen ioBroker-Objekt-/State-/Dateirechte
nicht automatisch eins zu eins ab. Unbekannte Anbietergruppen werden erst nach
bewusster Zuordnung freigegeben. Eine reine Lesergruppe darf nicht ungeprüft der
Kundenbedienung zugeordnet werden. Gruppenverschachtelung wird nicht aufgelöst.

Die standardmäßig deaktivierte Trusted-Header-Anbindung bleibt eine ausdrücklich
konfigurierte Vertrauensdelegation an einen Gateway. Nach Prüfung des gemeinsamen
Geheimnisses können dessen Header eine delegierte Rolle liefern; dies ist kein
Nachweis einer lokalen Gruppenmitgliedschaft und wird nicht als solcher
beworben. Ungültige lokale Gruppenpolicy sperrt diese Anbindung zusätzlich.
Absicherung und Authentifizierung dieses Gateway bleiben eigene Betriebsaufgaben.

Das Gruppenbudget von fünf Sekunden verwirft verspätete Resultate; es kann den
zugrunde liegenden ioBroker-Leseauftrag nicht abbrechen. Die Datenbanklesungen
sind nicht transaktional: Änderungen während eines bereits laufenden Zugriffs
können erst beim folgenden autorisierten Zugriff sichtbar werden. Das Modul
behauptet keine atomare gruppenübergreifende Momentaufnahme.

JavaScript-Arrays mit Lücken werden von `Array.every` nicht vollständig besucht;
ioBroker-JSON-Objekttransport bildet solche Lücken als `null` ab, was die Prüfung
verweigert. Eine Lücke kann keine exakte Mitgliedschaft der Konto-ID vortäuschen.
Der Review behandelt daher keine beliebigen bereits kompromittierten
Inprozess-Adapterobjekte als eigenständig abgesicherte Vertrauensgrenze.

Nicht ausgeführt wurden eine Anmeldung an der Nutzeranlage, ein vollständiger
realer Admin-8-/Controller-Integrationstest sowie ein externer Sicherheitsreview.
Die offenen allgemeinen Releasehindernisse und bisherigen Betriebsgrenzen
werden durch diese Teilprüfung nicht geschlossen.
