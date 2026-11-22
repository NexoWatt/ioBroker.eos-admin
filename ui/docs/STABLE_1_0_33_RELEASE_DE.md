<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# NexoWatt EOS 1.0.33 – EMS-Anmeldung und ioBroker-Kontozuordnung

Dieser technische Teststand baut vollständig auf 1.0.32 und dessen Ausgangsbasis 1.0.31 auf. Dieser Stand ist nicht für den Produktivbetrieb freigegeben.

Die EMS-Anmeldung löst Anzeigenamen über die öffentliche ioBroker-API in die tatsächliche Konto-ID auf. Interne Kurzkennungen, deren vom Controller unterstützte Schreibweisen und vollständige `system.user.*`-IDs werden berücksichtigt. Passwortprüfung, aktuelle Kontofingerabdrücke, Rollen und Sitzung verwenden danach ausschließlich dieses Konto. Ein Anzeigename kann keine Rolle verleihen. Unerwartete Passwort-Rückgabewerte und abweichende Callback-Identitäten werden abgewiesen.

Dies korrigiert einen lokalen Fehler in NexoWatt UI 1.0.32; es wurde kein neues Passwortformat von Admin 8 nachgewiesen. Das EMS verwendet weiterhin eine eigene, geschützte Sitzung. Eine vorhandene Admin-Anmeldung ist keine automatische EMS-Anmeldung. Benutzerpasswörter oder Benutzerobjekte werden durch das Update nicht geändert. Die dokumentierte NW1-Kompatibilitätsentscheidung bleibt bestehen.

Vor dem Update Konfiguration sichern. Nach dem Update die lokale Benutzer-/Passwortanmeldung, Rollen und Kontosperre mit einem vorhandenen Testkonto prüfen. Die bestehende Anlagenregelung und Partnerkonfiguration werden durch diese Änderung nicht umgestellt. Für den Rückfall den vorherigen vollständigen Adapterstand bereithalten; Sitzungen sind nach Adapterneustart neu anzulegen.

Einrichtung und Diagnose: [Admin 8 und EMS-Anmeldung](operations/ADMIN8_EMS_ANMELDUNG_DE.md). Tatsächliche Tests, Quellen und Grenzen: [Prüfbericht](reports/admin8-login-2026-11-03/PRUEFBERICHT_DE.md). Ein realer Test auf der gemeldeten Kundeninstallation wurde nicht ausgeführt; keine pauschale Freigabe aller Admin-8-Versionen.
