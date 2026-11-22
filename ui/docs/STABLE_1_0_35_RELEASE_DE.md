<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# NexoWatt EOS 1.0.35 – HTTPS-Anmeldung über Admin 8.3

Vollständiger Folgestand auf 1.0.34, damit auf 1.0.33, 1.0.32 und 1.0.31. Dieser Stand ist nicht für den Produktivbetrieb freigegeben.

Der HTTPS-Admin-Tab verwendet den offiziellen Instanzproxy ab Admin 8.3 unter demselben Browser-Origin. Die ausgewählte Instanz ist im Pfad gebunden. Eigene ioBroker-Passwörter, tatsächliche Gruppen und EOS-Sitzungen bleiben erforderlich; die Adminsitzung ersetzt keine EOS-Anmeldung. Es gibt keine automatische unverschlüsselte Passwortweitergabe und keine Versuche auf anderen Ports.

Die Laufzeitseiten berücksichtigen den Proxy-Unterpfad für Dateien, API-Aufrufe, Ereignisströme und Navigation. Der vorhandene Root-PWA-Serviceworker wird dort nicht registriert. Direkter Betrieb bleibt erhalten. Die Anmeldemaske benennt das eigene ioBroker-Konto, unterscheidet Verbindungs- und Passwortfehler und verhindert veraltete Antworten während An-/Abmeldung.

Vor dem Update sichern. Ein normales ioBroker-Adapterupgrade übernimmt die neue Metadatenfreigabe `common.adminTab.proxy: true` auch in Instanzobjekte. Danach UI-Adapter neu starten und Admin vollständig neu laden. Der Adminproxy erfordert die ioBroker-Administratorgruppe und Admin mindestens 8.3; ältere Admin-8-Versionen verfügen nicht über diesen Transport. Kunden und Installateure ohne diese ioBroker-Administratorgruppe nutzen weiterhin den direkten beziehungsweise separat abgesicherten EOS-Zugang mit ihren EOS-Rollen. Proxy-Opt-in ist keine Benutzerrechteänderung.

Die reale Installation, Zertifikate, individuelle Bind-Adresse und Reverse-Proxy-Konfiguration müssen vor Ort abgenommen werden. Bei separaten ioBroker-Hosts ist zusätzlich der interne Transport zu bewerten. Rückfall: vollständigen Stand 1.0.34 und Sicherung bereithalten; dessen HTTPS-Transportfehler bleibt bei Rückfall vorhanden.

[Einrichtung und Grenzen](operations/ADMIN_HTTPS_PROXY_DE.md) · [Prüfbericht](reports/admin-https-2026-11-03/PRUEFBERICHT_DE.md).
