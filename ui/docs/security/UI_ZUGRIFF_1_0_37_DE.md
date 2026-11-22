# Sicherheitsentwurf – UI 1.0.37

## Produktgrenze und Identität

Das Produkt ist derselbe UI-Adapter in zwei ausdrücklich getrennten Betriebsarten.
`auth.mode=iobroker` prüft lokale ioBroker-Konten und tatsächliche Gruppen; EOS-
Cookies und historische Rollenheader haben dort keine Wirkung. `auth.mode=eos`
prüft die zentrale EOS-Admin-Sitzung bei der konfigurierten festen Schnittstelle.
Es gibt weder automatische Erkennung noch Passwort-Fallback bei Ausfall der Zentrale.
Ein unbekanntes Profil bleibt gesperrt. Die Konfiguration und Anwendung von
Lizenz-/Featurefreigaben bleiben von der Benutzeridentität getrennt.

EOS benutzt nur das bestehende `access_token`-Cookie zur serverseitigen Prüfung.
Andere Cookies, Browserrollen, Passwörter, beliebige Zieladressen oder Refresh-
Tokens werden nicht an die Zentrale weitergereicht. Die Antwort muss den
verifizierten Vertrag erfüllen: authentifiziert, kanonischer Benutzer, zulässige
Rolle, gültige Gruppenliste, kein ausstehender Passwortwechsel. Die UI bildet
`enduser` auf ihre Kundenrolle ab. EOS- und ioBroker-Passwortdatenbanken werden
nicht kopiert oder zusammengelegt.

## Bedrohungen, Anforderungen und Umsetzung

| Kennung | Bedrohung/Anforderung | Umsetzung und Nachweis |
| --- | --- | --- |
| UI37-A01 | Direkter Port oder neue Route umgeht Login | Zugangsschranke vor Seiten-, Static-, Lizenz- und Datenrouten; unbekannte Routen geschützt; HTTP-Negativtests |
| UI37-A02 | Cookie einer anderen Instanz/eines anderen Profils | Name und Sitzungsinhalt an Instanz, Port und Profil gebunden; alte ungebundene Cookies werden nicht akzeptiert |
| UI37-A03 | Browser behauptet Installer/Admin | Ausschließlich aktuelle Kontogruppen bzw. validierte zentrale Rolle; serverseitige Capabilities |
| UI37-A04 | Fremde App auf anderem Port liest CSRF-/Lizenzdaten | Exakte Origin aus Schema, Host und Port; abweichende Origins nur ausdrücklich konfiguriert; keine pauschale Same-Host-Freigabe |
| UI37-A05 | Fremde Webseite sendet Kundenbefehl | Origin-Prüfung, HttpOnly/SameSite-Cookie und sitzungsgebundener `X-NW-CSRF` bei Mutationen |
| UI37-A06 | Rechte-/Passwortänderung oder Logout wirkt nicht | Konto vor/nach Gruppenprüfung prüfen; Rollenrevision binden; vor jedem SSE-Frame neu prüfen; Logout schließt passende Streams |
| UI37-A07 | Hängende Kontoprüfung/Zentrale bindet Ressourcen | Gemeinsame Fristen; Controller-Spätergebnisse verworfen; EOS-Netzwerk nach höchstens 5 s zerstört; Antwort <=32 KiB; Parallelität begrenzt |
| UI37-A08 | Passwort-Raten über viele IPs | Begrenzung pro Konto und Quelle, Reservierung vor paralleler Prüfung, begrenzte Maps, generische Fehlermeldungen |
| UI37-A09 | Weiterverwendung alter privater Offline-Shell | Neue Cachegeneration entfernt alte Shell; private Seiten/APIs ausschließlich Netzwerk; BFCache-/Sichtbarkeitsprüfung |
| UI37-A10 | Bestehende 2FA wird durch Passwortcheck umgangen | Lokaler Passwortpfad verweigert Konten mit `common.externalAuthentication.totp`; Aktivierung entzieht alte UI-Sitzung |
| UI37-A11 | Sessionprüfung folgt fremdem Ziel/ungültigem TLS | Feste konfigurierte URL, keine Redirects/Retryketten, Zertifikatsprüfung; lokale zusätzliche CA optional; HTTP nur literal Loopback |
| UI37-A12 | Sicherheitsänderung koppelt EMS an Browser | Keine Änderung der Regelalgorithmen/Writer; Maschinenendpunkte behalten gesonderte Authentifizierung |

