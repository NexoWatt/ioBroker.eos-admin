# EOS-Partnerprotokoll v1: Datenabruf und eigenständige Speicher-Arbitrage

Stand: Implementierung auf Basis 1.0.31, Zielstand 1.0.32. Dieser Vertrag ist die erste EOS-Schnittstelle; er behauptet keine Kompatibilität mit einem konkreten Direktvermarkter oder Handelsanbieter. Ein Partner muss den Vertrag implementieren oder über einen separat geprüften Übersetzer angebunden werden. Pro Installation ist ein Partnerprofil vorgesehen.

## Anwendungsbereiche und tatsächlicher Umfang

| Bereich | App-/Grantkennung | Fachliche Ressource | Freigegebene Funktionen |
| --- | --- | --- | --- |
| Eigenständige Arbitrage | `arbitrage` | `single`, konkret zugeordnete dynamische Gruppenkennung | Telemetrie, Fähigkeiten, kurzlebige Lade-/Entladewünsche, Status, Abbruch |
| Bilanz | `energyLedger` | `site` | Ausgewählte Werte des letzten vollständigen Herkunftsintervalls |
| Direktvermarktung | `directMarketing` | `site` | PV-/Netztelemetrie und Fähigkeiten über den bestehenden PV-/EVU-Bereich |

Arbitrage ist eine eigene App. Ihr Profil `household` oder `tradingOnly` setzt weder PV noch Bilanz noch den Dynamischen Netzanschluss voraus. Der zentrale Speicherregler, frische Messwerte, lokale Inbetriebnahme und zentrale Leistungsfreigaben bleiben Voraussetzung für eine tatsächliche Stellwirkung. Die Direktvermarktung verwendet den vorhandenen PV-/EVU-Bereich; sie hat keine zusätzliche App-Installation.

`curtailment.request` ist als getrenntes Recht reserviert. Die erste Implementierung besitzt keinen produktiven Direktvermarktungs-Abregelpfad: `curtailmentSupported` ist `false`, Anfragen liefern `CONTROL_UNAVAILABLE`. Die bisherige Sammelressource `farm` bleibt ohne sichere individuelle SoC-/Writerprüfung gesperrt. Zeitpläne, beliebige State-IDs und Roh-Gerätebefehle sind nicht Bestandteil von v1.

## Verbindung und Geheimnisse

EOS stellt die Verbindung ausgehend über WSS her. Es wird kein neuer öffentlicher Port für Partner geöffnet. Das normale Installateur-API bleibt durch Sessionrolle und bestehende Authentisierung geschützt. Die WSS-Adresse enthält weder Benutzerinfo noch Query-Parameter oder Fragmente.

In `partnerIntegrations.credentialRef` steht ausschließlich ein Name nach `NEXOWATT_PARTNER_[A-Z0-9_]+`. Die dazugehörige geschützte Prozessumgebung enthält das Bereitstellungsdokument mit Partnerbindung, exaktem erlaubtem Host/Port/Pfad, Ablaufzeit und Bearer-/mTLS-Material. Konfiguration, Vorschau und API-Antwort enthalten keine Token, Zertifikatschlüssel oder Zugangsdateninhalte. Der genaue Bereitstellungs-, Journal- und Transportbetrieb ist in [PARTNER_RUNTIME_PROVISIONIERUNG_DE.md](PARTNER_RUNTIME_PROVISIONIERUNG_DE.md) beschrieben.

Die konfigurierte Endpunktadresse allein berechtigt nicht zum Zugriff auf ein beliebiges Ziel. Der Transport prüft sie gegen das geschützte Bereitstellungsdokument, TLS-Identität und die DNS-/Adressrichtlinie. Aufbau und Wiederverbindungen sind begrenzt. Ungültige oder abgelaufene Zugangsdaten sperren den Betrieb.

## Lokale Konfiguration

Die Konfiguration liegt ausschließlich unter `native.partnerIntegrations`. Neue Installationen starten mit `enabled: false`, leeren Freigaben und ohne Ressourcen. Die App wird separat als `emsApps.apps.arbitrage` installiert/aktiviert. Alle Felder werden serverseitig geprüft; unbekannte Schlüssel und implizite Typumwandlungen sind verboten.

