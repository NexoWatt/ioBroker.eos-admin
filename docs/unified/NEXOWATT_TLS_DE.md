# NexoWatt-Zertifikate für lokale EOS-Geräte

Stand: 25.11.2026, EOS 9.0.26. Die Zertifikatsverwaltung befindet sich unter **Administration → Zertifikate** beziehungsweise `/security/tls/`.

Die neue Verwaltung stellt einen geschützten lokalen Ausstellungsablauf bereit. Sie liefert keine bereits eingerichtete Hersteller-Zertifizierungsstelle und enthält keine produktiven privaten Schlüssel. Die bestehende HTTPS-Konfiguration bleibt bis zur ausdrücklichen Übernahme eines signierten Gerätezertifikats wirksam. ioBroker Admin auf Port 8081 wird nicht verändert.

## Was auf welchem Rechner liegt

| Bestandteil | Ablage | Weitergabe |
| --- | --- | --- |
| Privater NexoWatt-CA-Schlüssel | Getrennter, geschützter Herstellerrechner; verschlüsselt | Niemals an Kunden oder Adapter |
| Öffentliches CA-Stammzertifikat | Hersteller, EOS und freigegebene Endgeräte | Zur Einrichtung des Vertrauens vorgesehen |
| Privater Geräteschlüssel | Instanz-Datenverzeichnis des jeweiligen EOS, `tls/`, Modus 0600 | Keine Web-Downloadfunktion; nur verschlüsseltes Gerätebackup |
| Zertifikatsanfrage (CSR) | EOS erzeugt sie aus seinem eigenen Schlüssel | An die Hersteller-Zertifizierungsstelle |
| Signiertes Gerätezertifikat | EOS | Öffentlich; an den privaten Geräteschlüssel gebunden |

Jedes EOS erhält einen eigenen ECDSA-P-256-Geräteschlüssel. Es gibt keinen gemeinsamen TLS-Schlüssel aller Kundengeräte. Die Lizenz-Signierschlüssel und TLS-Schlüssel bleiben getrennt. Eine Lizenz wird durch diese Funktion weder ersetzt noch erneut verlangt.

## Einmalige Hersteller-Einrichtung

Das Werkzeug `tools/eos-tls-issuer.cjs` wird auf dem **Herstellerrechner**, nicht auf einem Kunden-EOS, ausgeführt. Es benötigt eine gepflegte Node.js-Version und OpenSSL 3.x. Die Befehle laufen ohne Administrator-/Rootrechte. Vorhandene Herstellerordner werden nicht überschrieben.

```text
node tools/eos-tls-issuer.cjs init --directory /sicherer/pfad/nexowatt-ca
```

OpenSSL fragt die Passphrase im Terminal ab; bei der anschließenden Ausstellung des Stammzertifikats muss sie erneut eingegeben werden. Das Werkzeug erzeugt `issuer-private.pem` verschlüsselt mit AES-256 und ein zehn Jahre gültiges `root.pem` mit dem Aussteller **NexoWatt EOS Local Root CA**, Organisation **NexoWatt**. Die CA darf ausschließlich Endgerätezertifikate signieren (`pathlen:0`). Der SHA-256-Fingerabdruck wird angezeigt. Er wird unabhängig von der EOS-Webseite an den Kunden beziehungsweise Installateur übergeben.

CA-Ordner und Passphrase getrennt sichern; Sicherung und Wiederherstellung erproben. Nicht auf einem freigegebenen Laufwerk, im Repository, in einer Kundenbackup-Datei oder in einer ungeschützten Cloudablage speichern. Bei Verlust der Passphrase oder des CA-Schlüssels kann dieser Herstellerstand keine weiteren passenden Zertifikate ausstellen. Die bestehenden Zertifikate bleiben bis zum Ablauf gültig; eine neue CA erfordert eine geplante Vertrauensumstellung auf den Endgeräten.

