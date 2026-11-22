# HTTP-, Rollen- und Sitzungsprüfung 29.09.2026

Geprüfte Komponente: `src-ts/runtime-executables/main.ts`, gezielt nachgezogener
manuell gepflegter Spiegel `src-ts/runtime-mirrors/main.ts` und daraus erzeugte
produktive `main.js`. Ausgangspaket: NexoWatt UI 1.0.21. Endgültige Version und
Dateihashes ergeben sich aus dem übergeordneten Release-/Prüfbericht.

Prüfmaßstab: serverseitige Vertrauensgrenzen, minimale Rechte, widerrufbare
Sitzungen und Eingabevalidierung nach dem vereinbarten EOS-Sicherheitsprozess.
Dies ist eine konkrete Quellcode- und lokale HTTP-Prüfung, keine vollständige
ASVS-Erfüllung, CRA-Konformitätsbescheinigung oder unabhängige Zertifizierung.

## Befunde und Nachbesserungen

| Kennung | Betroffene Funktion / tatsächlicher Befund | Änderung / Nachweis |
| --- | --- | --- |
| NW-AUTH-01 | `/api/set`, Installer-Scope: Rollenprüfung hing von `auth.enabled` und `protectWrites` ab. | Aktuelle echte Fachrolle unabhängig von Kundenschaltern, direkt vor technischer Schreibverzweigung; HTTP-Tests mit auth=false und all/lan/session. |
| NW-AUTH-02 | Unbekannte Scopes landeten im allgemeinen Settings-Fallback und umgingen z. B. die explizite `peakShavingEnabled`-Sperre. | Feste Scope-Liste vor Schreibplanung, begrenzte Schlüssel, strikter generischer Fallback; Negativtests ohne State-Mutation. |
| NW-AUTH-03 | Cookiesitzungen behielten Gruppenrechte nach Demotion, Passwortänderung, Kontosperre oder Löschung bis Ablauf. Auth-Aus meldete teilweise Adminrechte ohne Anmeldung. | Konto und Passwort-Fingerabdruck bei jedem autorisierten Request neu lesen, Rolle neu bestimmen, fehlende/defekte Daten verweigern Zugriff. Kein virtueller Admin-Bypass; alte Sitzungen ohne Kontobindung ungültig. |
| NW-AUTH-04 | Fehlende/ungültige Kundenpolicy bedeutete `all`; parallele Logins und Sitzungslisten waren unzureichend begrenzt. | Fallback `session`, maximal 3 gleichzeitige Passwortprüfungen je Socket-Adresse/16 gesamt, 5-Sekunden-Rückruflimit, 8 Sitzungen/Konto und 256 gesamt, TTL maximal 24 h, Rate-Limit-Map maximal 1024 Adressen. Browser-Login ersetzt dessen vorgelegtes Token. |
| NW-AUTH-05 | `Origin: null` wurde zugelassen; kaputte Cookie-Prozentkodierung warf eine Ausnahme. | Opaque/fremde Origin abweisen, Cross-Site-Fetch ohne Origin ebenfalls abweisen, ausschließlich HTTP(S)-Origin; kaputte Cookies werden als ungültig behandelt. Normale gleiche Origin und dokumentierter ioBroker-Admin-Hostzugriff bleiben nutzbar. |
| NW-AUTH-06 | Rekursiver Konfigurations-Merge folgte `__proto__` in geerbte Ziele; geschachtelte Konfiguration konnte den Prozessprototyp verändern. | Vor jeder JSON-Mutation und jedem direkten Merge alle Ebenen auf `__proto__`, `constructor`, `prototype` prüfen; Begrenzung auf Tiefe 64/100000 Objekte, nur eigene Zielwerte übernehmen, Arrays tief kopieren. Echte HTTP- und direkte Merge-Negativtests. |
| NW-AUTH-07 | Flow-Schnellsteuerung akzeptierte beliebige endliche Sollwerte trotz UI-Min/Max. | Konfigurations- und verfügbare DP-Grenzen schneiden und vor Manual-Hold/Geräteschreiben durchsetzen. Fehlende Grenzen 409, widersprüchlicher/überschrittener Bereich 400, explizit nur lesbarer DP 403. Tests weisen ausbleibende Hardware-Schreibaufrufe nach. |
| NW-AUTH-08 | Kiosk-States enthielten Stations-Bearer in `csvExportUrl`/JSON-`csvUrl` und gelangten in öffentlichen Snapshot/SSE. Privilegiertes SSE behielt zudem seinen internen Zugang über den Sitzungsablauf hinaus. | Gesamten `chargeKiosk.*`-Unterbaum aus öffentlichen Snapshots filtern; langlebiger SSE-Kanal liefert immer gefilterte LIVE-Werte. Interne Diagnosen weiter nur über HTTP mit aktueller Rollenprüfung. Tests auf verschachtelte URL-Token und privilegiertes SSE. |
| NW-AUTH-09 | Stations-`set-mode` umging `allowedModes`, obwohl `start` diese prüfte. | Auch Detailbefehl/Alias prüfen Freigaben: pv/solar→solar, boost/fast/minpv→fast, auto→auto; unbekannt verweigern. Keine automatische Rückstufung eines ungültigen Befehls auf auto. |
| NW-AUTH-10 | Kurze neu eingetragene Stations-Bearer wurden unbegrenzt akzeptiert. | Neue/geänderte Tokens beim AppCenter-Speichern und Backup-Import auf 32–128 URL-sichere Zeichen und Eindeutigkeit prüfen. Browser-Generator liefert 128 zufällige Bits. Unveränderte Alt-Tokens werden nicht heimlich ausgetauscht. Syntax allein beweist keine Entropie. |

