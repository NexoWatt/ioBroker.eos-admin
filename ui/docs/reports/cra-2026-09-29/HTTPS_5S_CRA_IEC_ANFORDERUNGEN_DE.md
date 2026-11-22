# Ergänzte EOS-Anforderungen: HTTPS, fünf Sekunden und IEC 62443

Stand: 29.09.2026, Folgeprüfung des 1.0.22-Sicherheitsstands. Der exakte neue
Quell-/Buildbezug und die ausgeführten Laufzeittests werden in den zugehörigen
Teilnachweisen geführt. Dieses Dokument legt Anforderungen und ihre Zuordnung
fest; es bescheinigt keine abgeschlossene CRA-Konformität, IEC-Zertifizierung,
erreichten Security-Level oder Hardwareabnahme.

## Anlass und tatsächliche Produktgrenze

EOS ist für industrienahen Einsatz auf Raspberry Pi 5 mit Linux und ioBroker
vorgesehen. Der lokale Regelkern verarbeitet auch optionale externe Wetter-/PV-
Prognosen und Strompreise. Die neue Nutzervorgabe verlangt HTTPS, ein gemeinsames
Zeitbudget von höchstens 5.000 ms je vollständigem externem Wetter- bzw. Tarifabruf, abgefangene Offlinefehler,
vollständige Prüfung der verwendeten JSON-Struktur und Typen vor Nutzdaten-States
sowie geschützte Geheimnisbereitstellung.

Zusätzlich wurde ein zuvor fest im Quell-/Runtimepaket enthaltener Lizenz-HMAC-Wert
bestätigt (**NW-SECRET-01**). Weder ein früherer Scannerlauf ohne Treffer noch die
Bezeichnung „lokales System“ entkräftet diesen Befund. Der ursprüngliche
[Gesamtprüfbericht](PRUEFBERICHT_DE.md) und die damaligen Logs bleiben zeitlich
zugeordnete Nachweise; neue Anforderungen sind zusätzlich zu prüfen.

Tatsächlicher Codeumfang dieses Auftrags bleibt der UI-/EMS-Adapter. OS,
js-controller, andere Adapter, Geräteschutz, Switch/Router, VPN und Pi-5-Hardware
sind notwendige Bestandteile der künftigen Gesamtbewertung. Ihre Prüfung wird
nicht aus einer erfolgreichen Adapterprüfung abgeleitet.

## Offizielle Vorgaben und eigene Anwendbarkeitsentscheidung

Die Kommission beschreibt den CRA-Herstellerprozess aus Risikobewertung,
technischer Dokumentation, passendem Bewertungsverfahren sowie laufender
Schwachstellenbehandlung. Diese Schritte beziehen sich auch auf die relevanten
Komponenten eines gelieferten Endprodukts. EOS muss deshalb mit seinem tatsächlichen
Lieferumfang bewertet werden. Die konkrete CRA-Produktkategorie und das daraus
folgende Verfahren bleiben offen. [S1]

| Ebene | Offiziell geprüfte Ausgabe | Anwendung im EOS-Auftrag |
| --- | --- | --- |
| Entwicklung / Pflege | IEC 62443-4-1:2018, Edition 1.0 | Anforderungen, Entwurf, Implementierung, Prüfung, Schwachstellen-/Updatepflege über den Lebenszyklus. Maßstab für Hersteller/Entwickler. [S2] |
| Komponente | IEC 62443-4-2:2019, Edition 1.0, Berichtigung 08/2022 enthalten | Technische Fähigkeiten des abgegrenzten Software-/Hardwarebestandteils. Die passende Komponentenart und vollständige Anwendbarkeitsmatrix müssen vor Bewertung festgelegt werden. [S3] |
| Anlagenverbund | IEC 62443-3-3:2013, Edition 1.0, Berichtigung 04/2014 enthalten | Systemanforderungen mit tatsächlichen Zonen und Kommunikationsverbindungen. Pi, OS, ioBroker, Geräte und Netzwerk sind gemeinsam zu betrachten. [S4] |

Die Ausgaben waren am Prüftag so im IEC-Katalog geführt. Nur öffentliche
Produktbeschreibungen wurden geöffnet; ein vollständiger Normtext-/Klauselabgleich
wurde nicht durchgeführt. Die sieben IEC-Grundanforderungsbereiche umfassen
Identifikation/Authentisierung, Nutzungssteuerung, Integrität, Vertraulichkeit,
begrenzte Datenflüsse, Ereignisreaktion und Ressourcenverfügbarkeit. Ein
Komponentenfähigkeitsniveau ist keine Bestätigung eines auf der Anlage erreichten
Niveaus. [S3, S4]

