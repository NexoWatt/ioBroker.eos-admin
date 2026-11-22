# Anforderungen und Nachweisstatus – 1.0.22 Security Review

Stand: 29.09.2026. Lieferstatus: **nicht produktiv freigegeben**.
Die folgenden `REQ-*` sind überprüfbare EOS-Anforderungen. CRA-/ASVS-/SSDF-Spalten
ordnen Themen zu; sie sind kein vollständiges Klauselaudit. Der endgültige
Teststatus steht ausschließlich im [aktuellen Prüfbericht](../reports/cra-2026-09-29/PRUEFBERICHT_DE.md),
einzelne Abweichungen im [Befundregister](../security/BEFUNDREGISTER_DE.md).

**Geprüft** bezeichnet hier einen konkret angegebenen Dokument-/Quellencheck.
**Teilnachweis** bedeutet vorhandene Umsetzung oder Test, aber noch keine komplette
Abdeckung der Anforderung. **Offen** bezeichnet fehlende Abnahme, Entscheidung
oder Prüfung. Das Aufführen eines Tests behauptet nicht dessen Ausführung.

## Zielstandard und tatsächlich geprüfter Umfang

- OWASP ASVS **5.0.0 Level 2** ist das Web-/API-Zielprofil. Ein vollständiger
  Einzelnachweis aller anwendbaren L1-/L2-Anforderungen liegt noch nicht vor.
  Kapitelzuordnungen unten sind bewusst keine erfundenen Einzelkontrollnummern.
- Zusatzprofil für besonders kritische Funktionen: Schlüsselverwaltung und
  Protokollintegrität bei Mesh; strenge Autorisierung vor Anlagenänderungen;
  Last-/Missbrauchstests ohne Verletzung der Regelzeiten. Die passende Auswahl
  zusätzlicher ASVS-L3-Einzelanforderungen und ihre Abdeckung ist noch offen.
- IEC **62443-4-1:2018** dient als Entwicklungsprozess-Ziel. Der vollständige
  lizenzierte Normtext wurde hier nicht geprüft; keine Normkonformität behaupten.
  IEC **62443-4-2:2019** (einschließlich Berichtigung 08/2022) wird für die
  technische Komponentenbewertung herangezogen; IEC **62443-3-3:2013**
  (einschließlich Berichtigung 04/2014) für den tatsächlichen Anlagenverbund.
  Die Anwendbarkeit einzelner Komponenten-/Systemanforderungen und das angestrebte
  Sicherheitsniveau sind mit Raspberry Pi 5, Linux, ioBroker, Geräteadaptern und
  Netzprofil festzulegen. Dieser Adapter allein belegt keinen System-Security-Level.
- NIST SSDF **1.1 / SP 800-218 (final)** bildet den Lebenszyklusrahmen. SSDF 1.2
  war auf der offiziellen Publikationsliste am Prüftag noch ein Entwurf.

## Matrix