Trusted-Header-Secrets werden zusätzlich mit konstantzeitlichem Hashvergleich
geprüft und benötigen mindestens 32 Zeichen. Das Verfahren bleibt eine explizite
Vertrauensdelegation an den konfigurierten Gateway/Proxy.

## Tatsächlich ausgeführte Prüfungen

Umgebung: Linux, Node.js 24.19.0, lokale Express-TCP-Listener auf Loopback,
ioBroker-Benutzer/Gruppen/States und Geräte-Schreibaufrufe als Fixtures.
Keine Produktionskonten, externen Server oder realen Aktoren beteiligt.

- `node scripts/verify-cra-auth.cjs`: **19/19 bestanden**, neue HTTP-/Funktionsregressionen, einschließlich
  Passwort-Timeout, Kontowiderruf, Rollenänderung, Login-Limits, Prototyp-Schutz,
  Flow-Sollwerte, Token-Schutz und sichere Policy. Rohbeleg im Release-Prüflog.
- `node scripts/verify-stable-1.0.9-access.cjs`: Bestandsregression für
  Admin/Installer/Kunde, Direkt-URLs, kodierte Static-Pfade, Backup/Setupgrenzen,
  Login bei ungültiger Lizenz, Kundengerätebedienung. Bestanden.
- `node scripts/verify-mesh-coordinator-access.cjs`: bestehende Mesh-Zugriffsregression
  mit aktivierter/deaktivierter Kundenauth. Bestanden.
- `node scripts/verify-customer-write-policy.js`: sicherer Default, explizite
  Legacy-Modi, echte Socket-Adresse und vorhandene Origin-Grenze. Bestanden.
- `node scripts/check-repository-secrets.cjs`: eigener Zwischenstand ohne Befund;
  abschließenden Gesamtstand behandelt das zentrale Release-Gate.