```json
{
  "configVersion": 1,
  "enabled": false,
  "partnerId": "partner1",
  "endpoint": "wss://trade.example.org/eos",
  "credentialRef": "NEXOWATT_PARTNER_TRADING",
  "grants": [
    {
      "appId": "arbitrage",
      "resourceId": "single",
      "permissions": ["telemetry.read", "storage.charge.request", "storage.discharge.request", "dispatch.status.read", "dispatch.cancel"]
    }
  ],
  "arbitrage": {
    "profile": "tradingOnly",
    "maxCommandSeconds": 60,
    "resources": [
      {
        "id": "single",
        "maxChargeW": 5000,
        "maxDischargeW": 5000,
        "maxImportW": 10000,
        "maxExportW": 5000,
        "allowGridCharge": false,
        "allowGridExport": false,
        "commissioned": false,
        "minSocPct": 20,
        "maxSocPct": 90
      }
    ]
  }
}
```

Leistungen sind ganzzahlige Watt zwischen 0 und 100.000.000, SoC-Werte Prozent zwischen 0 und 100 mit Minimum kleiner Maximum. Null-W-Grenzen bleiben wirksame Sperren. Netzladung, Netzeinspeisung und `commissioned` benötigen ausdrückliche lokale Freigaben. Die Beispiele sind keine anlagenspezifische Inbetriebnahmeempfehlung.

Es sind höchstens 32 Ressourcen und 64 eindeutige App-/Ressourcenfreigaben zulässig. Die Befehlslaufzeit ist ganzzahlig zwischen 1 und 60 Sekunden. Fachliche Kennungen sind höchstens 64 Zeichen lang und enthalten nur Buchstaben, Ziffern, Unterstrich oder Bindestrich; sie sind keine ioBroker-Pfade.

| App | Zulässige Rechte |
| --- | --- |
| `energyLedger` | `balance.read` |
| `arbitrage` | `telemetry.read`, `capabilities.read`, `storage.charge.request`, `storage.discharge.request`, `dispatch.status.read`, `dispatch.cancel` |
| `directMarketing` | `telemetry.read`, `capabilities.read`, `curtailment.request`, `dispatch.status.read`, `dispatch.cancel` |

Die Reservierung eines Rechts verspricht keine verfügbare Stellfunktion. Insbesondere Direktvermarktungs-Steuerung bleibt gesperrt. Lizenz, tatsächliche Appaktivität und Ressource werden bei jeder Nutzung erneut geprüft.

## Installateur-API und CAS

Alle folgenden Routen erfordern die tatsächliche Sessionrolle `installer` oder `admin`. Eine alte Kunden-Session mit Wildcard-Capabilities genügt nicht. Antworten tragen `Cache-Control: no-store`.

| Methode und Pfad | Eingabe | Wirkung |
| --- | --- | --- |
| `GET /api/installer/partner-integrations` | keine | Bereinigte Konfiguration, Appzustand, Laufzeitstatus, Validierung |
| `POST /api/installer/partner-integrations/preview` | `{ "config": {…} }` | Strikte Entwurfsprüfung ohne Persistenz oder Gerätewirkung |
| `POST /api/installer/partner-integrations/config` | `{ "config": {…}, "expectedConfigVersion": 1, "app": {"installed": true, "enabled": false} }` | Sperren, Widerrufsgrenze sichern, CAS-Commit mit Version +1 |
| `POST /api/installer/partner-integrations/revoke` | `{ "expectedConfigVersion": 1 }` | Gesamtes Partnerprofil ausschalten, sämtliche Grants entfernen, Version +1 |

`app` ist optional und betrifft ausschließlich Arbitrage. Die Serverantwort ist `{ok, config, app, status, validation}`; `status` enthält `connection`, den festen Diagnosecode `reason`, `controlAvailable` und `revision`. `controlAvailable` zeigt die lokale Fähigkeit des sicheren Regelpfades. Es ist keine Gerätebestätigung. Eine Vorschau enthält zusätzlich `preview: true`; bei ungültigem Entwurf ist `config: null`, begleitet von Validierungsfehlern.

Veraltete Versionen liefern HTTP 409. Unbekannte/ungültige Felder liefern HTTP 400. Die Persistenz ist an den zentralen Speicherpfad gebunden; alternative Installer-/Importpfade dürfen diese CAS-Grenze nicht umgehen. Defekte manuell importierte Konfigurationen sperren die Verbindung und müssen durch den geschützten Administrations-/Wiederherstellungsweg korrigiert werden. Ein automatisches Zurücksetzen würde bestehende Sperr- und Revisionsnachweise verlieren.

