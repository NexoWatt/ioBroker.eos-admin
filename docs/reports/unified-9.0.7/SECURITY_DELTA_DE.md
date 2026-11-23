# Sicherheitsänderungen 9.0.7

Stand 23.11.2026. Ergänzung der bestehenden EOS-Bedrohungsanalyse für die in dieser
Lieferung geänderten Vertrauensgrenzen. Keine Zertifizierung oder pauschale CRA-Freigabe.

| Grenze / Risiko | Technische Maßnahme | Nachweis / offene Grenze |
| --- | --- | --- |
| Browser schreibt Modulkonfiguration; Sitzungsverlust durch Neustart | Aktuelle Adminrolle, Origin und CSRF; verschlüsseltes Konfigurationsobjekt mit Revision und restriktiver ACL; kein eigenes Instanzobjekt ändern | Session-/ConfigStore-/HTTP-Tests; tatsächlicher Controllerlauf separat |
| Übernahme erzeugt zwei Gerätewriter | Gemeinsame Vorprüfung, bestätigter Altstopp, verschlüsseltes Journal, exklusive Freigabe; bei unklarem Ausgang gesperrt | Migrations-, Namespace- und Ownership-Tests; physische Gegenstellen separat |
| Geschützte alte Geheimnisse fehlen | Öffentliche Controller-API respektieren; gesamte Übernahme vor Abschaltung blockieren | Test mit modellierter protectedNative-Filterung; Controllerquelle zusätzlich gelesen |
| TLS-Aussteller wird verwechselt | Geräte-CSR, privater Geräteschlüssel, vollständige Ketten-/SAN-/EKU-Prüfung und unabhängig bestätigter CA-Fingerabdruck | Echte OpenSSL-/HTTPS-Tests; Client-Stammvertrauen separat einrichten |
| Hersteller-CA-Schlüssel gelangt zum Kunden | Getrenntes Offline-Ausstellerwerkzeug, verschlüsselter CA-Schlüssel; keinerlei CA-Privatschlüssel im Adapter | Aussteller- und Secret-Scan; betriebliche CA-Verwaltung bleibt Herstelleraufgabe |
| Manipulierte Sicherung oder offengelegte Geräteidentität | AES-256-GCM, getrennt gesicherter Wiederherstellungsschlüssel, private Arbeitsverzeichnisse, Prüfung vor Freigabe der Klartextdatei | Datei-/Worker-/Wiederherstellungstests; Festplatten- und OS-Benutzerschutz gesondert |
| Backup blockiert EMS oder bleibt nach Stop aktiv | Bedarfsgesteuerter Worker, Zeit-/Größen-/Parallelitätsgrenzen, Prozessgruppen-Cleanup; keine Shellbefehle aus Browserdaten | Worker-/Lifecycle-Tests; reale CPU-/IO-Last unter Kundenbetrieb messen |
| Lokales oder externes Speicherziel liefert fremde Pfade/Daten | Pfad-/Protokollprüfung, TLS, begrenzte Streams, kontrollierte Provider-APIs; kein ausführbarer Restore im laufenden EMS | Protokoll-/Dateifixtures; reale Cloudkonten und NAS noch abzunehmen |
| UI-Caches halten Daten unbegrenzt | Zeitbegrenzte Referenzen, gebündelter Objektabruf, Stop-Fencing | Cache-/Historytests und synthetischer Heapvergleich |
| Lizenzfeature über Prototypnamen | Nur eigene explizit wahre Editionseinträge gelten | Reale UI-Laufzeit-Regression einschließlich constructor/__proto__ |

## Liefer- und Betriebsnachweise

Version, Quell-/Buildbestand, Fremdlizenzen, Runtime-SBOM und Hashmanifest gehören
zusammen. Das Hashmanifest erkennt geänderte Dateien, ersetzt aber keine digitale
Herstellersignatur. Publikation ist vom lokalen Erstellen und Prüfen getrennt.

Die zusätzliche Teamdurchsicht ist eine interne technische Zweitprüfung. Sie
ersetzt keinen externen Penetrationstest. Scannerbefunde des historischen UI-
Bestands bleiben inventarisiert; kein pauschaler Nullbefund wird daraus abgeleitet.

Der aktuelle Stand hat weiterhin keine universelle Hardware-Freigabe, kein
beliebiges Nachrichten-Routing für alle alten Adapternamen, keine universelle
Cloud-/NAS-Zusage und keine automatisierte PKI-Sperrlistenverteilung. Unterstützte
Migrationen müssen ihre Vorprüfung vollständig bestehen. Nicht kompatible
Altkonfigurationen werden erhalten, statt stillschweigend abgeändert.

Für eine CRA-Bewertung gehören zusätzlich Produktabgrenzung, dokumentierte
Risikoentscheidung, Support-/Schwachstellenprozess, technische Unterlagen und
Anlagen-/Wiederherstellungsabnahme zum Herstellerprozess. Dieser Softwarebericht
ist lediglich ein Teilnachweis dafür.