Die technische Einordnung oben ist die eigene Ableitung für EOS. Eine vorhandene
IEC-Ausgabe ist nicht automatisch ein für das konkrete Produkt anwendbarer
harmonisierter CRA-Nachweis. Dafür müssen die passende europäische Normfassung,
Geltungsbereich und Grundlage einer Konformitätsvermutung separat geprüft werden.
Die Kommission führt hierzu einen eigenen Normungsprozess. [S5]

## Konkretes Anforderungsprofil und Prüfkriterien

**5.000 ms ist eine konkrete EOS-Entwicklungsanforderung aus diesem Auftrag.**
Es wird keine wörtliche Fünf-Sekunden-Vorschrift in CRA oder IEC 62443 behauptet.
Die Zuordnung ist thematisch und ersetzt keine vollständigen CR-/SR-Einzeltests.

| EOS-ID | Konkret gefordertes Verhalten | CRA-/IEC-Themenzuordnung | Erforderlicher Nachweis |
| --- | --- | --- | --- |
| REQ-21 | Wetter-, Prognose-, Strompreis-, OAuth- und Geocodingziele verwenden ausschließlich HTTPS; Zertifikats-/Hostnameprüfung bleibt aktiv; kein stiller HTTP-Rückfall | CRA Anhang I Teil I; IEC Integrität und Vertraulichkeit | Zulässiger HTTPS-Fall, HTTP-/Protokoll-/Credential-URL-Abweisung, Fehler bei unzulässiger Weiterleitung; echtes Zielzertifikat im Endgerätprofil zusätzlich prüfen |
| REQ-22 | Ein gemeinsames Budget von höchstens 5.000 ms umfasst den vollständigen externen Wetter- bzw. Tarifabruf mit Geocoding/OAuth, DNS/TLS, Header, Body und JSON-Dekodierung; Teilanfragen/Fallbacks erhalten nur das Restbudget, keine Inline-Retries; Timeout bricht laufende Ressourcen ab | CRA Anhang I Teil I; IEC Ressourcenverfügbarkeit | Hängende Verbindung/Headers/Body, langsamer Stream, Abbruch-/Cleanupnachweis und mehrstufiger Abruf; Antwortbeginn oder Folgerequest setzt die Frist nicht zurück |
| REQ-23 | JSON ist erst syntaktisch, danach vollständig gegen das verwendete Providerschema zu prüfen; Struktur, Typen, Zahlenendlichkeit, Arraybezug, Zeit/Einheit stimmen vor Nutzdaten-Schreibzugriff | CRA Anhang I Teil I; IEC Integrität | Fehlerhafte Pflichtfelder, null, Boolean, numerische Strings, verschobene Serien und ungültige Zeitwerte abweisen; keine teilweisen Nutzdaten-States aus defektem Datensatz |
| REQ-24 | Alle erwartbaren externen Fehler werden gefangen; der betroffene Datenabruf wird als nicht verfügbar behandelt; bekannte gültige Daten nur mit dokumentiertem Alter/Rückfall verwenden | CRA Anhang I Teil I; IEC Ereignisreaktion und Ressourcenverfügbarkeit | Offline/DNS/TLS/HTTP/Timeout/Parse/Schema, Wiederaufnahme und ausbleibende ungefangene Rejection; keine künstlichen Nullpreise/-prognosen |
| REQ-25 | Geheimnisse aus öffentlichen Quellen/Paketen und allgemeinen Exporten entfernen; geschützte lokale Provisionierung, kein eingebauter Ersatzwert | CRA Anhang I Teile I/II; IEC Integrität und Vertraulichkeit | Paket-/Quellscan, fehlender/ungültiger/korrekter Geheimniswert, Dateirechte, Fehler ohne Wertausgabe; Altwert-/Bestandsmigration separat entscheiden |
| REQ-26 | Komponenten-/Anlagenanforderungen aus tatsächlichem Betriebsprofil festlegen; Voraussetzungen und offene Zuständigkeiten sichtbar machen | CRA Art. 13/31; IEC 62443-4-1/-4-2/-3-3 | Inventar, Zonen/Verbindungen, Rechte, Zielniveau und zielgerätespezifische Tests; keine pauschale Normerfüllung |