| ID | Verbindliches EOS-Ziel / Prüfkriterium | Zuordnung | Evidenz und Stand |
| --- | --- | --- | --- |
| REQ-01 | Liefergrenze mit konkreten Komponenten, Datenflüssen und externen Diensten dokumentieren | CRA Art. 13/31, Anhang VII; SSDF Planung | **Geprüft:** Produktgrenzen dieses Repositorys dokumentiert. Vollständige Stückliste des Endgeräts **offen** |
| REQ-02 | Alle technischen API-Lese-/Schreiboperationen prüfen Rolle und Ziel serverseitig; Kunde erhält keine technischen Zuordnungsrechte | CRA Anhang I Teil I; ASVS 5.0.0 V8 | `main.ts`, Rollen-/Capability-Gates, SmartHome-Verträge; **Teilnachweis**, Tests/Restbefunde im aktuellen Bericht |
| REQ-03 | Login drosseln; Sitzung begrenzen; deaktivierte Benutzer/Rechteentzug wirksam machen, auch bei Langzeitverbindungen | CRA Anhang I Teil I; ASVS V6/V7 | Login-/Session-/SSE-Pfade in `main.ts`; **Teilnachweis**, kompletter Endgeräte-/Controller-Verbund **offen** |
| REQ-04 | Keine fremden Origins für sensible Antworten/Schreibzugriffe; Browserdaten kontextgerecht ausgeben | CRA Anhang I Teil I; ASVS V1/V3/V4 | CORS-/Origin-/Cookie-Grenzen und Browserquellen; **Teilnachweis**, vollständiger Browser-Penetrationstest **offen** |
| REQ-05 | Übertragene Zugangsdaten, Sessions und sensible Betriebsdaten gegen Mitlesen schützen | CRA Anhang I Teil I; ASVS V12 | SMTP-TLS im Code; HTTP-EOS-Zugang braucht Systemabsicherung. TLS-/Proxy-/Firewall-Abnahme **offen** |
| REQ-06 | Geheimnisse nicht in allgemeinen States, API-Antworten, Logs, Quellen oder Exporten ausgeben | CRA Anhang I Teil I; ASVS V13/V14/V16 | SMTP-Speicherung/-Antwort, Datenprojektion, Geheimnisscanner; **Teilnachweis**, Gesamtsystem/Backups **offen** |
| REQ-07 | Größen, Raten, Parallelität, Laufzeiten und Sitzungszahl begrenzen; Regelverzug unter Angriff bestimmen | CRA Anhang I Teil I; ASVS V2/V4/V15 | API-/SSE-/Request-Grenzen; **Teilnachweis**, gemessener Lasttest auf Zielhardware **offen** |
| REQ-08 | Externe Antwortwerte, URLs und konfigurierbare Ziele auf erlaubte Form und Wirkung beschränken | CRA Anhang I Teil I; ASVS V2/V13 | Prognose-, Tarif-, SmartHome- und Mesh-Verträge; vollständige SSRF-/Redirect-/DNS-/Datenpfadprüfung **offen** |
| REQ-09 | Messwerte nur bei gültiger Einheit, Alter und Bereich nutzen; projektierten Rückfall nachweisen | CRA Anhang I Teil I; ASVS V2 | EMS- und Netz-/Lademanagementregressionen; **Teilnachweis**, Geräte-/Anlagenabnahme **offen** |
| REQ-10 | Mesh-Nachrichten an Gegenstelle, Cluster und Sitzung binden; Replay/Manipulation ablehnen; sichere Wiederaufnahme | CRA Anhang I Teil I; ASVS V11/V12 | `mesh-coordinator*`, `mesh-energy-service`; **Teilnachweis**, Mehrgeräte- und VPN-Prüfung **offen** |
| REQ-11 | Personen-/Betriebsdaten auf notwendige Empfänger begrenzen; Aufbewahrung und Löschung festlegen | CRA Anhang I Teil I; ASVS V14 | Produktdateninventar erstellt; tatsächliche Lösch-/Aufbewahrungsregeln und Display-/Archivabnahme **offen** |
| REQ-12 | Jede lieferbare Komponente/Abhängigkeit mit Herkunft und exakter Version erfassen | CRA Anhang I Teil II; SSDF Lieferkette | Paket-/Lockdateien und SBOM im Lieferstand; **Teilnachweis**, vollständige Hardware-/OS-/Controller-SBOM **offen** |
| REQ-13 | Alle zutreffenden Advisories bewerten; ausnutzbare bekannte Schwachstellen vor Auslieferung beheben | CRA Anhang I Teile I/II; SSDF Schwachstellenbehandlung | [Befundregister](../security/BEFUNDREGISTER_DE.md); Scannerstatus aus aktuellem Bericht übernehmen. Freigabe **offen** |
| REQ-14 | Quellcode, generierte Spiegel, Admin-Bundle und Prüfsummen gehören zu demselben geprüften Stand | CRA Anhang I Teil II; SSDF Softwareschutz | Bestehende Mirror-/Artefakt-/Publish-Gates; **Teilnachweis**, Ergebnisse im Prüfbericht |
| REQ-15 | Installation, Overlay, Update, Rückfall und vollständiges Restore einschließlich Schlüssel prüfen | CRA Anhang I Teil II; SSDF Auslieferung | Pakettests und Ablaufplan vorhanden; Endgeräte-/Backup-System nicht geliefert, Abnahme **offen** |
| REQ-16 | Meldungen vertraulich annehmen, priorisieren, beheben, nachtesten und Betroffene informieren | CRA Anhang I Teil II; SSDF Schwachstellenbehandlung | [Prozessentwurf](SCHWACHSTELLEN_SUPPORT_DE.md) dokumentiert; veröffentlichter Kontakt, Vertretung und geübter Ablauf **offen** |
| REQ-17 | Ereignisse auf Art.-14-Meldepflicht prüfen und fristgerechte Meldung organisatorisch ermöglichen | CRA Art. 14 | Fristen/Verantwortungsfelder dokumentiert; SRP-Zugang und Meldeübung **offen** |
| REQ-18 | Erwartete Nutzungsdauer, Sicherheitsunterstützung, Enddatum und Updatebereitstellung verbindlich festlegen | CRA Art. 13, Anhang II | Herstellerentscheidung **offen**; kein erfundenes Supportversprechen |
| REQ-19 | Produktklassifizierung, passendes Konformitätsverfahren und technische Unterlagen vollständig abnehmen | CRA Art. 32, Anhänge III/IV/VII/VIII | Gesamtprodukt-/Hardwareabgrenzung und Verfahren **offen**; keine Konformitätserklärung ausgestellt |
| REQ-20 | Reproduzierbare Tests mit Rohbelegen und Freigabeentscheidung sichern | IEC 62443-4-1 Prozessziel; SSDF Lebenszyklus | Aktueller Bericht, Register, Release-Status; **Teilnachweis**, menschliche Serienfreigabe nicht erteilt |
| REQ-21 | Externe Strompreis-, Wetter-/Prognose- und zugehörige OAuth-/Geocodingabrufe ausschließlich über HTTPS mit aktiver Zertifikatsprüfung | CRA Anhang I Teil I; IEC 62443-4-2/3-3: Integrität und Vertraulichkeit; ASVS V12 | Präzisierte EOS-Vorgabe; konkrete Umsetzung und Prüfgrenzen im [HTTPS-/IEC-Nachweis](../reports/cra-2026-09-29/HTTPS_5S_CRA_IEC_ANFORDERUNGEN_DE.md) |
| REQ-22 | Ein gemeinsames Budget von höchstens 5.000 ms begrenzt den vollständigen externen Wetter- bzw. Tarifabruf einschließlich Geocoding/OAuth, DNS/TLS, Header, Body und JSON-Dekodierung; Teilanfragen/Fallbacks erhalten nur das Restbudget, keine Inline-Retries | CRA Anhang I Teil I; IEC 62443-4-2/3-3: Ressourcenverfügbarkeit | EOS-Zeitbudget, keine wörtliche Normvorgabe und kein Linux-Echtzeitversprechen. Exakte Abrufgrenze, Abbruch und Laufzeittests im Ergänzungsnachweis; lokale Weiterverarbeitung/ioBroker-I/O sowie Pi-5-Last-/Zeitmessung separat, Zielsystemmessung **offen** |
| REQ-23 | Externe JSON-Antwort vollständig gemäß verwendetem Schema prüfen, bevor daraus Nutzdaten-States geschrieben werden: Struktur, primitive Typen, endliche Zahlen, Einheiten, Arrays und Zeitbezug | CRA Anhang I Teil I; IEC 62443-4-2/3-3: Systemintegrität; ASVS V2 | Keine stillschweigende Umwandlung von numerischen Strings, Boolean oder null zu Messwerten. Positive/negative Providerfälle und Schreibgrenze im Ergänzungsnachweis |
| REQ-24 | DNS-, TLS-, Timeout-, HTTP-, Parse- und Schemafehler auffangen; externe Quelle als nicht verfügbar behandeln, keine erfundenen Nullwerte und keinen ungefangenen Fehler in die Regelung geben | CRA Anhang I Teil I; IEC 62443-4-2/3-3: Ressourcenverfügbarkeit und Ereignisreaktion | Offline-/Catch-Verhalten mit begrenztem Zeit-/Größenbudget prüfen. Ausfallreaktion auf tatsächlicher Anlage **offen** |
| REQ-25 | Lizenz-HMAC und Providerzugänge aus auslieferbaren Quellen, allgemeinen Konfigurationsexporten und Logs fernhalten; geschützte Geheimnisbereitstellung ohne eingebauten Ersatzwert | CRA Anhang I Teile I/II; IEC 62443-4-2/3-3: Integrität und Vertraulichkeit; ASVS V11/V13 | **NW-SECRET-01 bleibt offen.** Ab 1.0.26 ausdrückliche Nutzerentscheidung zur Fortführung des bekannten NW1-Altvertrags für Feldtestanlagen, eng begrenzte historische Ausnahme; keine Vertraulichkeitsbehauptung. Neue Geheimnisse bleiben ausgelagert. Spätere Lizenzarchitektur/Rotation in eigener EOS-Software; [Prüfvermerk](../reports/license-ems-2026-10-23/PRUEFVERMERK_DE.md) |
| REQ-26 | Komponenten- und Systemprofil für industrienahen EOS-Betrieb festlegen und Nachweise an tatsächlichen Pi-5-/OS-/Controller-/Adapter-/VPN-Stand binden | IEC 62443-4-1/-4-2/-3-3; CRA Art. 13/31 | Quellen-/Anwendbarkeitsabgleich dokumentiert. Vollständiges Klauselaudit, Ziel-Security-Level, Host-/VPN-/Hardwareabnahme **offen** |

