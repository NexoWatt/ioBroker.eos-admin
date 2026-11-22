<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# Zwei Anmeldeprofile ab NexoWatt UI 1.0.37

Stand: 19.11.2026. Diese Anleitung beschreibt die Konfiguration und das
vorgesehene Verhalten des Lieferstands. Softwareprüfungen und tatsächlich
ausgeführte Anlagenabnahmen sind im zugehörigen Prüfbericht getrennt angegeben.

## Profil ausdrücklich wählen

Im ioBroker-Admin die UI-Instanz öffnen und unter **Sicherheit → Anmeldeprofil**
genau eine Variante wählen. Anschließend speichern und den Adapter neu starten.

| Profil | Anmeldung und Berechtigungsquelle | Einsatz |
| --- | --- | --- |
| `auth.mode = iobroker` | Eigenes bestehendes ioBroker-Konto; der UI-Server prüft Passwort und Gruppen und führt eine eigene Sitzung. | Eigenständige UI, auch für den Apple Premium Service; kein EOS-Admin erforderlich. |
| `auth.mode = eos` | Der UI-Server prüft die zentrale EOS-Admin-Sitzung am fest konfigurierten Sitzungsendpunkt. | Vollständiges EOS mit zentralem Einstieg. |

Ein fehlender oder nicht erreichbarer EOS-Dienst schaltet niemals auf die lokale
Passwortanmeldung um. Ein unbekanntes Profil oder eine fehlerhafte Konfiguration
lässt die Oberfläche gesperrt. Die Voreinstellung für neue und bisherige
ioBroker-Installationen ist `iobroker`.

## Eigenständige ioBroker-UI

Die separate Anmeldeseite nimmt Benutzername und eigenes Passwort entgegen.
Das Passwort wird unverändert übermittelt und weder im Browser-Speicher noch in
einem zusätzlichen Passwortbestand der UI abgelegt. Passwortmanager und Einfügen
bleiben möglich. Konten, Passwörter und Gruppen werden weiterhin in ioBroker
verwaltet; das Update erzeugt keine Standardzugänge und ändert keine vorhandenen
Kontopasswörter.

Die vorhandenen Gruppenzuordnungen unter `accessControl.adminGroups`,
`installerGroups` und `customerGroups` bleiben maßgeblich. Der Name eines Kontos
verleiht keine Rolle. Ein Installateur benötigt nur seine vorgesehene NexoWatt-
Funktionsrolle, keine pauschale Mitgliedschaft in der ioBroker-Administratorgruppe.
Siehe [Benutzer und Gruppenrechte](BENUTZER_GRUPPENRECHTE_DE.md).

Ein Konto mit verpflichtender Mehrfaktor-Anmeldung darf nicht allein durch
`checkPassword` freigegeben werden. Solche Konten werden vom Passwortpfad
abgewiesen; die Aktivierung des zweiten Faktors entzieht auch bestehenden lokalen
Sitzungen den Zugang. Dieser Stand implementiert keine eigene TOTP-, Backupcode-
oder Passkey-Anmeldung. Eine solche spätere Anbindung muss den vollständigen
Authentifizierungsablauf unterstützen. Die MFA-Vorgabe nicht zur Umgehung dieser
Sperre deaktivieren.

## Zentrales EOS

| Einstellung | Bedeutung |
| --- | --- |
| `auth.eosSessionUrl` | Feste URL des vorhandenen EOS-Admin-Endpunkts `/nexowatt/security/session`. HTTPS ist vorgesehen; HTTP ist ausschließlich für eine Prozessverbindung zu einer wörtlichen Loopback-IP erlaubt. |
| `auth.eosLoginUrl` | Öffentlicher zentraler Anmeldepfad, z. B. der zur Installation passende `/index.html?login`-Pfad. Relative URL am gemeinsamen Ursprung oder HTTPS-URL. |
| `auth.eosLogoutUrl` | Öffentlicher Pfad für die zentrale Abmeldung, passend zur Installation, etwa `/logout`. |
| `auth.eosCaFile` | Optionaler absoluter Dateipfad zu einer PEM-CA für die interne HTTPS-Prüfung. Leer verwendet den System-Vertrauensspeicher. |
| `auth.trustedProxyIps` | Optional: konkrete tatsächliche Peer-IP-Adressen des vorgesehenen HTTPS-Proxys, durch Komma getrennt. Kein gesamtes LAN freigeben. |

Keine Kennwörter, Cookies oder Token in diese URLs eintragen. Die CA-Datei enthält
das Vertrauenszertifikat, keinen privaten Schlüssel. Die TLS- und Hostnamenprüfung
bleibt aktiv. Zertifikatsfehler werden nicht durch Abschalten der Prüfung behoben.

Browserzugang, Cookie-Host und Proxy-Pfad müssen zusammenpassen. Unterschiedliche
Ports sind keine Cookie-Isolation. Der Server übernimmt nur die bestätigte
Identität und Rolle der zentralen Sitzung; Browserparameter oder frei gesetzte
Benutzer-/Rollenheader sind kein Nachweis. EOS-Fehler führen nicht zu einer
anderen Anmeldemethode. Ein erforderlicher zentraler Passwortwechsel muss dort
abgeschlossen werden, bevor die UI freigegeben wird.

Die UI-Anmeldeseite zeigt in diesem Profil ausschließlich **Zentral anmelden**.
Sie enthält keine lokale Passwortmaske. Die zentrale Abmeldung muss ebenfalls
abgeschlossen werden; die UI sperrt ihre Ansicht und führt zum konfigurierten
Abmeldeziel. Ein im Admin eingebetteter Bereich bietet dafür einen separaten
Fensterlink.