**Windows-Herstellerrechner:** In PowerShell funktioniert das gleiche Werkzeug, wenn eine gepflegte, vertrauenswürdig installierte `openssl.exe` über den eigenen PATH verfügbar ist; mit `Get-Command openssl.exe` vorher den erwarteten Installationspfad prüfen. Einen geschützten Benutzerordner verwenden, auf den andere Benutzer keinen Zugriff haben; NTFS-Zugriffsrechte und Datenträgerverschlüsselung sind erforderlich. POSIX-Modusprüfungen stehen unter Windows nicht zur Verfügung. Alternativ in einer bereits eingerichteten WSL-Umgebung ausführen; den CA-Ordner im Linux-Benutzerverzeichnis speichern und dort Modus 0700/0600 verwenden. Windows und echte Hersteller-Hardware sind in diesem Lieferstand nicht praktisch geprüft.

Für eine kontrollierte automatisierte Herstellerumgebung gibt es `--passphrase-file /geschuetzter/pfad`. Die Datei benötigt genau eine Zeile mit mindestens 16 Zeichen, unter POSIX Modus 0600 und den ausführenden Benutzer als Eigentümer. Sie gehört nicht zusammen mit dem CA-Schlüssel in dieselbe Sicherung. Passphrasen sind keine Kommandozeilenargumente oder Protokollinhalte. Die automatisierten Tests verwenden ausschließlich kurzlebige, synthetische Testschlüssel und entfernen diese danach.

## Ein Gerät ausstellen

1. Als EOS-Administrator `/security/tls/` öffnen. Namen prüfen: normalerweise `nexowatt` und `nexowatt.local`, zusätzlich jede für den Browserzugriff vorgesehene feste IP-Adresse. Alle Einträge sind Subject Alternative Names (SAN). Eine andere IP nach DHCP-Wechsel erfordert bei IP-Zugriff ein erneuertes Zertifikat. Bei stabilem Namen kann das bestehende Zertifikat weiterpassen.
2. **Anfrage erstellen** und die öffentliche CSR herunterladen. Ein vorhandener unbenutzter Antrag bleibt bestehen, solange er nicht ausdrücklich ersetzt wird. Das Ersetzen erzeugt einen neuen Geräteschlüssel; eine Antwort auf den alten Antrag wird anschließend nicht mehr akzeptiert.
3. Die CSR auf dem Herstellerrechner prüfen und für die ausdrücklich freigegebenen Namen signieren:

```text
node tools/eos-tls-issuer.cjs issue --directory /sicherer/pfad/nexowatt-ca --request NexoWatt-EOS-request.pem --names nexowatt,nexowatt.local,192.168.10.153 --output /sicherer/pfad/ausstellung-geraet-001
```

   Der Ausgabeordner muss neu sein. Unter Windows entsprechende eigene Pfade verwenden. Das Werkzeug prüft die CSR-Signatur und das P-256-Geräteprofil. Es kopiert keine unkontrollierten CSR-Erweiterungen: Namen werden explizit vorgegeben, CA-Funktion verboten und HTTPS-Servernutzung festgelegt. Die Laufzeit beträgt 397 Tage. Ausgabe: `certificate.pem` und `root.pem`.
4. Beide öffentlichen PEM-Dateien im EOS hochladen und den unabhängig bestätigten Fingerabdruck der Stamm-CA eintragen. Der Adapter prüft Geräteschlüssel, alle angeforderten SAN, Zeitgültigkeit einschließlich CA-Kette, explizites Server-EKU, CA-Eigenschaften, Signaturen und Schlüssellängen. Fehlende oder falsche Daten ersetzen das vorhandene Zertifikat nicht.
5. Die **erste** Umstellung vom vorhandenen ioBroker-Zertifikat wird beim nächsten regulären Adapterneustart wirksam. Die Webseite startet keinen Adapter oder Regler automatisch neu. Wartungszeit und den normalen Neustart mit der Anlage abstimmen. Der Status unterscheidet „gespeichert; Neustart erforderlich“ und „aktiv“.
6. Bei späteren Erneuerungen eines bereits verwalteten EOS-Zertifikats werden der HTTPS-Standardkontext für IP-Zugriffe und der SNI-Kontext für Namen gemeinsam ohne Neustart übernommen. Bestehende TLS-Verbindungen bleiben bestehen; neue Verbindungen erhalten das neue Zertifikat. Das Zertifikat wird nach EOS-Neustarts wieder geladen.

