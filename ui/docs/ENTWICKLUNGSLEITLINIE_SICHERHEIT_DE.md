# Verbindliche Entwicklungsleitlinie für EOS und ioBroker-Adapter

Vom Nutzer am 29.09.2026 ausdrücklich für alle weiteren eigenen und unterstützten
Adapter festgelegt. Bei Drittadaptern als Prüf- und Integrationsmaßstab anwenden;
eine Herstellerfreigabe oder unbekannte Quellqualität nicht erfinden.

## System- und Anforderungsbezug

- Das EOS-Zielprofil als industrienahes ioBroker-System auf Raspberry Pi 5
  berücksichtigen. Konkrete OS-, Node-, Controller-, Adapter- und Firmwareversionen
  feststellen. Externe Strom-/Wetterdienste per HTTPS; Fernzugriff über abgesicherten
  VPN-Tunnel. Einen VPN nicht als Ersatz für Authentifizierung, Rollen, TLS,
  Firewallsegmentierung oder sichere Dienste behandeln.
- IEC 62443-4-1 für den Entwicklungsprozess, 4-2 für anwendbare
  Komponentenanforderungen und 3-3 für das System heranziehen. Je Adapter
  Bedrohungen, Anforderungen, Änderung, Test und Lieferstand verknüpfen.
  Sicherheitslevel und vollständige Normerfüllung nicht ohne Prüfung zusagen.
- CRA-Anwendbarkeit, harmonisierte Normen, Konformitätsverfahren, Support,
  Meldeprozesse und Fristen aus aktuellen offiziellen Quellen bestimmen. Die
  Aussage „IEC-konform programmiert bedeutet automatisch CRA-konform“ nicht
  übernehmen. SBOM und Dokumentation allein reichen ebenso wenig.

## Verbindliche Regeln für externen JavaScript-/Node.js-Datenabruf

1. Für externe HTTPS-Datenabrufe ein gemeinsames Gesamtbudget von höchstens
   5.000 ms vorsehen, einschließlich DNS/Verbindungsaufbau, TLS, Header,
   Antwortkörper sowie zugehöriger Authentifizierung, Retries und Fallbacks.
   Bei Axios `timeout` auf höchstens 5000 ms setzen und nötigenfalls mit einem
   tatsächlichen Abbruchsignal/Deadline ergänzen; bei bestehendem nativen HTTPS
   den gleichwertigen echten Abbruch umsetzen. Ein reines `Promise.race`, das den
   Netzwerkauftrag weiterlaufen lässt, oder ein bei jedem Datenchunk erneuertes
   Inaktivitätslimit erfüllt das Ziel nicht. Keine zusätzliche Bibliothek nur
   wegen des Axios-Beispiels einführen.
2. Fehler/Timeouts asynchron abfangen, Ressourcen und Timer schließen, keine
   unhandled rejection und keinen blockierenden Retry-/Sleep-Loop einbauen.
   Antwortgrößen begrenzen, TLS-Gegenstellenprüfung beibehalten und Redirects nur
   nach expliziter Zielprüfung erlauben. Diagnosecodes statt URLs mit Credentials,
   Antwortinhalten, Passwörtern oder Tokens protokollieren.
3. Empfangene JSON-Daten vollständig prüfen, bevor fachliche ioBroker-States
   geschrieben werden: Objekttyp, Pflichtfelder, echte Datentypen, endliche Zahlen,
   Einheiten/Wertebereiche, Zeitstempel, Reihenfolge, Aktualität und zueinander
   passende Arraylängen. `null`, Boolean, leere oder numerische Strings nicht
   still in gültige Nullwerte umdeuten. Einen ungültigen Teildatensatz nicht
   unbemerkt als vollständigen Preis-/Wetterstand übernehmen.
4. Letzte gültige Werte im Fehlerfall nicht als frisch ausgegeben überschreiben;
   Fehler, Alter und Verfügbarkeit gesondert kennzeichnen. Sicheren Fallback
   gerätespezifisch festlegen, keine pauschale Abschaltung der Regelung erfinden.
   Deadline-/Fehler-/Triagefälle automatisiert prüfen und harte Echtzeitaussagen
   erst mit Messung des konkreten Zielsystems machen.

## Geheimnisse, Lieferumfang und SBOM

**Begrenzte Bestandsentscheidung vom 23.10.2026 (ab 1.0.26):** Auf ausdrücklichen
Nutzerauftrag wird die bisher ausgelieferte NW1-Lizenzprüfung für die laufenden
Feldtestanlagen beibehalten. Ihr historischer symmetrischer Prüfwert wird als
öffentlich bekanntes Kompatibilitätsmaterial behandelt und an genau einer
benannten Methode je Main-Quelle durch den bekannten Hash gebunden. Diese
Ausnahme gilt ausschließlich für diesen alten Lizenzvertrag, nicht für
Passwörter, neue Signierschlüssel oder andere HMAC-Anwendungen. Die spätere
Lizenzarchitektur gehört in die eigene EOS-Software. Der offene Befund
NW-SECRET-01 bleibt erhalten; eine Vertraulichkeit dieses Altwerts wird nicht
behauptet. Details: [Bestandsbetrieb](operations/EMS_APPS_LIZENZ_KOMPATIBILITAET_DE.md).

