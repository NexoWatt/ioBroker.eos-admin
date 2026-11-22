<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# Admin-HTTPS-Verbindung – Abgleich offizieller Quellen

Stand: 03.11.2026, Zielstand NexoWatt UI 1.0.35. Anlass ist die vom Nutzer bestätigte HTTPS-Verbindung zu Admin 8.3.5 und eine beim EOS-Login abgebrochene HTTP-Anfrage. Dieser Vermerk belegt den Quellvertrag; er allein ist kein Live- oder Integrationstest.

## Versionierter Admin-Vertrag

Der Tag `v8.3.5` des offiziellen Repositorys `ioBroker/ioBroker.admin` wurde abgerufen. Der verwendete Git-Baum hat SHA `6f77eedf525813a7a61d79188d1ff05dffd05086`. Die offizielle Releasehistorie nennt die Einführung von `adminTab.proxy` in 8.3.0. Daraus folgt keine Freigabe dieses Transportwegs für beliebige frühere Admin-8-Versionen.

Primärquellen:

- [InstanceProxy in Admin 8.3.5](https://github.com/ioBroker/ioBroker.admin/blob/v8.3.5/src/lib/instanceProxy.ts), Git-Blob-SHA `d88bedf3b81f66bc4456bf76de5891fe7213ff6d`.
- [Einbindung des Proxys im Admin-Webserver](https://github.com/ioBroker/ioBroker.admin/blob/v8.3.5/src/lib/web.ts).
- [Admin-Hilfsfunktionen und öffentlicher Pfad](https://github.com/ioBroker/ioBroker.admin/blob/v8.3.5/src-admin/src/helpers/utils.ts), Funktion `adminHref`.
- [Tab-Linkaufbau](https://github.com/ioBroker/ioBroker.admin/blob/v8.3.5/src-admin/src/helpers/AdminUtils.tsx), Funktion `getHref`.
- [Offizielle Releases](https://github.com/ioBroker/ioBroker.admin/releases).

## Abgeglichene Eigenschaften

| Eigenschaft | Offizieller Vertrag und Bedeutung für EOS |
| --- | --- |
| Opt-in | `common.adminTab.proxy: true` am Instanzobjekt `system.adapter.nexowatt-ui.<Instanz>` schaltet dessen Proxyziel frei. |
| Browserpfad | Unterhalb des öffentlichen Admin-Pfads: beispielsweise `/proxy/nexowatt-ui.0/api/strict-auth/status` oder `/admin/proxy/nexowatt-ui.0/api/strict-auth/status`. |
| Öffentlicher Admin-Pfad | Admin liefert `socketPath` im Hauptdokument beziehungsweise `_socket/info.js`. `adminHref` fügt darunter relative Pfade ein. In einem Adapter-Iframe darf nur ein geprüfter relativer Pfad derselben Origin benutzt werden. |
| Backendziel | `native.bind`, `native.port` und `native.secure` der Instanz. Bei Bind-Wildcard und demselben ioBroker-Host verwendet Admin `127.0.0.1`; bei fremdem Host wird dessen Adresse aufgelöst. |
| Login des Admin | Bei aktivierter Admin-Anmeldung muss eine gültige lokale Admin-Sitzung vorhanden sein. Ressourcenbezogene OAuth-Clienttokens gelten nicht als Admin-Websitzung. |
| Zusätzliche Proxyberechtigung | Nur tatsächliche Mitglieder von `system.group.administrator` passieren den Proxy. Eine EOS-Installateurrolle oder eine andere EOS-Administrator-Aliasgruppe allein erfüllt diese zusätzliche Admin-Grenze nicht. |
| HTTP-Weiterleitung | Methode, Pfad, Query und Körper werden weitergeleitet. Admin überspringt für diese Route seine eigenen Bodyparser. |
| Origin | Der ursprüngliche `Host` wird erhalten; `Origin` bleibt als Browserheader erhalten. EOS muss seine Originprüfung nicht abschalten. |
| Antwort | Der Proxy leitet Körper unverändert weiter. Er schreibt `Location` und Cookie-Pfade um; HTML-Inhalt und darin enthaltene absolute Asset-/API-Pfade werden nicht umgeschrieben. |
| Cookiebereich | EOS-Cookies mit `Path=/` erhalten den jeweiligen Proxypräfix als Pfad. Nach Proxylogin müssen nachfolgende geschützte API-Aufrufe denselben Proxybereich nutzen. |
| Fehler | Die eigene Proxyprüfung kann 401 `Unauthorized`, 403 `Forbidden` oder 404 `Not Found` als Text/HTML zurückgeben; ein nicht erreichbares Ziel ergibt 502. Das sind nicht automatisch EOS-Passwortfehler. Rückgabekörper dürfen nicht ungeprüft als Diagnose angezeigt werden. |

Die bestehende lokale HTML-Admin-Tabseite muss für API-Aufrufe über diesen Weg nicht auf eine vollständig proxierte EOS-Weboberfläche umgestellt werden. Die automatische Umschreibung in `getHref` betrifft externe Tab-Links bei gesetztem Proxyflag. Eine Umstellung der gesamten EOS-Oberfläche erfordert wegen ihrer absoluten Asset-/API-Pfade eine gesonderte Prüfung.

## Sicherheits- und Integrationsgrenzen

Der Proxy transportiert die Anfrage; er ist keine automatische EOS-Anmeldung. Die vorhandene individuelle Passwortprüfung und aktuelle EOS-Gruppenrollen bleiben eine eigene Grenze. Regulärer direkter EOS-Zugang für berechtigte Benutzer ohne ioBroker-Administratorgruppe darf nicht durch die zusätzliche Proxygrenze ersetzt werden. Passwort-POSTs dürfen bei Fehlern nicht auf vermutete andere Ports oder Ziele wiederholt werden.

Admin ergänzt `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host` und `X-Forwarded-Prefix`. Diese Header dürfen keine ungeprüfte Identität oder EOS-Rolle begründen. Die ursprünglichen Admin-Cookies werden weitergeleitet; EOS verarbeitet daraus nicht automatisch Admin-SSO.

TLS wird zunächst für Browser → Admin beziehungsweise dessen HTTPS-Proxy betrachtet. Das interne Zielprotokoll folgt `native.secure`. Die offizielle Admin-Implementierung prüft bei einem HTTPS-Upstream dessen Zertifikat nicht (`rejectUnauthorized: false`); dies ist eine vorhandene Eigenschaft der geprüften Drittkomponente und keine Empfehlung für neue EOS-Netzwerkaufrufe. Für den bisherigen lokalen HTTP-EOS-Dienst wird dadurch kein Ende-zu-Ende-TLS behauptet. Admin ergänzt beim Cookie-Rewrite keinen `Secure`-Parameter. Vorhandene Cookie-/Gatewaygrenzen müssen im Gesamtbericht berücksichtigt bleiben.

Die lokale NexoWatt-Konfiguration besitzt zusätzlich ein Feld `native.ip`, das die Runtime vor `native.bind` berücksichtigt. Wenn diese Felder voneinander abweichen und EOS nur auf einer konkreten Adresse lauscht, muss das mit dem Admin-Proxyziel abgeglichen werden. Eine automatische Erweiterung der Bind-Adresse oder Firewallfreigabe ist daraus nicht abgeleitet.

Admin cached Proxyziele und Administrator-Mitgliedschaften jeweils bis zu zehn Sekunden. Die EOS-eigene erneute Rollenprüfung wird davon nicht ersetzt.

## Normales Adapterupgrade

Für den ebenfalls versionierten js-controller 7.2.5 wurde der normale Updatepfad geprüft:

- [setupUpgrade.ts](https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/cli/src/lib/setup/setupUpgrade.ts), um Zeilen 364–368: Der Upgradeablauf ruft `upgradeAdapterObjects(name, ioPack)` auf.
- [setupUpload.ts](https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/cli/src/lib/setup/setupUpload.ts), `extendCommon` um Zeilen 744–783: `adminTab` wird ausdrücklich als vollständig zu ersetzendes Metadatenfeld behandelt.
- Derselbe Quellpfad, `_upgradeAdapterObjectsHelper` um Zeilen 800–840: Das neue `io-package.common` wird auf die Instanzobjekte des betreffenden Hosts angewandt.

Damit wird `common.adminTab.proxy` beim normalen geprüften Adapterupgrade aus dem Paket in vorhandene Instanzobjekte übernommen. Eine zusätzliche Startup-Mutation von Instanzmetadaten ist für diesen Vertrag nicht erforderlich. Bloßes Austauschen einzelner Dateien ist kein gleichwertiger Nachweis eines durchlaufenen normalen Upgrades. Eine frühere manuelle Metadatenabweichung kann durch das normale Ersetzen von `adminTab` überschrieben werden.

## Belegumfang

Der vollständige offizielle Proxyquelltext wurde unverändert außerhalb des Produktbaums unter `https-investigation/admin8-v8.3.5-instanceProxy.ts` für eine Integrationsprüfroutine bereitgestellt. Sein SHA-256 lautet `ccfd3fcab5466e24166e938dca305a67d8741a0bb85eea027a4b328b9f9b35d2`. Dieser Fremdquelltext wird nicht dadurch Teil des EOS-Produkts. Tests der ausgelieferten Artefakte stehen im übergeordneten Prüfbericht; aus dem Quellenabgleich allein werden keine bestandenen Anlagenprüfungen abgeleitet.

Ergänzend wurde am 03.11.2026 `node https-investigation/verify-official-admin-proxy.cjs` unter Node.js `v24.22.1` tatsächlich ausgeführt. Der unveränderte offizielle Proxy wurde dabei mit einer synthetischen Admin-Sitzungs-/Objektdatenbank und dem tatsächlichen lokalen EOS-Express-Backend verbunden. Die HTTPS-Testgegenstelle wurde gegen die ausdrücklich vertraute kurzlebige Test-CA geprüft; die Prüfverbindung verwendete keine abgeschaltete TLS-Zertifikatsprüfung. Dies ist ein begrenzter Komponenten-Integrationstest, keine vollständige Admin-Installation und kein Kundengerätetest.

Alle neun Prüfungen waren erfolgreich: HTTPS-Proxyzugriff auf den konfigurierten HTTP-Backendport mit öffentlichem Unterpfad; eigenes Kontopasswort mit kanonischer EOS-Sitzung und begrenztem Cookiepfad; anschließender Status-/Lizenzzugriff; falsches EOS-Passwort ohne Sitzung; getrennte Admin-Sitzungsablehnung; fehlende Administratorgruppenmitgliedschaft; fehlendes Instanz-Opt-in; weiterhin wirksame EOS-Originprüfung; Widerruf der EOS-Sitzung nach Gruppenentzug trotz weiterhin gültiger separater Admin-Sitzung. Die bereinigten Rohbelege liegen außerhalb des Produktbaums unter `https-investigation/official-admin-proxy-results.json` und `https-investigation/official-admin-proxy.log`. Die React-Navigation und die später fertiggestellten Releaseartefakte sind durch diesen einzelnen Versuch nicht geprüft.

## Abschließender Browsernachweis

Nach Fertigstellung des Builds wurde ein tatsächlicher Chromium-Lauf gegen den HTTPS-Testserver mit dem unveränderten offiziellen Admin-Proxy und den echten lokalen EOS-HTTP-Routen ausgeführt. Acht Prüfgruppen waren erfolgreich. Der Browser lud das gebaute React-Modul `index-_GY1J6JZ.js`, meldete den synthetischen Benutzer `nexowatt` mit dessen eigenem zufälligem Passwort genau einmal an und öffnete die Installerseite. Der Browser bestätigte `HttpOnly`, `Secure`, `SameSite=Lax` und den instanzgebundenen Cookiepfad.

Geprüft wurden außerdem Installer → EMS-App-Center einschließlich korrektem Admin-Rücklink, die eingebettete Dynamic-Grid-React-Ansicht einschließlich tatsächlich geladenem dynamischem Stylesheet, VIS-Bilder und -Styles samt EventSource, Simulation und SmartHome-Konfiguration. Bei 116 tatsächlichen Browseranfragen gab es keine aus dem Proxypräfix entwichenen Root-API-/Static-/EventSource-Pfade, fehlgeschlagenen Asset-/Dokumentanfragen, unbehandelten Browserfehler oder Konfigurations-/Mail-Schreibvorgänge. Die im Ergebnis festgehaltenen Runtime- und Bundlehashes blieben während des Laufs unverändert.

Die Microgrid-Ansicht wurde in diesem Browserlauf nicht geprüft, da der verwendete Fixture keinen initialisierten MeshCoordinator enthält. Ebenso wurden kein vollständiger Admin-Prozess, keine reale Benutzer-/Objektdatenbank und keine Kundenanlage geprüft. Die Admin-Sitzung, Admin-Socket-Metadaten und ioBroker-Konten/-Gerätewerte waren synthetisch. EOS-HTTP-Antworten wurden nicht durch Browser-Interzeption ersetzt.

Die bereinigten Endbelege sind in diesem Berichtverzeichnis verfügbar:

- `official-admin-proxy-results.json` und `official-admin-proxy.log`: neun bestandene Komponenten-Integrationsgruppen, zuletzt zusätzlich mit ausdrücklichem Secure-Cookie-Nachweis.
- `proxy-browser-results.json` und `proxy-browser.log`: acht bestandene Browsergruppen mit konkreten Dateihashes.
- `backend-source-review.json` und `proxy-source-review.log`: gezielter ESLint-/ASTvergleich gegen 1.0.34. Die fünf bereits einzeln geprüften `main.ts`-Stellen und `copyJsonValue` behalten ihre Fingerprints; die Funktion `copyJsonValue` ist bytegleich. Der neue HTML-Sender hat genau fünf fachlich geprüfte Dateipfad-Hinweise, keine Typunterdrückungen.
- `reproduce/README_DE.md` und drei portable Hilfsprogramme: Voraussetzungen, offizielle Quell-URL/-Hash und Aufrufe ohne mitgelieferte Drittquelle, Passwörter oder private Schlüssel.