Der alte, optionale `verify-protected-license-rc45.js` war nicht ausführbar: Er
referenziert fest das nicht mehr vorhandene Bundle `index-CCQUiWc9.js` und erwartet
zudem obsolete Installer-Lizenzrechte. Diese Altprüfung ist keine bestandene
Freigabeprüfung. Ihre heutigen Rollenfälle werden im tatsächlich ausgeführten
1.0.9-HTTP-Test geprüft. Weitere Builds/Volltests siehe zentraler Prüfbericht.

## Upgrade, verbleibende Grenzen und Betriebsanforderungen

1. Bei fehlender/ungültiger Policy müssen Kunden sich zur Bedienung anmelden.
   Bestehende explizite `all`/`lan`-Konfigurationen erlauben weiterhin die vorgesehenen
   vorkonfigurierten Kundenschaltfunktionen. Diese bewussten Legacy-Ausnahmen sind
   keine streng authentisierte CRA-Zielkonfiguration und müssen vor Serienfreigabe
   auf `session` umgestellt oder anlagenbezogen bewertet werden. Technische
   Installer-/Adminrechte werden dadurch niemals freigegeben. Regelalgorithmen
   laufen während gesperrter HTTP-Bedienung unverändert weiter.
2. Anmelden setzt ein vorhandenes, aktiviertes ioBroker-Benutzerobjekt mit Passwort
   und passender EOS-Rolle voraus. Es werden keine Standardkonten/-passwörter erzeugt.
   Die bereits vorhandene strikte Lizenz-Anmeldung bleibt auch ohne aktive Lizenz
   erreichbar. Benutzer-/Passwortanlage erfolgt im abgesicherten ioBroker/EOS Admin.
3. Kiosk-Alt-Tokens, die früher kurz oder mit schwacher Zufallsquelle erzeugt wurden,
   im AppCenter bewusst neu erzeugen und Stations-URL am Display aktualisieren.
   Ein altes Backup mit schwachem, auf diesem Ziel unbekanntem Token muss vor Import
   einen neuen sicheren Token erhalten. Kein produktiver Kiosk wurde hier umgestellt.
4. Flow-Sollwertbedienung benötigt gültige Min/Max aus Konfiguration oder Ziel-DP.
   Fehlende Bereiche im AppCenter vor Geräte-Inbetriebnahme ergänzen. Positive
   Geräte-/Anlagen- und Browserprüfung vor Produktivübernahme bleibt offen.
5. Die Runtime lauscht weiterhin HTTP. Cookies sind nur bei tatsächlich verschlüsseltem
   Socket `Secure`; fremde Forwarded-Header werden nicht vertraut. TLS-Terminierung,
   Zertifikatsprüfung, Netzwerkgrenzen und Proxy-Konfiguration sind gesondert zu
   realisieren/prüfen. Diese Änderung behauptet keine Transportverschlüsselung.
6. Origin-Freigabe desselben Hostnamens über andere Ports bleibt aus Gründen der
   ioBroker-Admin-Integration bestehen. Dienste auf diesem Host und konfigurierte
   zusätzliche Origins gehören damit zur Browser-Vertrauensgrenze. DNS-Rebinding,
   vollständige CSP, geteilte Cookie-Namen mehrerer Instanzen und alle externen
   Read-only-Schnittstellen wurden nicht als vollständig abgesichert nachgewiesen.
7. Historischer Stand bis einschließlich 1.0.33: Rollen konnten über konfigurierte
   Benutzernamen zusätzlich zu Gruppen vergeben werden. Ab 1.0.34 gilt die unten
   dokumentierte Umstellung auf tatsächliche Gruppenmitgliedschaften. Keine
   pauschale Aussage über Rechte anderer ioBroker-Adapter oder den js-controller.

## Ergänzung 03.11.2026 – kanonische Kontoidentität (1.0.33)

