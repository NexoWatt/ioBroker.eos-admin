# Direkter HTTPS-Transport: geprüfter Helfervertrag

Stand: 22. November 2026, NexoWatt UI 1.0.38. Der maßgebliche Helfer liegt unter `src-ts/runtime-executables/lib/ui-server-transport.ts`. Er erstellt weder einen Listener noch Zertifikate oder Dateien.

## Auswahl und Serverstart

`resolveUiTlsOptions(adapter, config)` liefert `Promise<https.ServerOptions | null>`. Nur `secure: false` oder eine nicht gesetzte Einstellung liefern `null` für den vorhandenen HTTP-Transport hinter einem geeigneten HTTPS-Proxy. `secure: true` verlangt ausdrücklich gewählte Namen unter `certPublic` und `certPrivate`; `certChained` ist optional. Andere Werte für `secure` werden abgelehnt. Es gibt keine automatische Auswahl gemeinsamer Standardschlüssel und keine eingebetteten privaten Schlüssel in der Adapterkonfiguration.

Die Namen werden an die zentrale Zertifikatverwaltung übergeben. Deren Leseschnittstelle lautet `getCertificates(publicName, privateName, chainedName, callback)`; der Callback liefert einen Fehler oder `{ key, cert, ca }`. Die zusätzliche Rückgabe zur automatischen Zertifikatverwaltung wird nicht verwendet. Eine fehlende Schnittstelle, fehlende Auswahl, Zeitüberschreitung oder ungültige Zertifikate führen zu einem `UiTlsConfigurationError` mit festem Fehlercode und fester Meldung. Der aufrufende Serverstart muss danach abbrechen und darf keinen HTTP-Ersatzlistener öffnen.

## Größen, Kryptografie und Kette

| Grenze | Wert |
| --- | --- |
| Gemeinsames Warte-/Prüfbudget pro Start | 5.000 ms |
| Grenze für einen unvollständigen eingehenden TLS-Handshake | 5.000 ms |
| Privater PEM-Schlüssel | 64 KiB |
| Öffentliches PEM-Zertifikat einschließlich dort enthaltener Kette | 64 KiB |
| Optional gesondert ausgewählte PEM-Kette | 256 KiB |
| Zertifikate insgesamt, vor Entfernen identischer Duplikate | 8 |
| Länge eines gewählten Zertifikatsnamens | 256 Zeichen |
| Niedrigste TLS-Version | TLS 1.2 |

Der Helfer akzeptiert ausschließlich PEM-Inhalte mit den unterstützten Blocktypen, keine Dateipfade oder impliziten Objektkonvertierungen. Der Schlüssel muss unverschlüsselt vorliegen; eine Passwortverwaltung für verschlüsselte PEM-Schlüssel wird nicht ergänzt. Die zentrale Verwaltung bleibt für die geschützte Speicherung zuständig.

Alle ausgewählten Zertifikate werden als X.509 gelesen und auf zeitliche Gültigkeit geprüft. Der private Schlüssel muss zum ersten Serverzertifikat passen. Nachfolgende Zertifikate müssen jeweils das vorherige Zertifikat ausstellen, als CA gekennzeichnet sein und dessen Signatur verifizieren. Das Serverzertifikat steht zuerst; Zwischenzertifikate folgen in Richtung Aussteller. Identische Duplikate werden entfernt. Der Helfer hängt die Kette tatsächlich an `ServerOptions.cert` an, damit der TLS-Server sie an Clients übermittelt. Eine alleinige CA-Vertrauensliste würde dies nicht ersetzen.

Vor Rückgabe wird ein nativer Node-TLS-Kontext erstellt. Clientzertifikate werden nicht angefordert. Systemweite TLS-Prüfung wird nicht abgeschaltet und schwache Sondercipher werden nicht hinzugefügt. Der Helfer entscheidet weder über den tatsächlich verwendeten Browserhost noch über dessen Vertrauensspeicher: Der aufgerufene DNS-Name beziehungsweise die IP-Adresse muss zum Zertifikat passen, und das Endgerät muss der ausstellenden CA vertrauen. Ein vollständiger Browser-Vertrauensnachweis oder Zertifikatserneuerungsdienst ist damit nicht behauptet.

## Zeitbudget und Lebenszyklus

