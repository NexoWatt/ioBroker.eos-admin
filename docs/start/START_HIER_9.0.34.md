# NexoWatt EOS 9.0.34 auf der Pilotanlage

## OVUM MIRA einrichten

Die Profile für Hydraulikmodul (HSM) und Wärmepumpenmodul (WPM) verwenden die Modbus-START-Register der MIRA ab Firmware 1.1.3. Das HSM nimmt die EOS-Anforderung entgegen. Das WPM misst die elektrische Aufnahme der jeweiligen Wärmepumpe.

1. Im EOS-Admin **Geräte** öffnen und ein neues Gerät mit der Vorlage **OVUM MIRA** für das **Hydraulikmodul** anlegen. Für Modbus TCP die Adresse des LSM und den eingerichteten Port angeben (Herstellervorgabe 502). Für Modbus RTU die tatsächlichen seriellen Einstellungen des Anschlusses MODBUS 2 verwenden. Den vor Ort eingerichteten Modbus-Code eintragen, wenn das Gerät ihn verlangt.
2. HSM mit Unit-ID **110** einrichten. Für eine einzelne Pumpe **Wärmepumpenmodul mit anlegen oder vorhandenes verwenden** und **WPM 1** wählen (Unit-ID **111**). Bei getrennter RTU-Verkabelung das WPM zuerst mit seinem eigenen Port einrichten und dieses bestehende WPM am HSM auswählen. Speichern.
3. Das Dashboard **Live** öffnen. Sobald das WPM Leistung meldet, zeigt der Energiefluss einen Verbraucher mit dem Gerätenamen. Den elektrischen Istwert mit der MIRA-Geräteanzeige vergleichen. Bei 1,73 kW elektrisch erwartet EOS 1.730 W. Die thermische Heizleistung hat einen eigenen Datenpunkt. Der Gesamtverbrauch enthält die Pumpe. Der Gebäudeknoten zeigt den übrigen Verbrauch nach Abzug der separat dargestellten Verbraucher.
4. Für PV-Regelung am MIRA-Display die PV-Statusquelle auf **EMS** und für die direkte Leistungsvorgabe die PV-Datenquelle auf **SOLL** einstellen. In EOS am HSM die Quellenwahl bestätigen, die Steuerung freigeben und die für diese Anlage zulässige **elektrische** Leistung in Watt eintragen. Den Wert den örtlichen Anlagendaten entnehmen. Die EOS-Thermikregelung muss auf der Anlage freigegeben und aktiv sein.
5. Im Pilotbetrieb einen Wechsel von Neutral zu PV-Anforderung und zurück begleiten. Die angeforderte Leistung, die vom HSM bestätigten Register und die elektrische Istleistung am WPM getrennt beobachten. In Neutral übernimmt die MIRA ihre lokale Wärme- und Warmwasserführung. Die Funktion „PV-Anforderung aus“ nimmt die EOS-Anforderung zurück. Der Verdichter kann aus thermischen Gründen weiterlaufen.

Bei einer Kaskade können die tatsächlich vorhandenen WPM mit den Unit-IDs **111 bis 118** einzeln gemessen werden. Die automatische PV-Regelung in dieser Version unterstützt einen eindeutig zugeordneten Einzelkreis mit einem HSM und einem WPM. Die Energieflussanzeige verwendet freie Verbraucherslots. Sind alle zehn belegt, die vorhandene Zuordnung im EMS prüfen.

Bei einem vollständigen Busausfall kann eine bereits übertragene PV-Anforderung im HSM bestehen bleiben. Vor dem Kundeneinsatz Verhalten bei Busunterbrechung, Wiederverbindung und neutraler Rücknahme am Gerät prüfen. Die aktive Leistungsanforderung ist keine zugesicherte Abschaltung oder harte elektrische Anschlussbegrenzung.

## Installation, Git und npm

1. Vor dem Update die Instanz- und Anlagenkonfiguration sichern und den Wiederherstellungsschlüssel bereithalten. Die ZIP entpacken. Den Inhalt von `iobroker.eos-admin` in den bestehenden Git-Checkout übernehmen und die Änderungen vor dem Commit prüfen. Die ZIP enthält die Liefernachweise daneben unter `docs/Liefernachweise`.
2. Das zur Lieferung gehörende TGZ oder den geprüften Git-Stand über den üblichen npm-Ablauf veröffentlichen. Erst nach erfolgreichem Abruf des öffentlichen Archivs den ioBroker-Repository-Eintrag aktualisieren. Dafür im Adapterordner `node tools/nexowatt-patch-repo.cjs "/Pfad/zu/repo-nexowatt.json"` ausführen. Der Helfer prüft das öffentliche Archiv und seine Integrität.
3. Auf dem Raspberry Pi zuerst die bestehende Instanz aktualisieren. Nach dem Start in der Prozessübersicht EMS und Oberfläche sowie die konfigurierten Geräte-, OCPP-, EEBus- und Sicherungsmodule kontrollieren. Bei abgebrochener Installation den Instanzstatus nach der Wiederholung prüfen. Eine vom Controller gestoppte Instanz kann einen manuellen Start brauchen.
4. Für die Abnahme am Pi zusätzlich Gebäudeanzeige, Netz- und Batterierichtung, Tibber nach Neustart und das tatsächliche Zurückregeln der Wallbox prüfen. Bedienung und EMS parallel beobachten. Die bestehende [Pilotanleitung für die Leistungsregelung](START_HIER_9.0.33.md) enthält Vergleichsszenarien.
5. Bei Rückkehr zur bisherigen Version zunächst die EOS-PV-Anforderung an der Wärmepumpe auf Neutral zurücknehmen und am HSM bestätigen. Den früheren Lieferstand und die zugehörige Konfigurationssicherung verwenden.

[Prüfbericht zur Software und offenen Hardwareabnahme](../reports/unified-9.0.34/PRUEFBERICHT.md)
