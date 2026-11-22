# Prüfplan und Inbetriebnahme

**NexoWatt EOS · 9.0.2 · EOS-MERGE-001**

Dieser Plan nennt Sollwerte und Abläufe, keine vorweggenommenen Testergebnisse.
Softwarebefunde und Rohbelege für 9.0.2 gehören in den neuen Abschlussbericht;
Ergebnisse früherer Alpha-Versionen werden nicht umetikettiert. Zielsystem-/Gerätetests
sind offen, solange sie nicht mit konkreter Umgebung dokumentiert wurden.

## Vorbereitungen

Version/Hash des Pakets, Hardware, OS, Node, Controller, Geräte-/Adapterversionen,
öffentliche Origin, Netzplan sowie vorhandene Konfiguration erfassen. Persönliche
Daten und Geheimnisse nicht in Testprotokolle übernehmen. Sicherung und Schlüssel
auf Wiederherstellbarkeit prüfen. Vor Störtests Geräte in einen betrieblich geeigneten
Testzustand bringen; unabhängige Schutzfunktionen und Anlagenlimits bleiben wirksam.

Alte UI-/Admin-Probleme getrennt dokumentieren. Erwartete Ladebetriebsarten, M0-/M1-
Messpunkte, Speichergrenzen und Bedienwerte vor der Umstellung festhalten. Die erste
Prüfung mit begrenztem Anlagenumfang und beobachtbaren Stellbefehlen durchführen.

## Software- und Integrationsprüfungen

| ID | Ablauf / negativer Fall | Soll |
| --- | --- | --- |
| EOS-MERGE-P01 | Frisch entpacktes Repository und npm-Paket prüfen | Versionen/Hashes konsistent; erwartete Runtime vorhanden; keine private Konfiguration oder Signiergeheimnisse. |
| EOS-MERGE-P02 | Adapter installieren, starten, stoppen und neu starten | Eine Controllerinstanz; keine offenen Listener/Timer nach Stop; keine Doppelzyklen. |
| EOS-MERGE-P03 | Ohne Login Dashboard, Installer, System, API und Socket aufrufen | Keine geschützten Daten/Funktionen; sichtbarer zentraler Login, APIs liefern passende Fehler. |
| EOS-MERGE-P04 | Erstlogin, Erstpasswortwechsel, falsches Passwort, gesperrtes Konto; gesetztes TOTP/fehlerhaftes externalAuthentication | Erstpasswortwechsel funktioniert. TOTP-/fehlerhafte externe Auth-Konfiguration sperrt Zugang und bestehende Sitzungen; keine Passwort-only-Umgehung. Kein positiver TOTP-Challenge-/Passkey-Test, da nicht implementiert. |
| EOS-MERGE-P05 | Admin ohne Lizenz, gültige NWL3-Lizenz, Ab-/Anmeldung und Neustart | Einmalige zentrale Aktivierung; gültiger Bestand bleibt erhalten; keine zweite UI-Lizenz. |
| EOS-MERGE-P06 | Signatur/UUID/kid/Payload manipulieren, Größenlimit überschreiten | Ablehnung ohne Freigabe, Absturz oder Geheimnisleck; gültiger Bestand nicht beschädigt. |
| EOS-MERGE-P07 | NWL2-Kompatibilität, falsche Adapterliste, unbekannte Features | Nur vertraglich erlaubte Freigaben/Mengen; kein Format- oder Rechtefallback. |
| EOS-MERGE-P08 | Benutzer/Installer/Admin, direkte API-/Socketbefehle | Server prüft jeweilige Funktion und Objekt-ACL; Navigation bildet Rechte ab. |
| EOS-MERGE-P09 | Zwei Nutzer parallel, einer meldet sich zentral ab; außerdem Gruppenentzug/Passwortänderung mit offener PWA/SSE/Socket | Der Logout dieses Teststands widerruft die globale Sitzungsgeneration: beide Nutzer müssen sich neu anmelden, offene Verbindungen verlieren ihre Rechte. Kein isolierter Einzelsitzungslogout behaupten. |
| EOS-MERGE-P10 | Direkter HTTPS-Zugang auf 8188; fremde Origin/Host/Forwarding-Header und CSRF | TLS und Authentisierung aktiv, gültiges Zertifikat/Vertrauen; kein Origin-/Identitätsbypass und kein HTTP-Login-Fallback. |
| EOS-MERGE-P11 | Deep Links/Reload in Installer/System, Downloads, Adapterkonfiguration | Keine Pfad-/Routingregression, kein HTML-200-Fallback auf API-Fehler. |
| EOS-MERGE-P12 | PWA-Offlinecache und Update mit alter PWA | Kein gecachter Auth-/Lizenz-/Admininhalt, keine alte Sitzung; nötige Assets laden. |
| EOS-MERGE-P13 | TLS-Fehler auf 8188; optionaler 443-Proxy mit falscher Upstream-CA oder falschem Zertifikatsnamen; Port belegt, Disconnect, große Requests | Verständliche Diagnose, begrenzte Ressourcen, kein ungeschützter Ersatz und kein Abschalten der CA-/Namensprüfung. |
| EOS-MERGE-P14 | Migration abbrechen, alter Regler noch aktiv, Neustart während Übergabe | Keine parallelen Stellbefehle; konsistenter Zustand und kontrollierte Wiederaufnahme. |
| EOS-ACCESS-P01 | Vorhandenes `admin.0` mit eigenen Einstellungen; EOS-Start, Wiederholung und gespeicherte Legacy-Sperrflags | Bestehender Zugang, `enabled`, Port und Bindung bleiben durch den entfernten Legacy-Sperrpfad unverändert. |
| EOS-ACCESS-P02 | Frische Instanz vs. vorhandene Instanzkonfiguration; direkte und optionale Proxyzugänge | Neue Defaults: `0.0.0.0:8188`, TLS/Auth aktiv, `defaultPublic`/`defaultPrivate`; externe Origin bleibt für parallele IP-/Namenszugänge auch mit HTTPS-Proxy leer. Gespeicherte Altwerte ausdrücklich prüfen. |
| EOS-ACCESS-P03 | Lokaler Name `NexoWattEOS` fehlt oder zeigt auf falsche IP; Zertifikat ohne passenden SAN | Kein angeblich automatischer DNS-Erfolg; Name/IP und Zertifikat werden passend eingerichtet. |
| EOS-ACCESS-P04 | Nicht provisioniertes/fehlendes Kontopasswort | Sicherer Fehler, kein Standardpasswort-/Login-Bypass. Berechtigte interaktive Passwortsetzung gesondert nachweisen. |