Das fünfsekündige Budget beginnt vor dem Zertifikatsaufruf und umfasst das Warten sowie Prüfungen vor und nach den begrenzten PEM-/Kryptoarbeiten. Nach Ablauf wird die Startfreigabe verworfen. Eine verspätete Antwort kann den zuvor abgelehnten Start nicht wieder freigeben. Solange der ursprüngliche Leseauftrag nicht durch Callback oder Fehler abgeschlossen wurde, wird für denselben Adapter kein weiterer Leseauftrag gestartet.

**Grenze der Controller-Schnittstelle:** Die geprüfte API bietet keinen Abbruchmechanismus für ihre internen Datenbank- und Dateizugriffe. Deshalb beendet der Helfer nach fünf Sekunden das Warten und verhindert eine spätere Nutzung, kann den fremden Leseauftrag aber nicht physisch abbrechen. Ein synchron blockierender Controller-Aufruf kann im selben JavaScript-Thread auch den Timer verzögern; unmittelbar nach seiner Rückkehr wird das abgelaufene Budget erneut geprüft. Diese Einschränkung darf nicht als nachgewiesene physische I/O-Abbruchgarantie beschrieben werden.

Neue Zertifikate werden beim nächsten kontrollierten Adapterstart gelesen. Diese Änderung ergänzt keine eigene Rotation oder ACME-Verwaltung. Vorhandene Controller-Funktionen für Zertifikatsdateien sind davon unabhängig. Der Helfer protokolliert weder PEM-Inhalte noch fremde Fehlermeldungen oder Dateipfade; aufrufender Code soll nur die festen Fehlercodes/Meldungen ausgeben.

Die Adapterintegration behandelt ausschließlich diese geprüften TLS-Konfigurationsfehler lokal: Der Weblistener bleibt geschlossen und `info.connection` bleibt für den Webzugang falsch; die vorhandene autonome EMS-, SmartHome- und Logikinitialisierung darf trotzdem fortfahren. Andere Startfehler behalten ihren bisherigen Vertrag. Bei einem Adapterstopp wird unmittelbar nach der Zertifikatsauflösung vor dem Listener geprüft, ob der Start verworfen werden muss. Ein verspäteter Zertifikatscallback darf weder einen neuen Port öffnen noch nach dem Stopp eine weitere EMS-Initialisierung auslösen.

Davon getrennt setzt der Helfer `handshakeTimeout: 5000` für eingehende TLS-Verbindungen. Diese native TLS-Servergrenze betrifft unvollständige Client-Handshakes, nicht das Lesen der Serverzertifikate. Sie ist weder eine zusätzliche Abbruchfunktion für den Controller noch ein allgemeiner Zeitvertrag für nachfolgende HTTP-Anfragen.

## Belegte Schnittstellen und Prüfstand

Die API wurde am 22. November 2026 anhand der offiziellen Controller-Quelle v7.0.7 geprüft: Commit `607cdd973b682e59e39cf0a2714651057f3f65de`, Quellblob `630457c87b523c6039e1ef69bbf4d713f3ea98d4`. Die Signatur steht in Zeilen 2390–2395, die Auflösung der konfigurierten Namen in 2436–2440, das Lesen von `system.certificates` in 2472–2474 und die Callback-Nutzlast in 2516–2524. Commit und Blob sind unterschiedliche Git-Objekte.

- [Offizielle Controller-Quelle am geprüften Commit](https://github.com/ioBroker/ioBroker.js-controller/blob/607cdd973b682e59e39cf0a2714651057f3f65de/packages/adapter/src/lib/adapter/adapter.ts)
- [Node.js 22: TLS und Zertifikatsketten](https://nodejs.org/docs/latest-v22.x/api/tls.html)
- [Node.js 22: X509Certificate und private Schlüssel](https://nodejs.org/docs/latest-v22.x/api/crypto.html)

Der gezielte strikte TypeScript-Check lautet `node node_modules/typescript/bin/tsc -p tsconfig.ui-server-transport.json`. Er übernimmt insbesondere `strict`, `noUncheckedIndexedAccess` und `exactOptionalPropertyTypes` aus der unveränderten Basis. Der Check wurde für die Helferfassung erfolgreich ausgeführt. Echte HTTPS-Server-, Fehlerfall- und Kettenprüfungen gehören zum gesonderten Integrationsgate `scripts/verify-ui-direct-https.cjs`; sein Ergebnis wird im Freigabebericht geführt. Dieser Vertragsnachweis ersetzt keine Vor-Ort-Prüfung des tatsächlich ausgewählten Zertifikats und Endgeräts.
