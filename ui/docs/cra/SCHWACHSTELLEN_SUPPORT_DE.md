# Schwachstellenbehandlung, Meldebereitschaft und Support

Stand: 29.09.2026; vorbereitet für 1.0.22 Security Review.
Dies ist der zu operationalisierende Herstellerprozess. Das Dokument selbst
richtet keinen Meldekanal, keine Überwachung, keine Rufbereitschaft und kein
SRP-Konto ein. Eine Sicherheitsmeldung wurde durch diesen Prüfauftrag nicht
an externe Stellen versandt.

## Bearbeitung eines Befunds

1. Eingang mit Uhrzeit/Zeitzone, betroffenem Produkt, Version, Konfiguration,
   Kontakt und vertraulichem Beleg erfassen. Kundenlogs nur bereinigt ablegen.
2. Meldung als reproduzierter Produktbefund, zutreffendes Advisory, Verdacht,
   Fehlkonfiguration oder Fehlalarm kennzeichnen. Betroffenheit des tatsächlich
   gelieferten Baums und des Aufrufpfads prüfen; CVE/GHSA nicht ungeprüft zuordnen.
3. Anlagenwirkung und laufenden Angriff bewerten. Bei möglicher aktiver Ausnutzung
   oder schwerwiegendem Sicherheitsvorfall unmittelbar die Meldeprüfung starten;
   eine vollständige Ursachenanalyse darf gesetzliche Fristen nicht verzögern.
4. Mitigation so wählen, dass Schutz- und Regelungsfunktionen erhalten bleiben.
   Bei Gerätewirkung projektspezifische Rückfälle dokumentieren und Betreiber
   über konkrete Einschränkung und Handlungsbedarf informieren.
5. Ursache in maßgeblicher Quelle beheben; relevante Varianten/weitere APIs
   mitprüfen. Neue Negativ-/Regressionstests, Build, Paket und Restbefund bewerten.
6. Update und bereinigte Hinweise freigeben. Bei Drittkomponenten vertraulich
   mit deren Verantwortlichen koordinieren; keine Angriffsdetails vor wirksamer
   Abhilfe öffentlich machen, sofern dem keine rechtliche Pflicht entgegensteht.
7. Nachtest, betroffene/feste Version, Verteilung und Kundeninformation belegen.
   Erst dann technisch schließen; verbleibende Hersteller-/Systemaufgaben
   bleiben separat offen. Ursachenanalyse in Regeln/Tests zurückführen.

Im [zentralen Befundregister](../security/BEFUNDREGISTER_DE.md) sind mindestens
Kennung und verständlicher Titel, konkrete Komponente/Version, Bedingungen,
Beleg, Auswirkung, Priorität, Maßnahme, Zuständiger, Zieltermin und Nachtest zu führen.
Eine bloße Scannerwarnung ist keine nachgewiesene Ausnutzung; ein Scan ohne Treffer
ist kein Nachweis der Fehlerfreiheit.

## CRA-Meldebereitschaft

Die Hersteller-Meldepflichten nach Art. 14 gelten seit **11.09.2026**. Für aktiv
ausgenutzte Schwachstellen bzw. schwerwiegende Sicherheitsvorfälle nennt die
Kommission Frühwarnung binnen **24 Stunden**, Hauptmeldung binnen **72 Stunden**
ab Kenntnis sowie Abschlussbericht: bei Schwachstellen spätestens **14 Tage nach
verfügbarer Korrekturmaßnahme**, bei Vorfällen binnen **eines Monats nach der
72-Stunden-Meldung**. Einreichung erfolgt über die ENISA-SRP. Diese Fristen sind
keine erlaubten Wartezeiten für die technische Reaktion. [Q2, Q3]

Die Meldeprüfung muss auch bereits ausgelieferte Produkte berücksichtigen;
der allgemeine CRA-Anwendungsbeginn am 11.12.2027 verschiebt Art. 14 nicht.
Bekannte Repositorybefunde sind nicht automatisch eine aktiv ausgenutzte
Schwachstelle. Kenntniszeitpunkt, Entscheidung und Entscheidungsgrund dokumentieren.

| Noch einzurichten / festzulegen | Abnahmekriterium |
| --- | --- |
| Sicherheitsverantwortlicher und Vertretung | Namentliche Zuständigkeit mit erreichbarem Vertretungsweg und dokumentierter Übergabe |
| Öffentlich auffindbarer vertraulicher Kontakt | Tatsächlich eingerichtete Adresse/Formular, Zustelltest, Zugriffsrechte und Verfahren für vertrauliche Anhänge |
| SRP-Berechtigung | Herstellerkonto/Vertreterzugang geprüft; Kontakt- und Zuständigkeitsdaten aktuell; keine Zugangsdaten in der Akte |
| Meldeübung | Fiktiver Vorfall intern durchgespielt, Kenntniszeit und Fristenberechnung geprüft; keine fingierte Behördenmeldung |
| Kunden-/Versionsregister | Betroffene Installationen und verantwortliche Betreiber sicher erreichbar, ohne pauschalen Cloudbetrieb vorauszusetzen |
| Advisory-Beobachtung | Verantwortlicher, Quellen, Turnus, Vertretung und Protokoll festgelegt; derzeit keine durch diese Arbeit eingerichtete Automation |

## Support- und Aufbewahrungsentscheidung

Für die Serienfreigabe sind erwartete Nutzungsdauer und Sicherheitsunterstützung
des **gesamten EOS-Endgeräts** zu bestimmen. Die gesetzliche Grundregel ist mindestens
fünf Jahre Support; die Ausnahme betrifft Produkte mit kürzer erwarteter Nutzung.
Eine längere vorgesehene Nutzung ist bei der Festlegung zu berücksichtigen.
Technische Dokumentation/Konformitätserklärung sind mindestens zehn Jahre nach
Inverkehrbringen oder für den längeren Supportzeitraum vorzuhalten. Sicherheitsupdates
müssen ab Bereitstellung mindestens zehn Jahre bzw. für den längeren verbleibenden
Supportzeitraum verfügbar bleiben. [Q1]

Der konkrete EOS-Supportzeitraum, sein kaufbegleitend anzugebendes Enddatum
(Monat/Jahr), unterstützte Versionszweige, kostenlose Sicherheitsupdatewege,
Offline-Updateprozess und Regeln am Supportende sind **noch zu entscheiden**.
Eine jährliche Lizenz-/Servicegebühr ist kein Ersatz für diese Festlegung.
Die Aufbewahrung muss auch Rohbelege, verteilte Pakete, Hashes und Wiederherstellung
der Nachweisablage einschließen. CI-Logs mit kurzer automatischer Löschfrist reichen
als einzige dauerhafte Ablage nicht aus.

Quellen: [Q1–Q3 im Quellenverzeichnis](QUELLEN_STAND_DE.md).
