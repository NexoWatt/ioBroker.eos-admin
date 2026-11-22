<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. Nutzung, Modifikation oder Verbreitung ohne ausdrückliche Erlaubnis untersagt. -->
# Laufzeit-Gegenprüfung der Sicherheitsupdates 1.0.31

Datum: 24.10.2026. Node: v24.19.0. Rein lokale Tests, keine Liveanlage,
keine ausgehende SMTP-Verbindung. Es wurde kein Feldangriff behauptet.

## HTTP: alter Prozessabsturz bestätigt

Der unveränderte 1.0.30-Stand lädt Express 4.22.3 mit body-parser 1.20.8.
Seine vier `express.json`-Deklarationen aktivieren die standardmäßige
Dekompression. Der globale 5-MiB-Parser läuft vor den Login-/Rollenprüfungen;
die Login-Ratenbegrenzung kann die frühere Parserphase nicht schützen.
Der Originfilter lässt kompatible Maschinenanfragen ohne Origin passieren.
Auf einem gültig lizenzierten und netzwerkseitig erreichbaren Host ist der
globale Parser deshalb ohne Anmeldung erreichbar. Die spezielle Lizenzroute
und zwei Mesh-Routen verwenden weitere 64-/160-KiB-Parser.

Das Advisory GHSA-27r3-jxmh-p828 beschreibt einen unkontrollierten Fehler nach
dem Ende eines Dekompressionsstreams. Der neue native Regressionstest startet
für jeden HTTP-Fall einen separaten Kindprozess mit realem Express und den
aus `main.js` gelesenen Produktoptionen. Er bindet ausschließlich 127.0.0.1
an einen vom Betriebssystem vergebenen Port. Die Laufzeit ist intern auf
3,5 Sekunden und im Elternprozess auf 4,5 Sekunden begrenzt.

Der Vergleichstest sendet einen kleinen gzip-Frame plus Nullpadding an einen
nicht vorhandenen Pfad. Erst nachdem der Server geantwortet hat, folgen
ungültige komprimierte Restbytes. Der alte Kindprozess beendet sich mit Exit 1
wegen eines unbehandelten Streamfehlers `Z_DATA_ERROR`. Es wurde kein
`uncaughtException`-Handler eingebaut, der diesen Effekt verdecken könnte.
Das ist ein bestätigter Prozessabsturz im produktgleichen Parserprofil,
kein bloßer Versions-/Scannervergleich und kein voller Anlagenprozess-Test.

In 1.0.31 werden komprimierte JSON-Requests zusätzlich nativ durch
`inflate:false` abgewiesen. Alle vier tatsächlichen Parserdeklarationen werden
im Test erfasst. Pro Parser wurden geprüft:

- gültiges unkomprimiertes JSON: HTTP 200;
- defektes JSON: statischer Fehler mit HTTP 400;
- Überschreitung des jeweiligen vorhandenen Byte-Limits: HTTP 413;
- gzip und deflate: HTTP 415;
- gzip und deflate mit nachlaufenden Fehlerbytes: HTTP 415;
- nach jedem dieser sieben Fälle: weitere Health-Anfrage HTTP 200.

Ergebnis: **28 HTTP-Fälle bestanden**, keine Prozessbeendigung. Die Antworten
wurden zusätzlich auf den privaten Testmarker und typische interne
Parser-/Stackdetails geprüft. Getestet werden die tatsächlichen Parseroptionen
und der produktive `safeHttpFailure`-Helfer in einem kleinen HTTP-Harness,
nicht die komplette `startServer()`-Routine oder eine reale Kundenanlage.

## Nodemailer: Parserfix und bestehende Empfängergrenze

Die drei Hersteller-Advisories GHSA-8c8m-p3m8-cjg8,
GHSA-m943-m63m-w62w und GHSA-85x2-q946-cp5h betreffen die Adressauswertung.
Die direkte Auswertung ihrer Formen durch Nodemailer 10.0.10 liefert jeweils
eine andere als die beabsichtigte Adresse. Mit 10.1.4 werden in allen drei
Fällen genau die vorgesehene Adresse beziehungsweise deren Domain erkannt.

Der produktive `validAddress`-Helfer akzeptiert Einzeladressen und verwirft
diese drei komplexen Formen bereits vor dem Transport. Dies wurde gesondert
geprüft. Deshalb ist durch diese Beispiele keine Empfängerfehlleitung in
NexoWatt belegt; die gelockte Bibliothek war trotzdem betroffen.

Der normale `NotificationMail.send`-Pfad wurde mit einem ausschließlich
speicherinternen Nodemailer-Streamtransport geprüft. Nodemailer erzeugt dabei
echten MIME-Inhalt und einen Envelope, öffnet aber keine SMTP-Verbindung.
Ergebnis: genau ein erwarteter Empfänger, vorgesehener Absender, bereinigter
Betreff, Dateizugriffe und URL-Zugriffe deaktiviert. Die produktiven Optionen
fordern weiterhin TLS und die Zertifikatsprüfung an. Ungültige Adressen führen
zu keiner Transporterstellung. Das belegt die lokale Versandvorbereitung,
nicht die Zustellung an einen tatsächlichen Mailserver.

## Reproduktion und Nachweise

Aktueller Test:
`node scripts/verify-runtime-security-updates.cjs`

Isolierter Vergleich mit vorhandener alter Installation:
`node scripts/verify-runtime-security-updates.cjs --observe-baseline /absoluter/Pfad/NexoWatt_UI_1.0.30`

Die Baseline-Option ist ausdrücklich nicht Bestandteil des normalen
Releaseprüflaufs. Sie beobachtet den alten Prozessausfall im Kindprozess und
liefert dessen Befund an den weiterlaufenden Elternprozess.

`runtime-security-observations.json` hält die tatsächlich beobachteten
Ergebnisse der ersten Ausführung fest; dies ist eine strukturierte Übertragung
der Werkzeugausgabe, kein nachträglich behaupteter neuer Testlauf.
Der integrierte Releaseprüflauf erfasst den aktuellen vollständigen Teststdout.

Offizielle Primärquellen:

- https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828
- https://github.com/expressjs/body-parser/releases/tag/1.20.9
- https://github.com/nodemailer/nodemailer/security/advisories/GHSA-8c8m-p3m8-cjg8
- https://github.com/nodemailer/nodemailer/security/advisories/GHSA-m943-m63m-w62w
- https://github.com/nodemailer/nodemailer/security/advisories/GHSA-85x2-q946-cp5h

Keine vollständige ASVS-Erfüllung, Zertifizierung, Fehlerfreiheit oder
Produktivfreigabe wird aus diesen begrenzten Prüfungen abgeleitet.