Automatisierte Tests können Teile dieser Fälle mit Mocks abdecken. Im Protokoll
kenntlich machen, ob reale HTTP-Verbindungen, Controllerkomponenten oder nur isolierte
Funktionen verwendet wurden. Ein Mock beweist keine Gerätewirkung.

## Anlagenfunktion und Fehlerfälle

| ID | Zu prüfen | Abnahmekriterium |
| --- | --- | --- |
| EOS-MERGE-H01 | Dashboard/Verlauf/Livewerte und Datenpunktmapping | Einheiten, Vorzeichen, Messalter und Zuordnung wie im dokumentierten Soll; keine gültige Null aus fehlenden Werten. |
| EOS-MERGE-H02 | Laden: Auto, PV und alle vorher genutzten Modi | Richtiger Modus auch nachts/über Zeitwechsel; Start/Stop und Wiederanlauf ohne unbeabsichtigt nötiges Abziehen. |
| EOS-MERGE-H03 | Speicher, statischer/dynamischer NVP, M0/M1 | Grenzen und Prioritäten bleiben wirksam; keine Gegenregelung oder unerwünschte gegenseitige Beladung. |
| EOS-MERGE-H04 | PV-/Null-/Volleinspeisung und Verbraucher | Richtiger Messpunkt, korrekter Energiefluss, unveränderte Grenz-/Rampenlogik. |
| EOS-MERGE-H05 | Geräte offline, Timeouts, veraltete/ungültige Messungen, Wiederverbindung | Je Gerät festgelegter Fallback, erkennbare Diagnose, keine Wiederholung überholter Befehle. |
| EOS-MERGE-H06 | Wetter-/Tarifausfall, fehlende Zeitreihe, Uhrzeitsprung | Lokale Schutzlogik bleibt wirksam; Daten werden nicht als frisch erfunden; kontrollierte Wiederaufnahme. |
| EOS-MERGE-H07 | Parallel offene Oberflächen, Verwaltung, Logs/Downloads und Regelung | CPU/RAM/Event-Loop und Befehlslatenzen messen; 50-/100-ms-Ziele samt Überschreitungen erfassen. |
| EOS-MERGE-H08 | Adapter-/Controllerneustart, Strom-/Datenträgerfehler im geeigneten Testaufbau | Kein gefährlicher Startimpuls; nachgewiesene Geräteausfallreaktion, konsistente Konfiguration. |
| EOS-MERGE-H09 | Betrieb mit regulärem Dienstkonto | Keine Rootabhängigkeit; benötigte Datei-/Port-/Geräterechte reichen aus. |

