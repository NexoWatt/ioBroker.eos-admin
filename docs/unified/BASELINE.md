# Ausgangsstand und Liefergrenze

**Änderungen:** EOS-MERGE-001 / EOS-ACCESS-002 · **Zielversion:** 9.0.1 · **Datum:** 22.11.2026

Dieser Stand führt EOS-Admin und NexoWatt UI in einem installierbaren Paket zusammen.
Der Produktname lautet **NexoWatt EOS**. Paket und Namespace bleiben aus Gründen der
Bestandskompatibilität `iobroker.eos-admin` und `eos-admin.<Instanz>`. Die neue Hauptversion
kennzeichnet die Zusammenführung; sie ist kein Updateversprechen für beliebige
Installationen. Der Stand bleibt eine Testversion für den Vertriebskanal `next`, keine Produktionsfreigabe.

## Verwendete Eingänge

Die Hashes identifizieren die unveränderten Eingangsarchive, nicht das neue ZIP.
Hashes und Prüfbelege des neuen Lieferstands stehen im zugehörigen Abschlussbericht
und Release-Manifest. Es wurde keine Kundenanlage ausgelesen.

| Eingang | Festgestellter Stand | SHA-256 der Eingangsdatei |
| --- | --- | --- |
| `NexoWatt_EOS_Admin_8.0.2_SYSTEM_EXPERT_LICENSE_FULL_REPOSITORY.zip` | EOS-Admin 8.0.2; Paketbeschreibung nennt ioBroker Admin 8.3.5 als Basis | `547de57a2d01415dfbd0d2bb8030ce4c2bcb9da6333c4b620cd4d54c4cdb6051` |
| `NexoWatt_UI_1.0.38_LOGO_HTTPS_WEBAPP_FULL_REPOSITORY.zip` | NexoWatt UI 1.0.38 | `204db55ab0ab62c2716ee8616d0b578f33844af94e6bba3da54275e1a86997dc` |
| `NexoWatt_EOS_Gemeinsamer_Adapter_Umsetzungsplan.md` | Planversion 1.0, 22.11.2026 | `5db8ffa0a20a8f34f36b5d410dc6c94389379775754598be3e8301ca40cafefb` |
| `NexoWatt_EOS_Keygen_1.0.4_FULL_REPOSITORY.zip` | NWL3-Ausstellerreferenz 1.0.4; kein Bestandteil des Adapterpakets | `c5a4435895092be11116cbc5b2bcfd96f3362ed84a2ff5737b9b904d29c3cf8f` |

## Zu erhaltende Funktionen

Dashboard, Verlauf, PWA, App-Center/Smarthome und Installer stammen aus der UI-Basis.
Die vorhandene ioBroker-Systemverwaltung stammt aus EOS-Admin. Ladebetriebsarten,
Speicher-/Netzregelung, Datenpunktzuordnung, Grenzen und Nutzerkonfiguration sind
Regressionsumfang. Ein Quellimport belegt noch nicht die unveränderte Funktion auf
realen Geräten. Vorhandene Fehler werden nicht zu neuem Sollverhalten erklärt.

| Komponente | Rolle im neuen Paket | Nachweisgrenze |
| --- | --- | --- |
| EOS-Admin-Lifecycle/Web/Auth | Host des gemeinsamen Adapters | Neue Integration und bestehende Verwaltungsfunktionen zusammen prüfen. |
| UI-/EMS-Bestand | Intern gehostete Fachfunktionen | Kein zweiter aktiver `nexowatt-ui`-Adapter im Zielbetrieb. |
| Zentraler Lizenzdienst | Einmalige Aktivierung, lokale Prüfung und Erweiterungsrechte | Keine Auslieferung des Keygens oder privater Signierschlüssel. |
| ioBroker-Controller, Objekt-/State-Datenbank | Externe Plattformvoraussetzung | Nicht in dieses Paket verschmolzen; konkrete Installationsversion erfassen. |
| Geräte-/Protokolladapter | Optionale externe Komponenten | Unterstützung, Installation und Aktivierung sind getrennt zu dokumentieren. |
| Direkter EOS-HTTPS-Dienst | Standard `0.0.0.0:8188`, Authentisierung/TLS aktiv; ioBroker-Zertifikatsnamen `defaultPublic`/`defaultPrivate` | Tatsächliches Zertifikatsmaterial, SAN, Clientvertrauen und HTTPS-Login auf dem Zielgerät prüfen. |
| Optionaler HTTPS-Eingang auf 443, DNS, Hostrechte | Systemintegration außerhalb npm-Lifecycle; ebenfalls HTTPS zum Upstream mit CA-Prüfung | Nur bei gewünschtem Zugang ohne Port einzurichten; kein automatischer DNS-/Root-/Firewallumbau. |

## Geändertes Zugangsprofil in 9.0.1

Die vorangegangenen Alpha-Profile mit obligatorischem HTTP-Loopback-Upstream auf
8188 beschreiben nicht die neuen Defaults. Direkter HTTPS-Zugang auf 8188 ist jetzt
der Einstieg; 443 ist optional. `eosExternalOrigin` bleibt im neuen HTTPS-Profil
für parallele IP-/Namenszugänge auch mit HTTPS-Proxy leer. Der ioBroker-Adminzugang
bleibt unverändert und
Legacy-Sperrflags erteilen keine automatische Abschalt-/Umadressierungsbefugnis.
Der lokale Name `NexoWattEOS` benötigt eine passende Namensauflösung und Zertifikat-SAN.
Details: [ACCESS_RECOVERY_9.0.1.md](ACCESS_RECOVERY_9.0.1.md).

## Prüfaussagen und historische Unterlagen

Der endgültige Prüfbericht nennt Befehle, Umgebung, Ergebnisse, Fehler und offene
Gates für **diesen** Quellstand. Übernommene Berichte früherer Versionen sind
historische Nachweise. Sie gelten nicht automatisch für 9.0.1. Das gleiche
gilt für alte Dateien mit „ready“, „stable“, „approval“ oder „production“ im Namen.

Die Build-/Paketierung muss TypeScript-Quellen und ausgelieferte JavaScript-/Frontend-
Artefakte konsistent halten. Im integrierten UI-Bestand bleiben
`ui/src-ts/runtime-executables/**` die maßgeblichen Laufzeitquellen. Reine Änderungen
an generierten Dateien ersetzen die Quelländerung nicht.