- **NW-AUTH-11:** Der Vorab-Kontozugriff verwendete die rohe Eingabe als ID-Suffix. Controllergültige Anzeigenamen, abweichende Groß-/Kleinschreibung und vollständige IDs konnten dadurch vor der Passwortprüfung abgewiesen werden. Konten werden jetzt über den öffentlichen Controllervertrag aufgelöst.
- **NW-AUTH-12:** Rollen-/Sitzungsidentität war nicht an die vom Passwortprüfer bestätigte ID gebunden. Passwortprüfung erfolgt nun ausschließlich für die vorher aufgelöste kanonische ID; die Callback-ID muss exakt übereinstimmen. Passwortfingerabdrücke umklammern weiterhin die Prüfung. Anzeigenamenkollisionen mit Rollenbezeichnungen verleihen keine Rolle.
- **NW-AUTH-13:** Der Passwortwrapper wandelte beliebige Truthy-Rückgaben in Erfolg um. Nur der echte Boolean `true` zusammen mit passender ID ist jetzt gültig; Promise-Ablehnungen und verspätete Ergebnisse erzeugen keine Sitzung.

Nachweis und Grenzen: [aktueller Prüfbericht](../reports/admin8-login-2026-11-03/PRUEFBERICHT_DE.md), [Kontoprüfung](../reports/admin8-login-2026-11-03/AUTH_PRUEFVERMERK_DE.md). Die beschriebenen Fehler wurden lokal mit synthetischer Controller-I/O reproduziert; die konkrete Ursache auf der gemeldeten Installation ist ohne deren Abnahme noch nicht bestätigt.

## Ergänzung 03.11.2026 – Rollen aus tatsächlichen Gruppen (1.0.34)

- **NW-AUTH-14:** Trotz kanonischer Kontoidentität wurden in 1.0.33 Rechte noch
  durch eingebaute Kennungen (`admin`, `installer`, `kunde`, `user`, `customer`)
  und konfigurierte Benutzerlisten vergeben. Eine Gruppenentfernung konnte diese
  zusätzlichen Rechte deshalb nicht entziehen. Die lokale Rollenauflösung in
  1.0.34 berücksichtigt ausschließlich tatsächliche Mitgliedschaften in explizit
  zugeordneten ioBroker-Gruppen. Benutzer- und Anzeigenamen verleihen keine Rechte.
  Priorität: hoch bei installationsbedingt möglicher Kontoanlage/-änderung oder
  irrtümlich fortbestehenden Namenszuordnungen; kein nachgewiesener externer Angriff.
- **NW-AUTH-15:** Die frühere Gruppenprüfung las `common.members`, ohne die
  zurückgegebene Objekt-ID und den Objekttyp zu bestätigen. In 1.0.34 müssen
  Gruppen-ID, Typ `group`, Mitgliederliste und die kanonische Benutzer-ID
  zusammenpassen. Fehlerhafte Konfiguration oder fehlerhafte vorhandene
  Gruppenobjekte geben keine Ersatzrolle frei. Lesefehler und Zeitüberschreitungen
  verweigern die Rollenauflösung. Das begrenzt falsche Rechtefreigaben bei
  inkonsistenten Objekten beziehungsweise fehlerhafter interner I/O; eine direkte
  Kontrolle dieser internen Daten durch einen anonymen HTTP-Client ist damit
  nicht behauptet.

Eigene Gruppen werden im Admin-Reiter **Sicherheit** den bestehenden EOS-Rollen
zugeordnet. Damit erhalten auch Benutzer mit frei gewählten Namen die Rechte
ihrer zugeordneten Gruppen. Unbekannte Gruppen erhalten nicht automatisch eine
EOS-Rolle. Generische ioBroker-ACLs werden nicht als vollständige EOS-Funktionsrechte
interpretiert. Mehrfachmitgliedschaften sind ausdrücklich nach
Administrator vor Installateur vor Kunde geordnet.