Vollständige JSON-Prüfung bedeutet: das gesamte für die Verarbeitung benötigte
Antwortschema wird validiert, bevor dessen fachliche Nutzwerte veröffentlicht
werden. Zusätzliche ungenutzte Providerfelder benötigen eine explizite Politik;
sie dürfen nicht ungeprüft als Konfiguration oder States weitergereicht werden.
Eine gültige Fehler-/Offline-Statusmeldung ist vom Schreiben ungültiger Preis- oder
Wetterwerte zu unterscheiden. Strukturell korrekte Fremddaten bleiben inhaltlich
unvertrauenswürdig und benötigen Frische-/Plausibilitätsgrenzen.
Für ENTSO-E als XML-Quelle gelten entsprechende Struktur-, Dezimalzahl-,
Positions- und Intervallprüfungen; eine JSON-Prüfung wird dort nicht behauptet.

Die konkrete Umsetzung trennt Transportgrenzen und fachliche Verarbeitung:

| Pfad | Gemeinsames Abrufbudget und zusätzliche Begrenzung |
| --- | --- |
| Wetter / PV-Prognose | Monotone Deadline ab vor Standortauflösung/erstem externem Abruf. Geocoding, parallele GTI-Flächen und stufenweise Fallbacks teilen das Restbudget. Native HTTPS-Anfragen mit Zertifikatsprüfung an feste Open-Meteo-Hosts, keine Redirects, Antwortgrenze 1 MiB. Pflichtserien müssen vollständig, zueinander passend und aus endlichen Zahlen bestehen. |
| Strompreise / Tarif | Gemeinsame Deadline für `fetchProvider` einschließlich OAuth-Token, Preisabruf, Body und Verarbeitung. AbortSignal und Gesamtfrist, keine Redirects, ausschließlich HTTPS mit Standard-Zertifikatsprüfung. Antwortgrenze 2 MiB, Requestgrenze 64 KiB, höchstens 4.096 Intervalle. Jede Preiszeile wird mit Zahlen-, Intervall- und Überlappungsprüfung validiert; eine defekte Zeile verwirft die Antwort. |

Diese Angaben beschreiben das implementierte Profil; die verlinkten Teilberichte
benennen den geprüften Quell-/Buildstand und tatsächlich ausgeführte Tests.

## Geheimnisbefund und neue Vertrauensgrenze

NW-SECRET-01 betrifft einen gemeinsamen Lizenz-HMAC-Wert im vorherigen Paketstand.
Der Wert ist als potenziell offengelegt zu behandeln. Das korrigierte Verfahren
bezieht ihn ausschließlich aus `NEXOWATT_LICENSE_HMAC_SECRET`; die private
Serverkonfiguration wird getrennt vom Repository-/npm-Paket bereitgestellt.
Keine Geheimniswerte oder verwendbaren Lizenzfixtures werden in diese Akte
übernommen.

Die private Dienstumgebung muss vor einem Adapterupdate auf der Anlage
bereitstehen. Der Linux/systemd-Installer lädt nur die Dienstdefinition neu;
erst ein bewusst geplanter ioBroker-Neustart übernimmt die Umgebung. Ohne sie
können bestehende Lizenz-Gates Funktionen einschränken. Es wird keine neue
pauschale Geräteabschaltung als Geheimnisfehlerreaktion eingeführt.

Die separate Provisionierung kann die Bestandskompatibilität erhalten, wenn der
Lizenzgenerator weiterhin denselben Wert nutzt. Sie hebt die frühere Offenlegung
nicht auf. Rotation, sichere Verteilung neuer Werte und Migration bestehender
Lizenzen sind offene Hersteller-/Betriebsaufgaben. Bei einem symmetrischen
Lizenzverfahren muss der prüfende Prozess den Wert kennen; root-/Prozesszugriff
auf dem Gerät bleibt eine Vertrauensgrenze. Ein späteres asymmetrisches Verfahren
mit allein öffentlichem Prüfschlüssel auf Geräten wäre eine eigene
Architekturänderung mit neuen Tests.

Auslagerung, Fehlerverhalten und Nachtests stehen im
[Lizenz-Secret-Bericht](LIZENZ_SECRET_AUSLAGERUNG_DE.md), der Gesamtstatus im
[Befundregister](../../security/BEFUNDREGISTER_DE.md). Providerzugangsdaten sind
zusätzlich mit ihren konkreten Ablage-/Exportpfaden zu inventarisieren; die
Lizenzauslagerung beweist nicht automatisch die Sicherheit sämtlicher API-Zugänge.

