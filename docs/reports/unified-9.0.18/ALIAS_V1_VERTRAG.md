# Alias V1: einheitliche EMS-Semantik und Profilabdeckung

Stand: NexoWatt EOS 9.0.18, ergänzende Quellprüfung vom 24.11.2026. Dieser Bericht dokumentiert eine statische Erzeugungs-/Verhaltensprüfung, keine Abnahme an 195 realen Geräten.

## Ergebnis und Funktionserhalt

Alle 195 ausgelieferten Profile erzeugen weiterhin ihre bestehenden Alias-V1-Pfade. Die bisherigen 2463 kanonischen Aliase bleiben erhalten; 89 zusätzliche ausschließlich lesbare Aliase werden für 25 Profile aus expliziten Quellen erzeugt. Gesamt: 2552. Roh-Datenpunkte, Legacy-Aliase, bestehende Schreibziele, Unit-IDs, Registeradressen, bestehende Kundenzuordnungen und Einstellungen werden durch diese Erweiterung nicht umgeschrieben. Es entstehen keine zusätzlichen Schreibfähigkeiten.

Einheitliche Namen bedeuten nicht identische Fähigkeiten: 52 Profile gehören zu ESS/Batterie/Batterie-Wechselrichter. Für 25 davon sind zusätzliche Quellbindungen vorhanden; die übrigen 27 erhalten für die neue Semantik den Status `noVerifiedSourceBinding`. 143 Profile anderer Geräteklassen behalten ihre klassenbezogenen Aliase; die zusätzlichen Speicherrollen sind dort nicht anwendbar. Bestehende Gerätefunktionen bleiben erhalten.

## Einheitliche zusätzliche Pfade

Alle Pfade liegen unter `devices.<id>.aliases.v1`, Typ `number`, Einheit `W`, Rolle `value.power`, ausschließlich lesbar.

| Pfad | Bedeutung und Grenze |
| --- | --- |
| `r.essActivePower` | Tatsächliche AC-Leistung des Speicherumrichters; bei Hybridgeräten einschließlich zugehörigem DC-PV-Anteil. Nicht pauschal mit Batterie-Leistung gleichsetzen. |
| `r.minPowerSetpointW` | Berichtete untere Grenze für den vorzeichenbehafteten Leistungssollwert; Laden negativ. |
| `r.maxPowerSetpointW` | Berichtete obere Grenze für den vorzeichenbehafteten Leistungssollwert; Entladen positiv. |
| `r.powerSetpointReadbackW` | Tatsächlich aus einem Geräte-Leseregister zurückgelesener Sollwert. Kein Beweis, dass die physische Leistung bereits erreicht wurde. |
| `r.pvPowerDc` | Explizit ausgewiesene PV-Erzeugung auf DC-Seite. |
| `r.pvPowerAc` | Explizit ausgewiesene PV-Erzeugung auf AC-Seite. |
| `r.pvPowerTotal` | Gesamtwert der vom Geräteprofil erfassten PV-Quellen. Nicht nochmals mit enthaltenen AC/DC-Teilwerten addieren. |
| `r.nvpPower` | Zugeordnete Netz-Zählermessung, Bezug positiv/Einspeisung negativ. Die tatsächliche Anlagenposition M0/M1 ist weiterhin bewusst zuzuordnen. |
| `r.consumptionTotal` | Vom Geräteprofil berichteter Gesamtverbrauch. Messgrenze entsprechend der konkreten Installation. |

## Quellenbindung und sichere Fehlerbehandlung

`modules/devices/lib/device-alias-semantics-v1.json` enthält je unterstütztem Profil die vollständige erwartete Roh-DP-Definition: ID, Einheit, Typ, Lesezugriff und Quellenbeschreibung. `deviceAliasSemantics.js` vergleicht diese Beschreibung strukturell mit dem tatsächlich verwendeten Profil. Fehlende, umbenannte, anders skalierte, schreibgeschützte bzw. ausschließlich schreibbare oder auf andere Register verschobene Quellen erhalten keine neue Zuordnung. Es wird weder per Regex geraten noch eine unbekannte Einheit als W ausgegeben.