Die öffentlichen Ausnahmen liefern Programmdateien, Login/Status oder erreichen
explizit ihre eigene bestehende Maschinen-Tokenprüfung. Private HTML-Seiten und
JSON-Konfiguration werden dadurch nicht öffentlich. Bereits abgeschlossene
Gerätebefehle werden durch einen späteren Sitzungswiderruf nicht rückgängig gemacht.
Rollen-/Kontolesungen sind keine Datenbanktransaktion; eine Prüfung beschreibt
den während ihrer Ausführung belegten Berechtigungsstand.

## Transport und Proxy

Die Adapterruntime behält ihren vorhandenen HTTP-Listener. Der sichere externe
Einstieg erfolgt über HTTPS, insbesondere den vorhandenen Admin-/Reverse-Proxy.
Die UI installiert keine Firewall und stellt keine Zertifikate aus. Nur der
tatsächliche Loopback-Peer oder ausdrücklich konfigurierte Proxy-IP-Adressen
können den streng validierten HTTPS-/Prefix-Hinweis liefern. Client-IP-Header
werden nicht für Login-Ratenbegrenzungen als selbstbehauptete Identität verwendet.

Für normalen Betrieb sind vertrauenswürdiges HTTPS und passende Proxyregeln
erforderlich. Sämtliche extern angelieferten Proxyheader müssen am Proxy entfernt
bzw. durch eigene Werte ersetzt werden. Ein VPN ersetzt keine Anmeldung oder TLS.

## Kennwörter und zweite Faktoren

Der Adapter führt keine neue Passwortspeicherung und keinen Master-/Installateur-
Universalcode ein. Passwortanlage, -änderung und Wiederherstellung gehören zum
ausgewählten Kontensystem. Bestehende gültige Passwörter werden nicht allein
wegen einer neuen Längenvorgabe bei der Anmeldung zurückgewiesen. Für neue
Ein-Faktor-Konten ist die Betriebsrichtlinie mindestens 15 Zeichen, Unterstützung
langer Passwörter und Passwortmanager sowie eine Sperrliste schwacher/kompromittierter
Werte beim Kontensystem. Keine Behauptung, die UI allein erzwinge diese Anlagepolicy.

TOTP wird beim lokalen Passwortweg absichtlich nicht eigenständig implementiert.
Solche Konten bleiben dort gesperrt. Die zentrale EOS-Anmeldung kann ihre eigenen
Faktoren prüfen; die UI akzeptiert erst deren gültige Sitzung. Passkeys und native
TOTP-Anmeldung im Standalone-UI sind keine Funktionen dieser Lieferung.

## Quellen und Abgrenzung

- Vorliegender EOS-Quellstand: `NexoWatt_EOS_dev9_Erststart_PiUpdate_FULL_2026-10-04.zip`,
  `components/admin/src/lib/web.ts`: `sendEosSecuritySession` und `getEosRequestAccess`.
- [ioBroker Admin](https://github.com/ioBroker/ioBroker.admin), geprüft 19.11.2026:
  TOTP-Anmeldung seit der dort dokumentierten Version 8.3.13.
- [ioBroker Webserver TOTP-Vertrag](https://github.com/ioBroker/webserver/blob/424d3940640f6ebd8dc79d5fc0081b96b8bda438/src/lib/totp.ts),
  Quellen-SHA-256 `c67c21f67c038a8c42578abd547d0acfde76145fdd8dbd32220f1941fb126a64`.
- [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html), Passwort-
  und Sitzungsanforderungen als Entwurfs-/Betriebsmaßstab, keine Zertifizierung.
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
  und [Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

Vollständige ASVS-/IEC-/CRA-Konformität, Zielhardware-Reaktionszeiten, Zertifikats-
und Firewallbetrieb oder die Sicherheit sämtlicher vorhandener Drittadapter
werden hiermit nicht bescheinigt. Technischer Prüfstand und offene Anlagenabnahme
stehen im versionsgebundenen Prüfbericht.

