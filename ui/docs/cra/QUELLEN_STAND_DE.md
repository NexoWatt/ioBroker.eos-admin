# Offizielle Quellen und gewählter Stand

Onlineprüfung am **29.09.2026**. Links dienen der Rückverfolgung; die technische
Risikoeinschätzung und die projektspezifischen Maßnahmen sind eigene Ableitungen.
Eine vollständige juristische Produktklassifizierung oder Normprüfung wurde
durch diesen Quellenabgleich nicht durchgeführt.

| ID | Offizielle Quelle | Verwendeter Stand / Ergebnis |
| --- | --- | --- |
| Q1 | [Verordnung (EU) 2024/2847, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2024/2847/oj/eng) sowie [amtliche Volltextfundstelle](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32024R2847) | CRA als Rechtsgrundlage. Direkter Volltextabruf zeitweise durch Bot-Prüfung blockiert; amtliche indexierte Textstellen zu Art. 13 und offizielle Kommissionsseiten abgeglichen. Kein vollständiger Abgleich aller Änderungen/Berichtigungen |
| Q2 | [Europäische Kommission: Reporting obligations](https://digital-strategy.ec.europa.eu/en/policies/cra-reporting) | Aktualisiert 11.09.2026: Hersteller-Meldepflichten ab diesem Datum, Fristen und SRP |
| Q3 | [ENISA: Single Reporting Platform](https://www.enisa.europa.eu/topics/product-security/single-reporting-platform-srp) | SRP-Betrieb und Nutzerinformationen vorhanden. Keine Registrierung oder Meldung durch diesen Auftrag |
| Q4 | [Europäische Kommission: CRA summary](https://digital-strategy.ec.europa.eu/en/policies/cra-summary) | Allgemeine Anwendung ab 11.12.2027; Hersteller-/Produktverantwortung, technische Unterlagen und Bestandsprodukte |
| Q5 | [Europäische Kommission: Conformity assessment](https://digital-strategy.ec.europa.eu/en/policies/cra-conformity-assessment) | Amtlicher Suchtreffer bestätigt unterschiedliche Verfahren nach Produktkategorie und verweist auf Durchführungsverordnung (EU) 2025/2392; Direktabruf zeitweise nicht möglich. Konkrete EOS-Einstufung offen |
| Q6 | [IEC 62443-4-1:2018](https://webstore.iec.ch/en/publication/33615) | Edition 1.0, publiziert 15.01.2018, Stabilitätsdatum 2027. Öffentliche Beschreibung betrifft den sicheren Produktentwicklungslebenszyklus; vollständiger Normtext nicht geprüft |
| Q7 | [OWASP ASVS](https://owasp.org/projects/asvs) und [offizielles ASVS-Repository](https://github.com/OWASP/ASVS) | Aktuelle stabile Ausgabe laut Projekt 5.0.0 (Mai 2025). Entwicklungsversion nicht als freigegebener Standard verwendet |
| Q8 | [OWASP ASVS-Kapitelindex](https://cheatsheetseries.owasp.org/IndexASVS.html) | Zuordnung auf Kapitel-/Themenebene für ASVS 5.0.x; keine Einzelerfüllung aus dem Index ableitbar |
| Q9 | [NIST SSDF-Publikationsliste](https://csrc.nist.gov/projects/ssdf/publications) und [SP 800-218 final](https://csrc.nist.gov/pubs/sp/800/218/final) | SSDF 1.1 vom Februar 2022 final; 1.2 / SP 800-218 Rev. 1 vom 17.12.2025 als Draft gelistet |
| Q10 | [IEC 62443-4-2:2019](https://webstore.iec.ch/en/publication/34421) | Am 29.09.2026 direkt geöffnet: Edition 1.0, Berichtigung August 2022 integriert, Stabilitätsdatum 2027. Technische Komponentenanforderungen und Komponentenfähigkeiten; keine erreichte EOS-Einstufung daraus abgeleitet |
| Q11 | [IEC 62443-3-3:2013](https://webstore.iec.ch/en/publication/7033) | Am 29.09.2026 direkt geöffnet: Edition 1.0, Berichtigung April 2014 integriert, Stabilitätsdatum 2027. Systemanforderungen im Kontext definierter Zonen und Kommunikationsverbindungen |
| Q12 | [Europäische Kommission: CRA manufacturers](https://digital-strategy.ec.europa.eu/en/policies/cra-manufacturers) | Am 29.09.2026 direkt geöffnet, Seitenstand 14.08.2026: Herstellerprozess aus Risikobewertung, technischen Unterlagen, Konformitätsbewertung und Schwachstellenbehandlung |
| Q13 | [Europäische Kommission: CRA standardisation](https://digital-strategy.ec.europa.eu/en/policies/cra-standardisation) | Am 29.09.2026 direkt geöffnet, Seitenstand 31.07.2026: europäische Normungsarbeit und Konformitätsvermutung für anwendbare harmonisierte Standards; keine pauschale Gleichsetzung mit IEC 62443 |

CRA ist eine Verordnung. Die Ausrichtung an IEC 62443-4-1, ASVS und SSDF wird hier
als Entwicklungs-/Prüfstrategie dokumentiert; damit wird weder eine harmonisierte
Normenanwendung noch eine gesetzliche Konformitätsvermutung behauptet.
Die ergänzende Einordnung für industrienahes EOS auf Raspberry Pi 5 steht im
[HTTPS-/IEC-Anforderungsnachweis](../reports/cra-2026-09-29/HTTPS_5S_CRA_IEC_ANFORDERUNGEN_DE.md).
Die öffentlichen IEC-Produktbeschreibungen belegen Fassungsstand und Gegenstand;
sie ersetzen nicht den vollständigen Normtext für ein Klauselaudit.

Für NexoWatt als unter eigener Marke bereitgestelltes EOS-Endgerät ist eine
Herstellerverantwortung zu prüfen und technisch vorzubereiten. Welche konkrete
Produktkategorie und welches Bewertungsverfahren für das gesamte Endgerät gelten,
kann nicht aus dem Namen dieses einzelnen Adapters entschieden werden. Der
Code-/Systemumfang und die vorgesehenen Funktionen sind vor der Entscheidung
gegen die jeweils geltenden Produktbeschreibungen abzugleichen. Auch lokale
Nutzung ohne Cloud hebt Netzwerk- und Schnittstellenrisiken nicht auf.

Die vorliegenden Dokumente enthalten keine veröffentlichte Supportzusage,
EU-Konformitätserklärung oder behauptete Zertifizierung. Vor formaler Bewertung
sind der vollständige dann geltende Rechtsstand, anwendbare Normen und tatsächliche
Produktkonfiguration verbindlich abzugleichen und die Abnahme zu protokollieren.
