# Kundentarif – gezielte Sicherheits- und Funktionsprüfung

Stand: 24.11.2026. Betroffen sind die Kundeneinstellungen, die neue begrenzte Tarif-API und die bestehende Tarifpreis-Laufzeit. Der Tarif gilt für die ganze Anlage, nicht nur für das angemeldete Benutzerkonto.

## Umfang und Grenzen

`GET/PUT /api/customer/tariff-provider` verwendet die bestehende Anmeldung, Origin-/CSRF-Prüfung und zentrale Tariflizenz. Zugelassen sind die vorhandenen Rollen Kunde, Installateur und Administrator. Der neue PUT verlangt immer eine geladene Konfigurationsrevision und verwendet dieselbe Mutationssperre und denselben geschützten Installer-State wie das AppCenter. Veraltete Formulare ändern weder neue Gerätezuordnungen noch andere Konfigurationsabschnitte.

Die Feldliste umfasst ausschließlich Anbieter, Tarifland, bekannten Preisquellentyp, Hauskennung, Preisbestandteile und die benötigten anbieterspezifischen Zugangswerte. Freie URLs, Header, Methoden, DP-Pfade, App-Schalter, Leistungsgrenzen, Betriebsschalter oder Zertifikatsausnahmen werden abgewiesen. Tibber, EnergyZero und ENTSO-E verwenden die bereits vorhandenen Clients mit serverseitig festgelegten HTTPS-Zielen. Anbieterprofile stehen für eine Marktpreisquelle plus Vertragsbestandteile; sie behaupten keine direkte API-Anbindung des genannten Lieferanten. Ostrom-/Custom-REST-Anschlüsse bleiben erhalten und werden als vom Installateur eingerichtet dargestellt.

Leere Zugangsfelder bewahren einen vorhandenen Token nur bei unveränderter Anbieter-ID, unveränderter zugrunde liegender Quelle und passendem bisherigen festen Endpunkt. Ein Wechsel verlangt einen neuen passenden Token. Frühere Zugangsdaten bleiben ausschließlich im privaten `retainedProviderCredentials`-Archiv; kein Providerclient liest dieses Archiv und es gibt keine automatische Wiederverwendung. Das Archiv ist aus Kundenausgaben, normalen AppCenter-Konfigurationsantworten und den AppCenter-Export-/Backup-HTTP-Antworten entfernt. Interne Wiederherstellungssicherungen und ioBroker-Hostbackups behalten die Daten zur Wiederherstellung.

Die Speicherung verwendet die vorhandenen ACL-geschützten Zustände mit eingeschränkten Leserechten. Damit ist keine Verschlüsselung der gespeicherten `installer.configJson` behauptet. Vollständige Hostbackups müssen entsprechend behandelt werden. Die neue Kundenseite zeigt nur Vorhanden-Flags und gibt niemals Token oder Archivwerte zurück. Fehlerantworten verwenden feste öffentliche Meldungen; keine Providerantwort, URL oder Zugangsdaten werden protokolliert.

## Daten- und Betriebsübernahme

Die neue API normalisiert nicht die gesamte Anlagenkonfiguration. Bestehende boolesche Tarifbetriebsflags bleiben auch bei deaktiviertem Provider erhalten; erstmals fehlende Flags werden bei vorher inaktivem Provider auf falsch gesetzt. Die API kann diese Flags nicht direkt verändern. Bereits konfigurierte Betriebsabsichten werden deshalb bewahrt, ohne neue App-Freigaben aus dem Tarifformular anzunehmen.

Nur die ausdrückliche Auswahl „Diese Preise im EOS verwenden“ koppelt die vier bekannten Tarif-Lesepunkte. Vorherige manuelle Preiszuordnungen werden dabei für die Rückkehr aufbewahrt. Abschalten der Kopplung beziehungsweise Rückkehr zum manuellen Tarif stellt diese vorhandenen Zuordnungen wieder her, soweit sie unverändert als verwaltete Vierergruppe vorliegen. Es werden keine Messwerte erfunden und keine Aktor-DPs geschrieben.

Die Laufzeit übernimmt den Anbieter ohne Neustart der gesamten EMS-Engine. Generationen sperren verspätete Antworten einer alten Quelle; gespeicherte alte Preise werden vor der neuen Quelle ungültig. Die tatsächlichen Tarif-/Preis-Leser in der EMS-Datenpunktregistrierung werden ebenfalls neu gebunden, nicht nur die Anzeige-Abonnements. Die separaten Laufzeittests prüfen verspätete Antworten, fehlgeschlagene Löschschreibvorgänge, Umschaltung und Wiederanbindung. Echte Anbieterzugänge und Energiesystem-Hardware sind keine Bestandteile dieser Mock-/HTTP-Prüfung.

## Scanner-Einzelprüfung

Die neun bereits einzeln geprüften Dictionary-/History-Fundstellen in `main.ts` wurden nach den neuen Routen erneut an ihren Datenquellen geprüft; ihre Operationen sind unverändert. Die neue Tariflogik enthält keine pauschalen Scanner-Ausnahmen. Die Ablehnung des öffentlichen Eingabeplatzhalters `__KEEP__` ist eine feste Eingabe-Sperrliste, kein Vergleich mit einem gespeicherten geheimen Wert.

Eine zusätzliche geprüfte Fundstelle in `www/ems-apps.ts` betrifft den vorhandenen Schreibzugriff `sf2.storages[i].pvPowerId`: Der Index wird vor der Anzeige ganzzahlig auf die vorhandene Speicherliste begrenzt und der Propertyname ist konstant. Nur Beschriftung und Hilfetext wurden präzisiert („Messwert-Datenpunkt“, keine feste Wattzahl). Deshalb änderte sich der zeilenbezogene Scanner-Fingerprint ohne neuen Schreibweg. Der historische offene Scannerbestand bleibt separat sichtbar; dies ist kein sauberer Gesamtscan oder Konformitätsnachweis.

## Nachweise

Die unabhängigen HTTP-Tests verwenden die wirklichen Hosted-Routen und den geschützten Persistenzpfad mit einer lokalen ioBroker-Datenbankattrappe. Sie prüfen Anmeldung, CSRF/Origin, Fremdfelder, unveränderte Anlagenwerte, Revisionen, Geheimnisgrenzen, echte Laufzeitbindungen und fehlgeschlagene Speicherung. Der Browserhelfer wird zusätzlich gegen den tatsächlichen Backend-Validator auf gleiche Anbieter-/Tokenregeln geprüft. Strict-TypeScript und typisiertes ESLint sind für beide neuen Helfer Bestandteil der Releasebefehle.

Die abschließenden Testzahlen stehen im Releasebericht. Tests ohne produktive Providerkonten und ohne reale Speicher/Wallboxen ersetzen keine Kunden-Inbetriebnahmeprüfung.