Der Widerruf stoppt synchron aktuelle Wünsche und die Verbindung. Die Laufzeit persistiert die widerrufene Revision vor dem Konfigurationscommit. Ein fehlgeschlagener Commit darf eine alte aktive Konfiguration bei Refresh/Neustart nicht wieder freigeben. Nur eine erfolgreich gespeicherte höhere Revision kann den Sperrstand ablösen. Bei defekter Persistenz bleibt die laufende Instanz gesperrt; es gibt keine erfundene Dauerhaftigkeitsgarantie für ein vollständig ausgefallenes Speichermedium.

## Nachrichtenvertrag

Alle Nachrichten sind JSON-Text mit `protocol: "nexowatt.partner.v1"`, einer fachlichen `id` und `resourceId`. Unbekannte Felder werden abgewiesen. Die Partneridentität stammt aus dem authentisierten Transport und wird niemals aus einer Nachricht übernommen. Maximal 64 KiB pro Nachricht und 60 Nachrichten pro Minute begrenzen Speicher- und Persistenzbedarf.

Datenabruf:

```json
{"protocol":"nexowatt.partner.v1","id":"read-1","type":"data.read","appId":"energyLedger","resourceId":"site","kind":"balance"}
```

Beispielhafte Antwort, deren Werte von der konkreten Bilanz abhängen:

```json
{"protocol":"nexowatt.partner.v1","id":"read-1","ok":true,"code":"DATA","appId":"energyLedger","resourceId":"site","kind":"balance","data":{"intervalCount":1,"completeIntervalCount":1,"evcsTotalKwh":2.5,"pvDirectKwh":1.5,"gridDirectKwh":1}}
```

`kind` ist `balance`, `telemetry` oder `capabilities`. Bilanzprojektionen enthalten ausschließlich benannte Energiemengen und Zeitraumwerte; keine Konfiguration, Inventare, Zählerzuordnungen, personenbezogenen Identifikatoren oder vollständigen Rohjournale. Telemetrie enthält nur `powerW`, `gridPowerW`, `socPct`, `updatedAtMs` und `available`, soweit fachlich verfügbar. Fehlende/veraltete Messwerte werden nicht als Nullmessung ausgegeben. Für Bilanz wird nur ein vollständiges, frisches abgeschlossenes Intervall verwendet.

Fähigkeiten verwenden ausschließlich `maxChargeW`, `maxDischargeW`, `maxCurtailmentW`, `chargeSupported`, `dischargeSupported` und `curtailmentSupported`. Datenfreigaben werden vor dem Lesen und nach asynchroner Aufbereitung erneut geprüft; der Transport prüft Sitzungsgeneration und Freigabe nochmals vor dem Senden. Datenabfragen erhalten ein Abbruchsignal und enden spätestens nach fünf Sekunden.

Speicherwunsch mit Zeitstempeln als Unix-Millisekunden, hier rein illustrativ:

```json
{"protocol":"nexowatt.partner.v1","id":"dispatch-1","type":"storage.dispatch","appId":"arbitrage","resourceId":"single","action":"charge","powerW":3000,"issuedAt":1793188800000,"expiresAt":1793188830000,"configVersion":2}
```

Der Partner muss `issuedAt` und `expiresAt` frisch setzen sowie die freigegebene `configVersion` verwenden. `action` ist ausschließlich `charge` oder `discharge`, `powerW` ein endlicher positiver Wunschwert innerhalb der lokalen Grenze. Zukunftstoleranz an der Protokollgrenze beträgt maximal zehn Sekunden; der zentrale Regler aktiviert keinen Wunsch vor dessen `issuedAt`.

Annahmebestätigung:

```json
{"protocol":"nexowatt.partner.v1","id":"dispatch-1","ok":true,"code":"ACCEPTED","status":"accepted","expiresAt":1793188830000,"deviceAcknowledged":false}
```

`ACCEPTED` bedeutet ausschließlich: Rechte und statische Grenzen geprüft, Replayeintrag dauerhaft geschrieben, kurzlebiger Wunsch für den zentralen Regler verfügbar. Lokale Messwerte, SoC-/Anschlussgrenzen, konkurrierende Regler, Steuerhoheit und der zentrale Writer entscheiden weiterhin über jeden tatsächlichen Stellschritt. Die Antwort behauptet keine Ladeleistung, Abrechnung oder physische Ausführung.

Status und Abbruch:

```json
{"protocol":"nexowatt.partner.v1","id":"status-1","type":"dispatch.status","appId":"arbitrage","resourceId":"single"}
```

