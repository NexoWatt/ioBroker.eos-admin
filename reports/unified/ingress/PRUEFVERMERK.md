# HTTPS-Ingress — Änderungs- und Prüfvermerk

Datum: 22.11.2026. Lieferziel: NexoWatt EOS 9.0.1. Prüfstand über die Dateihashes in `evidence.json` identifiziert. Entwicklungsumgebung: Linux, Node.js 24.22.3; lokale temporäre OpenSSL-Zertifikatsfixtures, keine Kundenanlage.

## Änderung und Vertrauensgrenze

Der Renderer erzeugt standardmäßig einen 443-Eingang mit festem HTTPS-Upstream `127.0.0.1:8188`, eingeschalteter Zertifikatsprüfung, expliziter Vertrauensdatei sowie geprüftem festem DNS-Prüfnamen/SNI. Geräte-IPv4 und `nexowatteos` sind erlaubte Browser-Hosts; `.local` benötigt eine bewusste Zusatzoption und tatsächliche lokale Namensauflösung. Der Browser-Host wird unverändert weitergereicht. Ein explizites HTTP-Altprofil ist auf Loopback und einen fest konfigurierten öffentlichen IP-Origin begrenzt.

Die Header-Allowlist erhält `Sec-Fetch-Site`, `Sec-Fetch-Mode` und `Sec-Fetch-Dest`. Damit kann die Backend-Grenze einen Dokumenteinstieg vom getrennten Admin-Port von einem unerlaubten API-/Schreibzugriff unterscheiden. Der Renderer-Regressionsfall prüft die Weiterleitung aller drei Werte; er ersetzt nicht den separaten HTTP-Berechtigungstest des Backends.

Die CLI prüft Parameter, Pfadsyntax, reguläre Dateien, komplette symlinkfreie Verzeichnisketten, lokale Eigentümer und Schreibrechte; Ausgabedateien werden exklusiv und mit Modus 0600 angelegt. Keine Zertifikate/Schlüssel werden vom Produktwerkzeug erzeugt, keine Dienste installiert oder gestartet. Zertifikatsinhalte, SAN-Passung und tatsächliche TLS-Vertrauenskette sind weiterhin Nginx-/Zielsystemprüfungen. Root und gleichberechtigte lokale Prozesse bleiben gemeinsame Vertrauenszone; Metadatenprüfung ist keine Sandbox gegen das eigene Konto.

## Ausgeführt

| Befehl/Prüfung | Ergebnis | Beleg |
| --- | --- | --- |
| `node --test --test-reporter=tap test/eos-ingress-renderer.test.cjs test/eos-unified-ownership.test.cjs` | 28 bestanden, 0 fehlgeschlagen, 1 übersprungen. Davon 7 neue Rendererfälle und 21 bestehende Ownership-/Migrationsfälle. | `renderer-tests.tap` |
| `node node_modules/typescript/bin/tsc --ignoreConfig --allowJs --checkJs --noEmit --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --noImplicitReturns --noFallthroughCasesInSwitch --skipLibCheck --target es2022 --module commonjs --types node deploy/render-ingress.cjs` | Exitcode 0, keine Diagnosen. Fremde Deklarationsdateien sind durch `skipLibCheck` nicht vollständig geprüft. | `renderer-types.log` |
| ESLint auf `deploy/render-ingress.cjs`, ohne Projektkonfiguration: `no-undef`, `no-unused-vars`, `no-eval`, `no-implied-eval`, `no-new-func`, `no-unreachable`, `no-unsafe-finally` jeweils error; Node-Globals explizit. | Exitcode 0, keine Diagnosen. Begrenzter Regelsatz, kein Nachweis des gesamten Backend-Lints. | `renderer-eslint.log` |

Die zwei bisherigen Rendererfälle wurden aus der Ownership-Testdatei in die dedizierte Renderer-Suite übertragen und auf den neuen HTTPS-/Dateiprüfvertrag erweitert. Die übrigen Ownership-/Migrationsfälle blieben unverändert. Die privaten Testschlüssel werden nur zur Testlaufzeit mit OpenSSL erzeugt und danach samt temporären Zertifikaten entfernt; keine privaten Schlüsselwerte sind Testfixtures im Repository.

## Offen / nicht ausgeführt

`nginx` ist nicht installiert. Der `nginx -t`-Test meldet deshalb ausdrücklich SKIP. Syntaxprüfung durch eine echte Nginx-Instanz, Negativfälle mit unpassender CA/SAN am echten Upstream, DNS/mDNS, IPv6, reale Browser-/Socket-/SSE-Anmeldung und Gerätebetrieb bleiben Teil der Zielabnahme. Andere tatsächlich ausgeführte Host-/Adaptertests werden im Gesamtbericht getrennt ausgewiesen. Kein `nginx -t`-Erfolg, keine Installationshandlung und keine Geräte-/CRA-Freigabe werden behauptet.

## Quellenprüfung

Am 22.11.2026 anhand offizieller Nginx-Dokumentation geprüft:

- https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_ssl_name — Prüfidentität, SNI, TLS-Protokolle, Vertrauensdatei und Zertifikatsprüfung.
- https://nginx.org/en/docs/http/server_names.html — feste Namen und IP-basierter Zugriff.

Die Dokumentation des Geräteeinsatzes steht in `deploy/README.md`. Zuständig für die noch offene Inbetriebnahme-/TLS-/Geräteabnahme ist NexoWatt beziehungsweise der betreuende Geräteadministrator. Eine allgemeine Produktionsfreigabe wurde durch diesen Prüfschritt nicht erteilt.
