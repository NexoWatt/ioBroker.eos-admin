# EEBus in NexoWatt EOS 9.0.7

Der vorhandene SHIP/SPINE-Kern aus NexoWatt EEBus 0.3.0 bleibt als internes Modul unter einer zentralen EOS-Systemlizenz enthalten. Protokollumfang und Feldtestgrenzen aus `docs/INTEGRATION_9_0_6_DE.md` gelten weiter; der dort beschriebene manuelle Import ist von der neuen automatischen Bestandsübernahme zu unterscheiden.

Bei automatischer Übernahme bleiben die bisherigen `eebus.N.*`-IDs bestehen. Die private Bridge koppelt das Modul weiterhin an genau den zuständigen EOS-Prozess, auch wenn dessen UI den bisherigen `nexowatt-ui.N.*`-Namespace beibehält. Es entsteht kein zweiter ioBroker-Adapterprozess.

Die automatische Übernahme verlangt eine eindeutige Instanz 0.3.0 auf demselben Host, lesbare geschützte Konfiguration, eine gültige und passende SHIP-Zertifikat-/Schlüsselpaarung sowie bereits ausdrücklich festgelegte SHA-256-Pins aller vertrauten Gegenstellen. Ein durch mDNS oder frühere ungesicherte Discovery gemeldeter Fingerabdruck wird nicht nachträglich als Pin ausgegeben. Fehlen solche Nachweise, bleiben die Altadapter unverändert aktiv; EOS zeigt die blockierte Vorprüfung unter `/migration/`. Insbesondere kann der ioBroker-Controller `protectedNative` für fremde Adapter ausblenden. Diese Zugriffsgrenze wird nicht umgangen.

Eine übernehmbare private Geräteidentität wird erst nach bestätigtem Stillstand des alten Prozesses in eine Datei mit Modus 0600 übernommen. Bestehende abweichende Identitäten werden nicht überschrieben. SHIP-ID, SKI, Zertifikat, PIN, Port, Polling und aktive/dry-run Steuerkonfiguration werden bei erfolgreicher Übernahme erhalten. Native Vertrauensumgehungen oder unbekannte aktive Einstellungen sperren den Wechsel.

Der manuelle Konfigurationsimport bleibt absichtlich deaktiviert, erzeugt neue IDs unter `eos-admin.N.eebus.*` und erfordert neue Kopplung. Er ist kein automatischer 1:1-Import. Nach abgeschlossener automatischer Migration nicht zusätzlich manuell importieren.

Ablauf, Journal, Fehlercodes, RPC-Grenzen, Sicherung und Rückfall: `docs/unified/BESTANDSUEBERNAHME_9_0_7.md` im Gesamt-Repository. Softwaretests prüfen tatsächliche Schlüsselpaare und lokale TLS-Verbindungen; reale Geräte-, Anlagen- und Serienabnahmen bleiben erforderlich. Diese Angaben sind keine EEBus-/CRA-Zertifizierung.

## Partner im Dashboard überwachen (ab EOS 9.0.35)

Unter **EEBus → Geräte** den Partner koppeln und den erfolgreichen SHIP-Datenaustausch abwarten. In seiner Karte einen lokalen Anzeigenamen wie „Wärmepumpe West“ eingeben und **Überwachung aktivieren** wählen. Anmeldung am Netzwerk, mDNS-Erkennung oder Kopplung alleine erzeugen keine Überwachungszuordnung. Die Aktivierung speichert eine lokale Einstellung. Sie sendet keinen Steuer- oder Verbindungsbefehl an den Partner.

Die Anzeige überwacht die autorisierte SHIP-Verbindung. Nach ihrem Verlust meldet EOS den lokal vergebenen Namen. Bei Neustart des EEBus-Moduls hat ein zuvor überwachter Partner 120 Sekunden zum Wiederverbinden. Bis dahin ist sein Verbindungsstatus unbekannt. Bei der tatsächlichen Rückkehr des Datenaustauschs bestätigt EOS die Verbindung erneut. „Trennen“, ein Widerruf der Freigabe oder eine geänderte Zertifikatsbindung pausiert die Überwachung auch über einen Neustart hinweg. Nach erneut bestätigter Kopplung mit **Überwachung aktivieren** fortsetzen. Über **Überwachung entfernen** lässt sich ein gespeicherter Partner auch ohne aktuelle Verbindung austragen.

Die Anzeige beschreibt den Verbindungszustand. Der lokale Betriebszustand des angeschlossenen Geräts kann davon abweichen.