## Prüfabdeckung und offene Zielsystemnachweise

| Bereich | Nachweis / Grenze |
| --- | --- |
| Normfassungen und Themenanwendung | Offizielle Quellen unten am 29.09.2026 geöffnet; Prozess-/Komponenten-/Systemumfang getrennt beschrieben |
| Wetter-/Prognosepfad | [Wetter-Nachweis](HTTPS_5S_WETTER_DE.md): maßgeblich für konkrete gemeinsame Deadline, Fallbacks, Schreibgrenze und tatsächlich ausgeführte Tests |
| Strompreis-/Tarifpfad | [Tarif-Nachweis](HTTPS_5S_TARIF_DE.md): 20 Prüfgruppen an der Quelle bestanden; gemeinsames Budget von OAuth und Preisabruf, vollständige Intervallvalidierung und Offline-/Stale-Verhalten. Die historische Elf-Gruppen-Prüfung allein belegt das neue Profil nicht; generierte Laufzeit im Gesamtbuild zusätzlich prüfen |
| Lizenzgeheimnis | [Auslagerungsnachweis](LIZENZ_SECRET_AUSLAGERUNG_DE.md): sechs Lizenzformate, neun ungültige Umgebungen, Bestandsformeln und private Installer-Format-/Rechteprüfungen an Quelle/typisiertem Spiegel. Finale generierte Laufzeit im Gesamtbuild nachprüfen; potenziell offengelegter Altwert bleibt ein Migrationspunkt |
| Pi 5 / Linux / ioBroker | Kein Test der realen CPU-/Speicher-/Datenträgerlast, OS-Rechte oder des ausgelieferten Controller-/Adapterverbunds ausgeführt |
| Netz / VPN / TLS-Bereitstellung | Keine Abnahme von realem Tailnet, Firewall, Zertifikatsverteilung, DNS-Umgebung oder VPN-Ausfall; HTTP-Browserlistener bleibt eigener Systembefund |
| Anlage und Offlineverhalten | Keine bestätigte Messung realer Sollwerte, Netzgrenzen, Kommunikationsausfälle, Wiederaufnahme oder Restore auf Betreiberhardware |

Ein JavaScript-Timer kann den Eventloop eines vollständig blockierten Prozesses
nicht unterbrechen. Die konfigurierte Netzwerkdeadline ist deshalb kein Nachweis
harter Echtzeit auf Linux/Pi 5. Der Lasttest muss Abbruchverzug und Regelzyklen
messen. Lokale Weiterverarbeitung, ioBroker-Lesen/-Schreiben und unabhängig gestartete
weitere Providerabrufe sind bei jeder Zeitbehauptung ausdrücklich vom einzelnen gemeinsamen
Abrufbudget zu unterscheiden. Innerhalb eines solchen Abrufs beginnt für OAuth,
Geocoding, einen Fallback oder einen anderen Folgerequest keine neue volle Frist.
Die freiwilligen Eigentests des Nutzers bleiben möglich; aus diesem Dokument
werden keine bereits erfolgten Hardwareprüfungen abgeleitet.

## Offizielle Quellen

Sämtliche Quellen am 29.09.2026 online überprüft; keine längeren Normtextauszüge
übernommen. Der direkte CRA-Volltextabruf wurde weiterhin durch die EUR-Lex-
Bot-Prüfung eingeschränkt; CRA-Grundlage und aktuelle Hersteller-/Normungsdarstellung
werden getrennt referenziert.

- **S1:** [Europäische Kommission – CRA manufacturers](https://digital-strategy.ec.europa.eu/en/policies/cra-manufacturers), Seitenstand 14.08.2026; Rechtsgrundlage [Verordnung (EU) 2024/2847](https://eur-lex.europa.eu/eli/reg/2024/2847/oj/eng).
- **S2:** [IEC – 62443-4-1:2018](https://webstore.iec.ch/en/publication/33615), Edition 1.0.
- **S3:** [IEC – 62443-4-2:2019](https://webstore.iec.ch/en/publication/34421), Edition 1.0, Berichtigung August 2022 enthalten.
- **S4:** [IEC – 62443-3-3:2013](https://webstore.iec.ch/en/publication/7033), Edition 1.0, Berichtigung April 2014 enthalten.
- **S5:** [Europäische Kommission – CRA standardisation](https://digital-strategy.ec.europa.eu/en/policies/cra-standardisation), Seitenstand 31.07.2026.