Die Verantwortlichkeit für REQ-01 bis REQ-15 liegt fachlich bei Entwicklung und
Systemintegration, für REQ-16 bis REQ-20 zusätzlich beim Hersteller. Diese Rollen
sind Aufgabenbereiche, keine Behauptung über bereits eingesetzte Mitarbeiter.
Vor einer Auslieferung müssen konkrete Zuständige und Termine eingetragen werden.
REQ-21 bis REQ-25 betreffen die EOS-Entwicklung und die geschützte Bereitstellung
durch den Systemverantwortlichen; REQ-26 zusätzlich Integration/Hersteller.
Die 5.000-ms-Grenze und die strikte externe Typprüfung konkretisieren die
Nutzervorgabe für diesen Folgeauftrag. Historische Prüfungen mit großzügigeren
Zeitgrenzen oder HTTP-Providerfixtures erfüllen dieses neue Profil nicht automatisch.

## Nächste Abnahme

1. Offene kritische Befunde des aktuellen Registers mit Nachtests schließen.
2. Tatsächliches EOS-Endgerät mit fixierter Softwarestückliste bereitstellen;
   TLS, Rechteentzug, Offline-/Störbetrieb, Netzgrenzen und Restore abnehmen.
3. ASVS-L2-Einzelmatrix und risikobasiertes L3-Zusatzprofil vollständig zuordnen;
   unabhängige Sicherheitsprüfung für die Serienfreigabe einplanen.
4. Herstellerentscheidungen aus Support-/Auslieferungsakte treffen und belegen.

Quellenstand und Grenzen der Prüfung: [QUELLEN_STAND_DE.md](QUELLEN_STAND_DE.md).


## Nachtrag 1.0.25 – Dynamischer Netzanschluss

REQ-02/04/08: Neue Installateur-API und Appoberfläche verwenden den bestehenden Rechte-/Origin-Vertrag sowie Schemavalidierung, Aliasidentitäten und versionierte atomare Speicherung. REQ-07/09: Geräteabfragen und Schreibübergänge erhalten Frische-/Laufzeitgrenzen, gemeinsame M0/M1-Budgets und eindeutige Schreibhoheit. REQ-14/15: Die vollständige Quelllieferung enthält generierte Laufzeitdateien, gebaute UI, SBOM und Paketnachweise desselben Stands.

Der [Prüfvermerk](../reports/dynamic-grid-2026-10-23/PRUEFVERMERK_DE.md) benennt tatsächlich ausgeführte Tests. Allgemeine Produktivfreigabe, Hardwareabnahme und vollständige Normerfüllung bleiben davon getrennt. Es wurde keine Hersteller-Whitelist als Funktionsvoraussetzung eingeführt.