Geltungsbereich der ausschließlichen Gruppenableitung ist die lokale
Benutzer-/Passwortanmeldung samt ihrer Cookiesitzungen. Die bestehende, im
Standard ausgeschaltete Trusted-Header-Anbindung bleibt eine ausdrücklich
konfigurierte Gatewaydelegation mit eigenem Geheimnis und eigener Rollenbehauptung.
Sie wird nicht als lokale Anmeldung oder als neu geprüfte Gatewayintegration
ausgegeben; eine ungültige lokale Gruppenpolicy sperrt auch diesen Zugriffsweg.

Die Umstellung verändert keine Benutzerobjekte, Passwörter oder Gruppen. Betreiber
müssen vorhandene reine Namenszuordnungen vor dem Update in beabsichtigte
Gruppenmitgliedschaften überführen. Dieser Sicherheitswechsel und sein möglicher
Anmeldeentzug sind in [der Betriebsanleitung](../operations/BENUTZER_GRUPPENRECHTE_DE.md)
dokumentiert. Zuständig für die konkrete Mitgliedschaft ist der Betreiber;
die Softwareänderung und Prüfbelege liegen bei NexoWatt.

Quell-/Buildbindung, tatsächlich ausgeführte positive und negative Prüfungen sowie
offene Integrationsnachweise stehen im
[Prüfbericht 1.0.34](../reports/groups-auth-2026-11-03/PRUEFBERICHT_DE.md).
Dieser Eintrag beansprucht weder eine bereits ausgeführte Anlagenabnahme noch
vollständige ASVS-/IEC-/CRA-Erfüllung.

## HTTPS-Admin und Instanzbindung – Stand 1.0.35

- **NW-AUTH-16 – HTTPS zum reinen HTTP-Laufzeitport (Verfügbarkeit):** Der Admin-Tab übernahm das Browserprotokoll für den separaten UI-Port. Der Nutzer meldet Admin 8.3.5 über HTTPS und abgebrochene Status-/Loginabrufe. Neuer Weg: offizieller opt-in Instanzproxy ab Admin 8.3 auf demselben Origin; kein automatischer Passwort-Downgrade. Konkrete Anlagenursache und Abnahme bleiben bis zum Vor-Ort-Test offen.
- **NW-AUTH-17 – Passwortversuch auf falschem Standardport (Identitäts-/Transportbindung):** Trotz gelesener Instanzkonfiguration konnte zuerst 8188 angesprochen werden; ein dortiges 401 brach die Anmeldung ab. Der Instanz-Queryparameter war keine serverseitige Zielbindung. Neue Einzielauflösung verwendet ausschließlich die ausgewählte Proxyinstanz beziehungsweise den autoritativ gelesenen direkten HTTP-Port; keine Passwort-/Mutationswiederholung auf anderen Ports.
- **NW-AUTH-18 – Irreführende/überholte Anmeldeanzeigen (Zustandskonsistenz):** Ein Netzwerkfehler nach Login wurde als fehlende Rolle ausgegeben; überlappende Statusantworten konnten neuere An-/Abmeldungen überschreiben. Generationen- und Ablaufprüfungen verhindern veraltete UI-Übernahmen; Proxy-, Passwort- und Transportfehler werden getrennt. Ein UI-Zustand ersetzt weiterhin keine Backendberechtigung.

Die Proxy-Unterpfadunterstützung verändert ausschließlich die Darstellung und lokale URL-Auflösung, niemals Benutzeridentität, Rollen oder Hardwarefreigaben. Eingehende Forwarded-Pfade sind streng begrenzt und an die eigene Instanz gebunden; aus ihnen wird kein vertrauenswürdiger Benutzer oder Client abgeleitet. Browser- und HTTP-Regressionen sowie tatsächlich ausgeführte Prüfgrenzen stehen im [aktuellen Prüfbericht](../reports/admin-https-2026-11-03/PRUEFBERICHT_DE.md). Die neue [Betriebsanleitung](../operations/ADMIN_HTTPS_PROXY_DE.md) nennt Admin-Mindestversion, Proxy-Administratorgrenze, Bind-/TLS-/Mehrhostgrenzen und Rückfall.