- Dienstpasswörter, API-Tokens und Lizenz-/HMAC-/Signierschlüssel ausschließlich
  aus geschützter Adapterkonfiguration oder geschützten Umgebungsvariablen beziehen.
  Kein eingebauter Rückfall auf ein gemeinsames Geheimnis. Nicht nur erkennbare
  Tokenformate prüfen: auch kryptografische Konstanten und Verwendungsstellen
  fachlich kontrollieren. Keine tatsächlichen Schlüsselwerte in Chat, Tests,
  Logs, Doku, SBOM oder Beispielen ausgeben.
- Öffentliche/npm-/Repository-Lieferung und private Installationsdateien strikt
  getrennt bereitstellen. Erforderliche private Serverdateien außerhalb des
  Repositorys mit minimalen Rechten vorbereiten und separat liefern, wenn der
  Nutzer dies beauftragt hat; nicht ungefragt auf einem Livesystem installieren.
  Bereits ausgelieferte Geheimnisse als potenziell offengelegt behandeln,
  Kompatibilität und Rotation/Migration ausdrücklich planen.
- Eine maschinenlesbare SBOM beim Erstellen jedes Releaseartefakts automatisch
  erzeugen und vor Veröffentlichung auf Versions-, Quellen- und Artefaktbindung
  prüfen. Beim Publish nicht automatisch Produktcode neu bauen oder veränderte
  Dateien neu als geprüft versiegeln. Release-Referenzbaum, tatsächlich installierte
  Buildumgebung, gebündelte Komponenten und tatsächliches Live-Geräteinventar
  unterscheiden. SBOM-Nachweise nicht als laufenden Schwachstellenscan ausgeben.
- Alle tatsächlich zu veröffentlichenden npm-/ZIP-Inhalte einschließlich
  Dokumentation und Rohberichten auf Geheimnisse und private Konfiguration
  prüfen. Keine unbekannten Scannergrenzen als garantiert geheimnisfrei ausgeben.

## Testveröffentlichung und Freigabe

Der Nutzer benötigt npm-Pakete auch für bewusst durchgeführte Tests auf seinem
eigenen Live-System. Technisch geprüfte Testpakete nicht allein wegen noch
fehlender allgemeiner Produktivfreigabe durch eine zusätzliche pauschale
npm-Sperre blockieren. Technische Sicherheits-, Geheimnis-, Versions- und
Integritätsprüfungen bleiben verbindlich; dokumentierte Hersteller-/Produktivfreigabe
getrennt behandeln und niemals automatisch erfinden. Änderungen, Testbelege,
Restpunkte und betroffene Unterlagen im selben Stand mitliefern.

## Bezug zum aktuellen Lieferstand

Die konkrete Anforderungszuordnung und verbleibenden Nachweise stehen in
[HTTPS-, CRA- und IEC-Anforderungen](reports/cra-2026-09-29/HTTPS_5S_CRA_IEC_ANFORDERUNGEN_DE.md).
Diese Leitlinie ist bei Änderungen am Adapter und bei Übernahme in weitere Adapter
zusammen mit deren eigenem Scope, Komponentenbestand und Prüfnachweisen anzuwenden.

## Konkretisierung vom 23.10.2026 – geschlossene Systeme und Bestandsadapter

- Neue eigene Sicherheitsmodule tragen einen proprietären NexoWatt-Header, werden
  tatsächlich unter TypeScript strict ohne any/nocheck geprüft und verwenden
  native Laufzeitvalidierung. Keine neue Validierungsbibliothek allein zur
  Erfüllung eines Werkzeugnamens. Fremdlizenzen bleiben erhalten.
- Der Nutzer hat nach Klärung ausdrücklich den Erhalt von ioBroker gewählt.
  Bestehende notwendige Integrationspakete sind deshalb eine benannte Ausnahme
  zur ursprünglich verlangten vollständigen npm-Freiheit. Keine Behauptung,
  der Gesamtadapter sei ohne Drittcode oder ausschließlich statisch konfiguriert.
- Keine Code-/Policy-Nachladung durch die neue Fehlergrenze. Lokale feste
  Fehlerpolicies sind eingefroren. Berechtigte lokale DP-Konfiguration bleibt
  ein vorhandener Produktvertrag und wird nicht heimlich abgeschaltet.
- Fehler an Systemgrenzen isolieren, sichere Diagnosen erhalten und fremde
  Exceptions nicht als Benutzerantwort, Statuswert oder Stack weiterreichen.
  Eine vom fremden Fehler selbst mitgelieferte status/code-Kombination ist
  kein Vertrauensnachweis; öffentliche Validierungsfehler werden intern markiert.
- `Object.create(null)` für Dictionaries mit fremden Schlüsseln verwenden;
  tiefe Eingabeprüfung, Grenzen und sichere Schlüssel bleiben zusätzlich nötig.
- Altbestand nicht nur durch eine Compileroption als migriert deklarieren.
  Der belegte Restumfang und der Plan stehen im aktuellen
  [Prüfbericht](reports/security-standards-2026-10-23/PRUEFBERICHT_DE.md).
- Der native AST-Guard gilt zunächst für die neue HTTP-Fehlergrenze; er ist
  weder vollständiges ESLint noch Datenfluss-SAST. CodeQL wird als Workflow
  bereitgestellt; sein echter Remote-Lauf bleibt gesondert nachzuweisen.