```json
{"protocol":"nexowatt.partner.v1","id":"cancel-1","type":"dispatch.cancel","appId":"arbitrage","resourceId":"single","commandId":"dispatch-1"}
```

## Wiederholungen, Reihenfolge und Ausfälle

Vor der Annahme wird eine SHA-256-Prüfsumme des kanonischen Fachwunsches mit Kennung, Partner, Ressource, Zeit und Revision im geschützten Journal gespeichert. Die vorhandene Kryptobibliothek wird verwendet. Die Kennung ist innerhalb des Replayfensters eindeutig pro Partner.

Identische Wiederholung liefert `DUPLICATE` ohne erneute Wirkung. Das dortige `status: "accepted"` bezeichnet ausschließlich den bereits dauerhaft geschriebenen Journaleintrag. Nach Widerruf während des Commits, Verbindungsabbruch oder Neustart kann dieser Eintrag bestehen, obwohl kein aktueller Wunsch vorhanden ist. Die Wiederholung reaktiviert ihn nicht; den derzeitigen Wunschzustand liefert nur `dispatch.status`, weiterhin ohne Gerätebestätigung. Eine abweichende Nachricht mit gleicher Kennung liefert `ID_CONFLICT`. Eine neue Kennung mit älterem oder identischem `issuedAt` für denselben Partner/Speicher liefert `OUT_OF_ORDER`. Der persistierte Höchststand gilt auch nach Neustart. Nach Neustart werden keine früheren Steuerwünsche wiederhergestellt.

Das Journal ist auf 2.048 Einträge begrenzt. Abgeschlossene Einträge werden nach zehn Minuten bei der nächsten Annahme entfernt. Dieses Fenster überdeckt die maximale 60-Sekunden-Laufzeit und Zukunftstoleranz; alte Befehle bestehen die Zeitprüfung nicht mehr. Ein volles, defektes oder nicht beschreibbares Journal sperrt neue Annahmen. Das Journal ist ein Replay-/Sicherheitsmechanismus und kein unbegrenztes kaufmännisches Handelsarchiv.

Wanduhrablauf und eine monotone lokale Frist begrenzen Wünsche zusätzlich. Rückwärts springende Systemzeit verlängert keinen bereits angenommenen Auftrag. Verbindungsabbruch, Appabschaltung, Konfigurationswechsel, Widerruf oder fehlende zentrale Regelfähigkeit entziehen den aktuellen Wunsch. Der alleinige zentrale Writer behält seine bestehenden gerätespezifischen Rückfallmechanismen. Es gibt ausdrücklich keine Exactly-once-Garantie für physische Gerätewirkung.

Feste Fehlercodes umfassen `INVALID_MESSAGE`, `NOT_AUTHORIZED`, `CONTROL_UNAVAILABLE`, `RESOURCE_UNAVAILABLE`, `LIMIT_EXCEEDED`, `COMMAND_EXPIRED`, `OUT_OF_ORDER`, `ID_CONFLICT`, `REVOKED`, `JOURNAL_UNAVAILABLE`, `JOURNAL_FULL`, `RATE_LIMITED`, `MESSAGE_TOO_LARGE` und `OPERATION_UNAVAILABLE`. Interne Fehlertexte, Pfade und Geheimnisse werden nicht an den Partner ausgegeben.

## Prüfnachweise und Grenzen

Der reproduzierbare Backend-Prüflauf ist `node scripts/test-partner-integrations.cjs`; strenge Typprüfung: `node node_modules/typescript/bin/tsc -p tsconfig.partner-integration.json`. Die Tests kompilieren die echten Runtimequellen und prüfen unter anderem fehlende Rollen, unbekannte Felder, Rechte-/Ressourcentrennung, CAS, Persistenz vor Annahme, Neustart, Replay, Reihenfolge, Widerruf während laufender Persistenz/Abfrage, monotone Frist und Datenminimierung. Transport, lokale Bereitstellung, zentraler Writer und UI besitzen weitere getrennte Prüfungen.

Diese Implementierung und ihre Prüfnachweise unterstützen die technische Sicherheitsdokumentation. Sie ersetzen keine CRA-Konformitätsbewertung, produktive Partnerabnahme, Geräte-/Netzschutzprüfung oder tatsächliche Inbetriebnahme am Speicher. Offene Hardware- und Betreiberprüfungen müssen im Releasebericht ausdrücklich erhalten bleiben.