## Einmaliges Vertrauen auf Endgeräten

Ein privat ausgestelltes Zertifikat wird durch seinen Namen allein nicht automatisch vertrauenswürdig. Das Stammzertifikat muss kontrolliert auf den Endgeräten installiert werden. Ab 9.0.26 führt bereits die Anmeldeseite über **HTTPS auf diesem Gerät einrichten** auf `/security/trust/`. Dort stehen das bereits geprüfte öffentliche Stammzertifikat und dessen SHA-256-Fingerabdruck ohne Anmeldung bereit. Der direkte Download `/security/trust/root.cer` enthält ausschließlich dieses öffentliche DER-Zertifikat. Die Zertifikatsverwaltung, CSR und sämtliche Schreibaktionen bleiben administratorgeschützt; kein CA- oder Geräteschlüssel wird exportiert.

Wenn noch kein NexoWatt-Zertifikat übernommen wurde, zeigt die Hilfeseite einen Einrichtungshinweis statt des Downloadbuttons. Ein vorhandenes ioBroker-Standardzertifikat wird nicht ungeprüft als vertrauenswürdige Stamm-CA angeboten. Die Einrichtung erzeugt keine neue CA, signiert keine Anfrage und verändert keine HTTPS-Identität. Die Seite und der öffentliche Download funktionieren auch bei gestopptem UI-/EMS-Prozess.

- **Windows / Edge / Chrome:** Das öffentliche Stammzertifikat in den vorgesehenen Speicher „Vertrauenswürdige Stammzertifizierungsstellen“ importieren; in verwalteten Umgebungen über die IT-Verwaltung verteilen. Den korrekten Benutzer-/Computerspeicher wählen.
- **iPhone / iPad:** Nach der Zertifikatsinstallation zusätzlich unter Einstellungen → Allgemein → Info → Zertifikatsvertrauenseinstellungen das volle Vertrauen für das geprüfte Stammzertifikat aktivieren. Apple Configurator beziehungsweise MDM kann die geregelte Verteilung übernehmen.
- **macOS / Android / Firefox:** Den jeweiligen System- oder Browser-Zertifikatsspeicher verwenden. Einzelne Apps können eigene Vertrauensregeln besitzen und privat installierte CAs ablehnen. Nicht alle Anwendungen sind dadurch automatisch freigegeben.

Die Vertrauenseinrichtung ist ein sicherheitsrelevanter Administrationsschritt: Eine vertraute CA kann weitere Zertifikate ausstellen. Fingerabdruck deshalb über einen unabhängig bestätigten Weg vergleichen; das bloße Herunterladen von einer zunächst noch ungeprüften Webseite reicht nicht als Herkunftsnachweis. Hersteller-CA und Gerätezertifikate nach den Kundenrichtlinien inventarisieren und bei Kompromittierung ersetzen beziehungsweise Vertrauen entziehen.

`https://nexowatt` benötigt zusätzlich passende Namensauflösung und Port 443. Das Zertifikat richtet weder DNS noch Portweiterleitung ein. mDNS unterstützt im lokalen Netz `nexowatt.local`; Browserzugriff über die bloße IP benötigt ebenfalls deren SAN. Die vorhandene Einrichtung in `deploy/NEXOWATT_LOCAL_HTTPS.md` gilt weiter. Weder Zertifikatsimport noch Download deaktivieren Browserprüfungen oder wechseln auf unverschlüsseltes HTTP.

### Web-App-Symbol auf iPhone und iPad

EOS liefert das vorhandene NexoWatt-PNG über die explizite `apple-touch-icon`-Verknüpfung und die konventionellen Apple-Rootpfade aus. Diese festen öffentlichen Bilder liegen ab 9.0.26 im Administrationsprozess und benötigen weder eine Sitzung noch einen laufenden UI-/EMS-Prozess. Wiederholte Bildanfragen können mit ETag und HTTP 304 beantwortet werden; Anmelde- und Einrichtungsseiten bleiben `no-store`.