Für den direkten zentralen Einstieg **Endkunde → UI, Installateur → Portal,
Administrator → Admin mit UI-Link** liegt ein auf den belegten EOS-dev9-Stand
begrenzter Integrationsbaustein bei. Seine
[Anleitung](../integrations/EOS_ADMIN_DEV9_UI_LOGIN_DE.md) beschreibt die
verpflichtende gemeinsame Proxyroute, die exakten Originalhashes, den
Prüfaufruf, Sicherung und Rückfall. Er ist separat anzuwenden und wurde nicht
auf eine laufende EOS-Installation übertragen.

## Browserzugang und Rollen

Für den Browser HTTPS einrichten. Ein Passwortlogin über unverschlüsseltes HTTP
ist außerhalb von Loopback gesperrt. Ein HTTPS-Weiterleitungsheader gilt nur bei
einer tatsächlich vertrauenswürdigen Proxyverbindung; ein frei gesendeter Header
oder die Zugehörigkeit zum LAN reichen nicht aus. VPN ersetzt HTTPS und
Authentifizierung nicht.

Benutzer gelangen zur Bedienoberfläche. Installateure und Administratoren können
zusätzlich ihre freigegebenen Einrichtungen öffnen; Lizenz- und
Benachrichtigungsverwaltung bleiben an die Administratorrolle gebunden. Der
Rücksprung nach dem Login ist auf bekannte UI-Seiten derselben Instanz begrenzt.
Er kann weder ein fremdes Ziel noch einen API-Aufruf oder eine technische
Einrichtung für Kunden freigeben. Der Server prüft jeden Zugriff zusätzlich.

Eingebettete Ansichten fragen keine Kennwörter ab. **Anmeldung öffnen** startet
eine separate Seite; nach erfolgreicher Anmeldung im ursprünglichen Bereich
**Erneut prüfen** verwenden. Die Sitzungsprüfung wird auch bei Rückkehr in den
Tab und aus dem Browser-Verlauf wiederholt. Offlinebetrieb und eine nicht
bestätigte Prüfung lassen die Oberfläche verborgen. Ein fachlicher HTTP-403,
beispielsweise wegen einer fehlenden Lizenz, wird nicht als verlorene Sitzung
umgedeutet, solange die Rollenprüfung weiterhin erfolgreich ist.

Mutationen und Abmeldung verwenden `X-NW-CSRF` aus der bestätigten Sitzung.
Der Browser fügt diesen Header nur eigenen Runtime-Aufrufen am selben Ursprung
hinzu. Nach einer erneuten Anmeldung werden Schalt- und Speicherbefehle niemals
automatisch wiederholt. Ein Verbindungsfehler beim Abmelden wird als nicht
bestätigte Abmeldung angezeigt; die lokale Ansicht bleibt gesperrt.

## Migration, Prüfung und Rückfall

1. Konfiguration und vorherigen Paketstand sichern. Einen funktionierenden
   ioBroker-Admin-Zugang für die Konfiguration bereithalten.
2. Profil, Kontengruppen und HTTPS-Zugang prüfen. Für EOS die drei zentralen URLs
   und gegebenenfalls CA-/Proxyangaben ausdrücklich konfigurieren.
3. Nach dem Neustart je ein Kunden-, Installateur- und Administratorkonto prüfen:
   vorgesehene Bedienung funktioniert; fremde technische Bereiche bleiben gesperrt.
4. Direkte Port-/API-Aufrufe ohne Sitzung, falsche Passwörter, fehlende CSRF-Token,
   zentrale Dienststörung, Abmeldung und Tab-/Offline-Rückkehr prüfen. Keine
   Kennwörter oder Token in Diagnoseberichte übernehmen.

`auth.enabled = false`, `protectWrites = false` und frühere Ausnahmen `all` oder
`lan` öffnen ab diesem Stand keinen anonymen Zugang. Diese beauftragte Änderung
muss vor dem Update bei bisherigen Installationen berücksichtigt werden.

Ein Rückfall erfolgt aus der eigenen Sicherung des vorherigen vollständigen
Stands einschließlich Konfiguration. Er stellt dessen frühere Schutzgrenzen
wieder her und ist keine gleichwertige Sicherheitskorrektur. Der konkrete
EOS-Admin-, HTTPS-Proxy- und Anlagenbetrieb ist vor einer allgemeinen Freigabe
gesondert abzunehmen.

## Passwortprinzipien und Nachweisgrenze

Die Kontenverwaltung ist für die Passwortrichtlinie zuständig; der UI-Login
verändert keine bestehenden Kontenregeln. Als Ziel für neue Richtlinien gelten
lange Passphrasen, Prüfung gegen häufige/kompromittierte Passwörter und
serverseitige Begrenzung fehlgeschlagener Anmeldungen. NIST SP 800-63B-4 verlangt
bei alleiniger Passwortauthentifizierung mindestens 15 Zeichen; acht Zeichen
sind nur als Bestandteil von MFA zulässig. Mindestens 64 Zeichen sollten
zugelassen werden. Keine pauschalen Zeichenklassenpflichten und keine
periodischen Wechsel ohne Anlass; bei Kompromittierung ist ein Wechsel nötig.

Sitzungsschutz und Passwortspeicherung sind getrennte Aufgaben. Würden künftig
eigene Kennwörter verwaltet, wäre ein bewährtes geeignetes Passwort-Hashverfahren
mit individuellem Salt erforderlich. Dieser Adapter behauptet weder einen
bestimmten Hashalgorithmus des ioBroker-Bestands noch eine vollständige
NIST-/OWASP-Konformität. MFA und Passkeys sind eine getrennt umzusetzende
Erweiterung, kein bereits vorhandener Standalone-Leistungsumfang.

Primärquellen, am 19.11.2026 geprüft:

- [NIST SP 800-63B-4, finale Ausgabe Juli 2025](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