Die Alias-Konvertierung erfolgt erst nach der vorhandenen Treiberdekodierung: kW werden einmalig zu W. Vom Treiber bereits angewandte Vorzeichenumkehr, insbesondere SolaX Hybrid Batterie, wird nicht doppelt angewandt. Ungültige Werte (null, Strings, NaN, Infinity) bleiben ungültig; negative Werte aus als positiv definierten Lade-/Entladegrenzen werden verworfen.

Ein echter Poll liefert neue Rückmeldungen. `_ackWrittenValue` überspringt die neuen `deviceReadOnly`-Aliase: gesendete, wartende oder verworfene Sollwerte können deshalb nicht als tatsächlicher Geräte-Readback erscheinen. Kein Rückgriff auf den letzten Befehlswert und kein erfundener Readback für FENECON Register 706 oder TESVOLT MQTT-Befehlsspeicher.

`aliases.meta.manifest.semanticCoverage` nennt je neuer Speicherrolle Verfügbarkeit und Grund; das Fehlen einer Quelle ist keine Funktionsfreigabe. Native Netzsollwerte werden durch diese Erweiterung nicht hinzugefügt. Die vorhandene FENECON-Quelle 992 bleibt getrennt vom direkten ESS-Ziel 706 und unterliegt den bestehenden Identitäts-/Schreibprüfungen.

## Herstellerspezifische Abgrenzung

- FENECON Home: ESS-AC 604, Min/Max 702/704, PV DC/AC/Gesamt 339/331/327, Netz 315 und Verbrauch 343. Batterie-/AC-Pfad 415 bleibt unverändert. Register 706 ist ausschließlich schreibbar und erzeugt keinen Readback.
- SolaX EMS1000: Batteriemessung 95 und Leistungsziel 152 bleiben erhalten; neue Grenzen aus 104/105, Geräte-Readback 152, Gesamt-PV 91, Verbrauch 97. kW→W erfolgt genau einmal.
- SolaX Hybrid X1/X3: Batteriemessung 56 einschließlich bestehender Treiber-Invertierung; Ziel write161/read417; neue Grenzen 162/164 und Gesamt-PV 50. Kein erfundenes AC-Batteriefeedback, keine geschätzte AC/DC-PV-Aufteilung und kein nativer Netzsollwert.
- SolaX-Netzvorzeichen: Die offizielle Meter-Anleitung beschreibt Netzbezug mit negativem Pgrid. Diese Anleitung belegt nicht die genaue Semantik jeder im Katalog verwendeten Register-/Firmwarekombination. Deshalb wird `r.nvpPower` für beide SolaX-Profile nicht automatisch erzeugt und bestehendes `r.gridPower` nicht umgedreht. Exakte Protokollfassung und Anlagenprüfung bleiben offen.
- FOX ESS: Die bisherigen Leistungsgrenzen sind im Katalog als angenommen bezeichnet; daraus werden keine neuen signierten Min-/Max-Grenzen erzeugt. PV-Eingangsleistung ist als DC-Quelle ausgewiesen. Ungeklärte Netzrichtung wird nicht als neue NVP-Zuordnung ausgegeben.
- KOSTAL: Das hybride Gesamtsignal wird nicht als reine AC-PV-Leistung umbenannt; keine neue ungeprüfte NVP-Richtungsannahme.
- VARTA: Die bereits dokumentierte Vorzeichenumkehr wird beibehalten; PV-Sensorleistung bleibt auf den vom Sensor erfassten Umfang begrenzt. Die neuen Aliase erlauben keine absolute Speicherregelung.
- DEYE: Die vorhandene geprüfte kanonische Batterie-/Netz-/MPPT-Dekodierung wird verwendet; zusätzliche Mess-Aliase erzeugen keine Schreibfähigkeiten.
- Historische OpenEMS-Importprofile ohne vollständige Einheit/AC-DC-/Grenzwertbeschreibung bleiben für die neuen Rollen als nicht verfügbar ausgewiesen; vorhandene Aliase werden nicht entfernt.

