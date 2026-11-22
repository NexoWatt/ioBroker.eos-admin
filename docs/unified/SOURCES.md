# Quellenprüfung

Geprüft am **22.11.2026**. Primärquellen für Metadaten, Veröffentlichungswege und
CRA-Anwendbarkeit. Die Quellen belegen Anforderungen, keine Erfüllung durch dieses
Produkt. Bewegliche Webseiten vor Serienfreigabe erneut prüfen.

| ID | Quelle | Verwendeter Gegenstand |
| --- | --- | --- |
| IO-01 | [ioBroker repositories](https://github.com/ioBroker/ioBroker.repositories) | Entwicklung, sichere Konfigfelder, Unload, Repositoryaufnahme, kommerzielle Adapter. |
| IO-02 | [ioBroker publishing](https://www.iobroker.com/docs/dev/adapterpublish.md) | Namens-/Versionskonvention, Metadaten, README, Paket-/Integrationstests. |
| IO-03 | [Controller object types](https://github.com/ioBroker/ioBroker.js-controller/blob/master/packages/types-dev/objects.d.ts) | `licenseInformation`: `paid`, `commercial`, `limited`; Pflichtlink. |
| NPM-01 | [npm package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) | Custom-Lizenz `SEE LICENSE IN LICENSE`; `private` ist Publikationssperre; Paketinhalt. |
| NPM-02 | [npm scopes](https://docs.npmjs.com/about-scopes/) | Ungescopte Pakete sind öffentlich; private Pakete benötigen Scope. |
| NPM-03 | [npm private packages](https://docs.npmjs.com/about-private-packages/) | Private Paketberechtigungen und Kontovoraussetzung. |
| CRA-01 | [EU-Kommission: manufacturers](https://digital-strategy.ec.europa.eu/en/policies/cra-manufacturers) | Risikoanalyse, technische Unterlagen, sichere Voreinstellungen, Support. |
| CRA-02 | [EU-Kommission: reporting](https://digital-strategy.ec.europa.eu/en/policies/cra-reporting) | 11.09.2026; 24/72 Stunden; Abschlussberichte; SRP. |
| CRA-03 | [EU-Kommission: implementation](https://digital-strategy.ec.europa.eu/en/factpages/cyber-resilience-act-implementation) | Vollständige Anwendung am 11.12.2027. |
| CRA-04 | [EU-Kommission: conformity assessment](https://digital-strategy.ec.europa.eu/en/policies/cra-conformity-assessment) | Kategorie-/Verfahrensprüfung; Bezug auf Durchführungsverordnung (EU) 2025/2392. |
| CRA-05 | [Verordnung (EU) 2024/2847](https://eur-lex.europa.eu/eli/reg/2024/2847/2024-11-20/eng) | Artikel 13, Support/Sicherheitsupdates, technische Unterlagen und Anhänge. |

Die vollständigen kostenpflichtigen IEC-Normtexte wurden in dieser Arbeit nicht
beschafft oder vollständig geprüft. ASVS-/SSDF-/IEC-/Datenschutzbezüge aus der
Entwicklungsrichtlinie bleiben Prüfgrundlage; das neue Register legt deren Scope
fest. Es wird kein unverifiziertes neues Ausgabejahr als aktuelle Normfassung
behauptet. EUR-Lex lieferte beim Direktabruf teils einen Bot-Schutz; zitierte Artikel-
und Supportinhalte waren über die amtlichen Suchauszüge verfügbar. CRA-Fristen und
Verfahren wurden zusätzlich über die geöffneten Kommissionsseiten abgeglichen.