Die vom Benutzer gemeldete Zertifikatswarnung muss auf dem Endgerät separat beseitigt werden. Eine Bestätigung der Browserwarnung ersetzt weder die Installation und ausdrückliche Vertrauensfreigabe der geprüften CA noch einen passenden SAN. Bei lokalem IP-Zugriff und einer anderen VPN-IP muss das Zertifikat beide tatsächlich verwendeten Adressen enthalten. Ein Serverupdate allein kann das Vertrauen auf dem iPhone nicht einschalten.

Nach korrekter Zertifikatseinrichtung die warnungsfreie EOS-Seite in Safari öffnen und **Teilen → Zum Home-Bildschirm** wählen. In der Vorschau das NexoWatt-Symbol prüfen; eine alte Verknüpfung mit „N“ gegebenenfalls entfernen und erneut anlegen. Der Screenshot mit dem Monogramm belegt einen Symbol-Fallback, aber ohne Prüfung des iPhones nicht dessen vollständige Ursache. Die automatisierten Prüfungen decken die Bild- und Zertifikatsauslieferung ab, nicht die tatsächliche iOS-Installation.

## Betrieb, Erneuerung und Wiederherstellung

- Die Verwaltung zeigt Fingerabdrücke, Namen, Laufzeit, offene Anfrage und eine Warnung ab 30 Tagen vor Ablauf. Es gibt noch keine automatische CA-Signierung oder automatische CA-Erneuerung. Die Verantwortung für rechtzeitige Ausstellung und Kunden-Endgeräte liegt bei NexoWatt beziehungsweise der vereinbarten Administration.
- Betrieb setzt `/usr/bin/openssl` voraus. Fehlt OpenSSL oder scheitert die Prüfung, wird kein ungeprüftes Zertifikat übernommen. Fehlerhafte private Ablagen werden als nicht verfügbar angezeigt; ein vorhandener gültiger ioBroker-HTTPS-Zugang bleibt als Ausgangskonfiguration erhalten. TLS 1.2 ist die Untergrenze; keine unverschlüsselte Ersatzfreigabe.
- `tls/active.json` und `tls/pending.json` sind geheime Geräteunterlagen. Nur in verschlüsselte, zugriffsgeschützte Backups aufnehmen. Bei Wiederherstellung derselben Anlage Identität und Zugriff prüfen; eine Sicherung mit identischem Geräteschlüssel nicht parallel auf mehreren aktiven Kundengeräten betreiben. Bei Geräteersatz kann stattdessen eine neue CSR ausgestellt werden. Der Hersteller-CA-Schlüssel bleibt außerhalb jedes Gerätebackups.
- Atomare Speicherung erhält bei fehlgeschlagener Aktivierung den vorherigen Stand. Eine nach Stromausfall übrig gebliebene, bereits verbrauchte Anfrage wird beim Laden verworfen. Der Adapter nimmt keine beliebigen privaten Schlüssel oder ausführbaren Dateien über die Weboberfläche an.
- Der aktuelle Lieferstand enthält keine automatisierte OCSP-/CRL-Verteilung. Ein kompromittiertes Gerät muss zusätzlich über Zugangs-/Netzsperren und Austausch seiner Identität behandelt werden. Diese Begrenzung ist bei Kundenbetrieb und CA-Laufzeitplanung zu berücksichtigen.

## Primärquellen

Am 23.11.2026 zur Umsetzung geprüft: [OpenSSL-Verifikationsoptionen 3.5](https://docs.openssl.org/3.5/man1/openssl-verification-options/), [OpenSSL-Zertifikatserweiterungen](https://docs.openssl.org/3.5/man5/x509v3_config/), [Node.js TLS](https://nodejs.org/api/tls.html), [Apple: manuell installierte Zertifikate vertrauen](https://support.apple.com/en-us/102390), [Microsoft: Stammzertifikatspeicher](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/trusted-root-certification-authorities-certificate-store). Diese Quellen beschreiben die technischen Grundlagen; sie ersetzen keine Prüfung des jeweiligen Kundengeräts.