Offizielle ergänzende Quellen (abgerufen 24.11.2026): [SolaX Meter Installation](https://kb.solaxpower.com/solution/detail/ff8080818407e2a701840a15af480028), [SolaX Modbus TCP / Anforderung der aktuellen Protokollunterlage](https://kb.solaxpower.com/solution/detail/ff8080818407e2a701840a22dec20032). Die vollständigen spezifischen Registerbeschreibungen aller Hersteller wurden in diesem Schritt nicht neu extern beschafft; die neue Matrix bindet an die vorhandenen lokalen Profildefinitionen und nennt offene Semantik ausdrücklich.

## Prüfungen

Die vorhandenen sieben Alias-V1-Tests und sechs ergänzenden Semantiktests bestanden (13/13, keine übersprungenen Tests). Geprüft wurden alle 195 Profile, Erhalt alter Ziele/Typen/Einheiten, kanonische W-Werte, FENECON-Signaltrennung, beide SolaX-Profile, echte Rückmeldung statt Schreibbestätigung, VARTA-Vorzeichen und DEYE-MPPT, fehlende/manipulierte Quellen und ungültige Werte. `tsconfig.alias-semantics.json` prüft das neue Modul mit strict, noUncheckedIndexedAccess und exactOptionalPropertyTypes. ESLint für neues Modul und Tests bestanden. Die Rohbelege werden vom Gesamtbuild mitgeführt.

Nicht durchgeführt: neue reale Hersteller-/Firmware-Abnahmen, neue physische Lade-/Entladeversuche und vollständige Neubelegung aller bisherigen Registerprotokolle. Allgemeine Hardwarefreigabe und CRA-Konformität werden hierdurch nicht behauptet.

## Vollständige Profilmatrix

Kurzzeichen: **E** ESS-AC; **L** untere Grenze; **H** obere Grenze; **R** echter Sollwert-Readback; **D** DC-PV; **A** AC-PV; **P** Gesamt-PV; **N** Netz; **V** Verbrauch. „—“ bedeutet kein neuer belegter Alias; bei anderen Geräteklassen nicht anwendbar. Die maschinenlesbare [ALIAS_V1_COVERAGE.json](ALIAS_V1_COVERAGE.json) enthält alle Quellen/Einheiten/Richtungen der vorhandenen Bindungen und die genauen Nichtverfügbarkeitsgründe.

| Profil | Geräteklasse | V1 gesamt | Neue Semantik |
| --- | --- | ---: | --- |
| `battery.bmw.BatteryBmwImpl` | battery | 17 | — |
| `battery.bydcommercial.BydBatteryBoxCommercialC130Impl` | battery | 13 | — |
| `battery.fenecon.BatteryFeneconCommercialImpl` | battery | 11 | — |
| `battery.fenecon.BatteryFeneconHomeImpl` | battery | 13 | — |
| `battery.pylontech.PylontechPowercubeM2BatteryImpl` | battery | 13 | — |
| `battery.sma.SmaBatteryImpl` | battery | 17 | — |
| `battery.soltaro.BatterySoltaroClusterVersionBImpl` | battery | 13 | — |
| `battery.soltaro.BatterySoltaroClusterVersionCImpl` | battery | 13 | — |
| `battery.soltaro.BatterySoltaroSingleRackVersionAImpl` | battery | 15 | — |
| `battery.soltaro.BatterySoltaroSingleRackVersionBImpl` | battery | 16 | — |
| `battery.soltaro.BatterySoltaroSingleRackVersionCImpl` | battery | 12 | — |
| `battery.victron.VictronBatteryImpl` | battery | 15 | — |
| `battery_inverter.refu88k.BatteryInverterRefuStore88kImpl` | batteryInverter | 10 | — |
| `battery_inverter.sinexcel.BatteryInverterSinexcelImpl` | batteryInverter | 15 | — |
| `battery_inverter.victron.VictronBatteryInverterImpl` | batteryInverter | 14 | — |
| `charger.goodwe.AbstractGoodWeEtCharger` | solarCharger | 6 | — |
| `dc_charger.victron.VictronDcChargerImpl` | solarCharger | 11 | — |
| `ess.adstec.EssAdstecStoraxeImpl` | storageSystem | 11 | — |
| `ess.fenecon.AbstractEssFeneconCommercial40Pv` | storageSystem | 10 | — |
| `ess.fenecon.AbstractFeneconDessCharger` | storageSystem | 7 | — |
| `ess.fenecon.EssFeneconCommercial40Impl` | storageSystem | 19 | — |
| `ess.fenecon.FeneconDessEssImpl` | storageSystem | 9 | — |
| `ess.fenecon.FeneconHomeEssImpl` | storageSystem | 31 | E N V L H D A P |
| `ess.fenecon.FeneconMiniEssImpl` | storageSystem | 12 | — |
| `ess.fenecon.FeneconProEssImpl` | storageSystem | 18 | — |
| `ess.foxess.FoxESSH3Ess` | storageSystem | 28 | V R D P |
| `ess.foxess.FoxESSH3ProEss` | storageSystem | 28 | V R D P |
| `ess.kaco.gridsave.sunspec.v1` | storageSystem | 10 | — |
| `ess.kaco.hybrid10.sunspec.v1` | storageSystem | 10 | — |
| `ess.kostal.KostalManagedEssBigEndianImpl` | storageSystem | 21 | R |
| `ess.kostal.KostalManagedEssImpl` | storageSystem | 21 | R |
| `ess.samsung.sdi.http.v1` | storageSystem | 14 | N V P |
| `ess.sma.EssSmaSunnyIslandImpl` | storageSystem | 21 | — |
| `ess.solax.Ems1000ModbusTcp` | storageSystem | 26 | V L H R P |
| `ess.solax.SolaXHybridX1X3Ess` | storageSystem | 30 | L H R P |
| `ess.sunspec.generic.basic124.v1` | storageSystem | 8 | — |
| `ess.tesla.powerwall2.gateway.http.v1` | storageSystem | 14 | N V P |
| `ess.tesvolt.TesvoltEnergyManagerVermarkter` | storageSystem | 26 | N V L H R P |
| `ess.tesvolt.iotGateway.mqttV2` | storageSystem | 21 | E L H |
| `ess.victron.VictronEssImpl` | storageSystem | 20 | — |
| `evcs.abl.EvcsAblImpl` | evCharger | 12 | — |
| `evcs.abl.emh1.evcc2_3.modbusAscii` | evCharger | 24 | — |
| `evcs.alpitronic.hypercharger.connector1` | evCharger | 8 | — |
| `evcs.alpitronic.hypercharger.connector2` | evCharger | 8 | — |
| `evcs.alpitronic.hypercharger.connector3` | evCharger | 8 | — |
| `evcs.alpitronic.hypercharger.connector4` | evCharger | 8 | — |
| `evcs.alpitronic.hypercharger.station` | evCharger | 6 | — |
| `evcs.goe.EvcsGoeModbusImpl` | evCharger | 5 | — |
| `evcs.goe.chargerhome.http.v1` | evCharger | 11 | — |
| `evcs.goe.gemini.http.v2` | evCharger | 10 | — |
| `evcs.goe.gemini.http.v2.legacy` | evCharger | 10 | — |
| `evcs.heidelberg.EvcsHeidelbergEnergyImpl` | evCharger | 6 | — |
| `evcs.keba.EvcsKebaModbusImpl` | evCharger | 35 | — |
| `evcs.keba.udp.KeContactP20P30` | evCharger | 9 | — |
| `evcs.mennekes.EvcsMennekesImpl` | evCharger | 9 | — |
| `evcs.mennekes.amtron4you500.4business700.modbusTcp` | evCharger | 24 | — |
| `evcs.openwb.lp1.mqtt.v1` | evCharger | 6 | — |
| `evcs.openwb.lp2.mqtt.v1` | evCharger | 6 | — |
| `evcs.solax.SolaXHacG2` | evCharger | 11 | — |
| `evcs.spelsberg.EvcsSpelsbergSmartImpl` | evCharger | 9 | — |
| `evcs.webasto.EvcsWebastoNextImpl` | evCharger | 12 | — |
| `evcs.webasto.EvcsWebastoUniteImpl` | evCharger | 7 | — |
| `evse.chargepoint.EvseAlpitronicImpl` | evCharger | 6 | — |
| `evse.chargepoint.EvseChargePointHeidelbergConnectImpl` | evCharger | 8 | — |
| `evse.chargepoint.EvseKebaModbusImpl` | evCharger | 31 | — |
| `generic.canbus.raw.v1` | generic | 3 | — |
| `generic.http` | generic | 3 | — |
| `generic.modbus` | generic | 3 | — |
| `generic.mqtt` | generic | 3 | — |
| `heat.askoma.HeatAskomaImpl` | heat | 3 | — |
| `heat.lambda.LambdaWpModbus` | heat | 18 | — |
| `heat.mypv.HeatMyPvAcThor9sImpl` | heat | 3 | — |
| `heat.tecalor.TecalorLwzModbus` | heat | 8 | — |
| `heat.tecalor.TecalorWpm3iModbus` | heat | 11 | — |
| `io.filipowski.IoFilipowskiMrAo1Impl` | io | 3 | — |
| `io.kmtronic.IoKmtronicRelay4PortImpl` | io | 11 | — |
| `io.kmtronic.IoKmtronicRelay8PortImpl` | io | 19 | — |
| `io.onewire.OneWireDs18b20Temperature.V1` | io | 3 | — |
| `io.shelly.plug_gen1` | io | 5 | — |
| `io.shelly.plugsg3` | io | 4 | — |
| `io.shelly.plus1pm` | io | 4 | — |
| `io.shelly.pro4pm` | io | 17 | — |
| `io.shelly.shelly1` | io | 3 | — |
| `io.shelly.shelly25` | io | 7 | — |
| `io.siemenslogo.SiemensLogoRelayImpl` | io | 23 | — |
| `io.wut.WebIoDigital4_57733_4xInOutImpl` | io | 19 | — |
| `io.wut.WebIoDigital4_57736_16xInOutImpl` | io | 67 | — |
| `io.wut.WebIoDigital4_57756_Logger16xInOutImpl` | io | 67 | — |
| `meter.abb.b23.mbus.v1` | meter | 6 | — |
| `meter.artemes.MeterArtemesAM2Impl` | meter | 12 | — |
| `meter.bcontrol.MeterBControlEM300Impl` | meter | 15 | — |
| `meter.bgetech.MeterBgeTechDrt428M2Impl` | meter | 13 | — |
| `meter.camillebauer.MeterCamillebauerAplusImpl` | meter | 13 | — |
| `meter.carlo.MeterCarloGavazziEm100Impl` | meter | 11 | — |
| `meter.carlo.MeterCarloGavazziEm300Impl` | meter | 15 | — |
| `meter.discovergy.inexogy.http.v1` | meter | 9 | — |
| `meter.eastron.MeterEastronSdm120Impl` | meter | 9 | — |
| `meter.eastron.MeterEastronSdm630Impl` | meter | 13 | — |
| `meter.fenecon.FeneconDessGridMeterImpl` | meter | 12 | — |
| `meter.fenecon.FeneconDessPvMeterImpl` | meter | 6 | — |
| `meter.fenecon.FeneconMiniGridMeterImpl` | meter | 6 | — |
| `meter.fenecon.FeneconMiniPvMeterImpl` | meter | 6 | — |
| `meter.fenecon.FeneconProPvMeterImpl` | meter | 8 | — |
| `meter.hager.ecr380d` | meter | 15 | — |
| `meter.janitza.MeterJanitzaUmg104Impl` | meter | 12 | — |
| `meter.janitza.MeterJanitzaUmg511Impl` | meter | 12 | — |
| `meter.janitza.MeterJanitzaUmg604Impl` | meter | 15 | — |
| `meter.janitza.MeterJanitzaUmg604proImpl` | meter | 15 | — |
| `meter.janitza.MeterJanitzaUmg801Impl` | meter | 6 | — |
| `meter.janitza.MeterJanitzaUmg806Impl` | meter | 12 | — |
| `meter.janitza.MeterJanitzaUmg96paImpl` | meter | 15 | — |
| `meter.janitza.MeterJanitzaUmg96rmeImpl` | meter | 12 | — |
| `meter.kdk.MeterKdk2puctImpl` | meter | 9 | — |
| `meter.kostal.KostalGridMeterBigEndianImpl` | meter | 14 | — |
| `meter.kostal.KostalGridMeterImpl` | meter | 14 | — |
| `meter.mbus.GenericWiredMbusDevice.V1` | meter | 3 | — |
| `meter.phoenixcontact.PhoenixContactMeterImpl` | meter | 13 | — |
| `meter.plexlog.MeterPlexlogDataloggerImpl` | meter | 3 | — |
| `meter.pqplus.MeterPqplusUmd96Impl` | meter | 10 | — |
| `meter.pqplus.MeterPqplusUmd97Impl` | meter | 10 | — |
| `meter.samsung.ess.grid.http.v1` | meter | 6 | — |
| `meter.schneider.MeterSchneiderActi9SmartlinkImpl` | meter | 15 | — |
| `meter.shelly.3em_gen1` | meter | 12 | — |
| `meter.shelly.pro3em` | meter | 12 | — |
| `meter.siemens.MeterSiemensPac1600Impl` | meter | 12 | — |
| `meter.siemens.MeterSiemensPac2200Impl` | meter | 11 | — |
| `meter.siemens.MeterSiemensSicamt7kg966Impl` | meter | 15 | — |
| `meter.sma.MeterSmaShm20Impl` | meter | 15 | — |
| `meter.sma.SmaEnergyMeterSpeedwireImpl` | meter | 15 | — |
| `meter.socomec.countis_e14_singlephase` | meter | 11 | — |
| `meter.socomec.countis_e23_e24_e27_e28` | meter | 15 | — |
| `meter.socomec.countis_e34_e44` | meter | 15 | — |
| `meter.socomec.diris_a10` | meter | 15 | — |
| `meter.socomec.diris_a14` | meter | 15 | — |
| `meter.socomec.diris_b30` | meter | 14 | — |
| `meter.sunspec.generic.model201.v1` | meter | 3 | — |
| `meter.sunspec.generic.model202.v1` | meter | 3 | — |
| `meter.sunspec.generic.model203.v1` | meter | 3 | — |
| `meter.victron.VictronAcInPowerMeterImpl` | meter | 10 | — |
| `meter.victron.VictronAcOutPowerMeterImpl` | meter | 7 | — |
| `meter.victron.VictronMeterImpl` | meter | 14 | — |
| `meter.weidmueller.MeterWeidmueller525Impl` | meter | 12 | — |
| `meter.ziehl.MeterZiehlEfr4001IpImpl` | meter | 15 | — |
| `pv_inverter.foxess.FoxESSTG3G3PvInverter` | pvInverter | 8 | — |
| `pv_inverter.goodwe.AbstractGoodWe` | pvInverter | 6 | — |
| `pv_inverter.goodwe.GoodWeEmergencyPowerMeterImpl` | pvInverter | 6 | — |
| `pv_inverter.goodwe.GoodWeGridMeterImpl` | pvInverter | 6 | — |
| `pv_inverter.kaco.blueplanet.nx3.sunspec.v1` | pvInverter | 12 | — |
| `pv_inverter.kostal.KostalPvInverterBigEndianImpl` | pvInverter | 8 | — |
| `pv_inverter.kostal.KostalPvInverterImpl` | pvInverter | 8 | — |
| `pv_inverter.sma.SmaStp12570ModbusAll` | pvInverter | 12 | — |
| `pv_inverter.sma.SmaStp12570SunSpecImpl` | pvInverter | 13 | — |
| `pv_inverter.sma.SmaStp12570SunSpecMinimal` | pvInverter | 13 | — |
| `pv_inverter.sma.SmaStpxx50Minimal` | pvInverter | 12 | — |
| `pv_inverter.sma.SmaStpxxUs41Minimal` | pvInverter | 12 | — |
| `pv_inverter.sma.SmaSunnyTripowerXMinimal` | pvInverter | 12 | — |
| `pv_inverter.solarlog.PvInverterSolarlogImpl` | pvInverter | 6 | — |
| `pv_inverter.solarlog.SolarLogDpmDirectMarketing` | pvInverter | 9 | — |
| `pv_inverter.solarlog.SolarLogPmV2PowerManagement` | pvInverter | 8 | — |
| `pv_inverter.solax.SolaXX3MegaForthMinimal` | pvInverter | 11 | — |
| `pv_inverter.sunspec.generic.model101.v1` | pvInverter | 12 | — |
| `pv_inverter.sunspec.generic.model102.v1` | pvInverter | 12 | — |
| `pv_inverter.sunspec.generic.model103.v1` | pvInverter | 12 | — |
| `pv_inverter.victron.VictronPvInverterImpl` | pvInverter | 6 | — |
| `pv_inverter.victron.VictronPvInverterViaDcChargerImpl` | pvInverter | 6 | — |
| `evcs.alfen.ng9xx.ace.socket1.modbusTcp` | evCharger | 21 | — |
| `evcs.alfen.ng9xx.ace.socket2.modbusTcp` | evCharger | 21 | — |
| `evcs.alfen.ng9xx.ace.station.modbusTcp` | evCharger | 24 | — |
| `pv_inverter.kostal.PikoModbusSunSpecBigEndianImpl` | pvInverter | 8 | — |
| `pv_inverter.kostal.PikoModbusSunSpecImpl` | pvInverter | 8 | — |
| `pv_inverter.kostal.Piko1pTcp` | pvInverter | 8 | — |
| `pv_inverter.kostal.Piko3pTcp` | pvInverter | 8 | — |
| `pv_inverter.kostal.PikoBaTcp` | pvInverter | 8 | — |
| `pv_inverter.kostal.Piko1pRs485` | pvInverter | 8 | — |
| `pv_inverter.kostal.Piko3pRs485` | pvInverter | 8 | — |
| `pv_inverter.kostal.PikoBaRs485` | pvInverter | 8 | — |
| `pv_inverter.sungrow.GridConnectedCxRsRtModbus` | pvInverter | 12 | — |
| `ess.sungrow.ResidentialHybridV119` | storageSystem | 31 | N V D P |
| `ess.sungrow.Logger1000_3000_4000` | storageSystem | 28 | N V L H P |
| `ess.sungrow.iHomeManagerV101` | storageSystem | 19 | N V L H |
| `evcs.weidmueller.chargeWallboxBusiness.modbusTcp` | evCharger | 28 | — |
| `heat.ta.cmi` | heat | 3 | — |
| `evcs.oem.modbusV1003.connector1` | evCharger | 29 | — |
| `evcs.oem.modbusV1003.connector2` | evCharger | 29 | — |
| `ess.varta.element.modbusTcpV14` | storageSystem | 15 | E N |
| `ess.varta.oneL.modbusTcpV14` | storageSystem | 15 | E N |
| `ess.varta.oneXL.modbusTcpV14` | storageSystem | 15 | E N |
| `ess.varta.elementBackup.modbusTcpV14` | storageSystem | 20 | E N A P |
| `ess.varta.pulse.modbusTcpV14` | storageSystem | 20 | E N A P |
| `ess.varta.pulseNeo.modbusTcpV14` | storageSystem | 21 | E N A P |
| `ess.varta.link.modbusTcpV14` | storageSystem | 15 | E N |
| `ess.varta.flexStorage.modbusTcpV14` | storageSystem | 17 | E N |
| `ess.deye.singlePhase.modbusRtu` | storageSystem | 17 | N V D P |
| `ess.deye.threePhaseLv.modbusRtu` | storageSystem | 17 | N V D P |
| `ess.deye.threePhaseHv.modbusRtu` | storageSystem | 17 | N V D P |