Keine harten Echtzeitzusagen allein aus Mittelwerten ableiten. Messdauer, Häufigkeit,
Perzentile/Maximum, Lastprofil, Geräteantworten und Messpunkt der Zeitkette festhalten.
Die gemeinsame Prozessarchitektur ist dabei besonders zu berücksichtigen.

## Rückfall und Wiederherstellung

1. Die neue integrierte Regelung kontrolliert stoppen, automatischen Neustart verhindern
   und ausbleibende Stellbefehle bestätigen.
2. Den gesicherten vorherigen Paket-/Konfigurationsstand über den vorgesehenen Recovery-
   Weg wiederherstellen. Vorher Datenmodell- und Sicherheitskompatibilität des Rückfalls prüfen.
3. Genau eine frühere UI-Regelinstanz freigeben; neue und alte Regelung niemals parallel starten.
4. Messwerte, Lizenzerkennung, Rechte, Geräteverbindungen und zuletzt gültige Betriebsarten
   neu abgleichen. Alte ausstehende Befehle nicht ungeprüft wiederholen.
5. Ursache und Ergebnis ohne Geheimnisse dokumentieren. Ein fehlgeschlagener Restore
   verhindert die Freigabe der betreffenden Migration.

## Kompaktes Protokoll

| Feld | Eintrag |
| --- | --- |
| Test-ID / Zeitpunkt | Auszufüllen |
| Paketversion / SHA-256 | Auszufüllen |
| Hardware, OS, Node, Controller und Geräte | Auszufüllen |
| Voraussetzungen / Rolle / Lizenzformat | Ohne Passwörter oder vollständigen Lizenzcode |
| Soll / Ist / Messwerte | Konkrete Beobachtung |
| Ergebnis | Bestanden / fehlgeschlagen / nicht ausgeführt / blockiert / nicht anwendbar |
| Beleg / Befund / nächste Maßnahme | Bereinigter Logpfad und zuständige Person |

Eine erfolgreiche Hausanlagenprüfung gilt nur für den dokumentierten Umfang.
Allgemeine Produktionsfreigabe und CRA-Konformitätsbewertung bleiben eigene
Herstellerentscheidungen auf Grundlage ausreichender Nachweise.

## Zusätzliche Lizenz-Wiederherstellungsabnahme 9.0.2

| ID | Ablauf | Soll |
| --- | --- | --- |
| EOS-LIC-P01 | Hersteller-JSON nach Erstlogin importieren; gleiche Datei erneut importieren | Nur autorisierter öffentlicher Schlüssel, gleiche ID/Fingerprint, idempotente Wirkung. |
| EOS-LIC-P02 | Unbekannter/privater Schlüssel, falsche Origin, Benutzerrolle, fehlender CSRF | Sichere Ablehnung ohne Veränderung gültiger Lizenz-/Trustdaten. |
| EOS-LIC-P03 | NWL3 aus Keygen 1.0.4 aktivieren und Gerät neu starten | UUID-/Signaturprüfung bestanden; eine gespeicherte zentrale Freigabe für System und UI. |
| EOS-LIC-P04 | Zielsystem mit tatsächlichen ioBroker-Gruppen-ACLs prüfen | Runtime kompatibel, privater Lizenzordner 0700, Dateien 0600, keine unbeabsichtigten geerbten Rechte. |
| EOS-LIC-P05 | Browser-Reiter, Dateiimport/-export, ungültiger Bestand und erneute Prüfung | Verständliche Fehler oben sichtbar; keine veraltete Freigabe, keine private Tresordatei im Export. |
