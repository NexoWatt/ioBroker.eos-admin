# NAVIGATION-906-001 – Installer-Rückweg und Navigation

Stand: 2026-11-23. Ausgangspunkt 9.0.5; Ziel 9.0.6.

Die Installer-Seite bietet für bestätigte Admin-Sitzungen „Zur EOS-Administration“ (`/system/`) und für bestätigte Sitzungen „Zum EOS-Dashboard“ (`/`). Die Links erhalten den Runtime-Origin einschließlich TLS, Hostname und Port. Rollen und Berechtigungen werden weiterhin serverseitig geprüft. Ein Wechsel zwischen IP-Adresse und Hostname teilt keine Cookies.

Die tatsächlich integrierten Modulwege `/modules/devices/` und `/modules/eebus/` sind für Admins im Installer sowie in der nativen EOS-Navigation erreichbar. Die zentrale Systemlizenz bleibt maßgeblich. Das Modul-Backend muss diese Wege bereitstellen und Admin-Zugriffe erzwingen.

Die native Navigation hat zwei Bereiche: feste EOS-Einstiege und Konto in der ersten Zeile, native System-/Modultabs darunter. Die zweite Zeile und bei schmalen Fenstern auch die Einstiege umbrechen bedarfsgerecht. Lange Titel bleiben lesbar. Bei kleinen Bildschirmhöhen wird innerhalb der Navigation vertikal gescrollt. Ein einzelner ResizeObserver misst die wirkliche Höhe und verschiebt den Inhalt darunter. Bei identischer Höhe erfolgt keine erneute Style-Mutation; Remount, Logout und Destroy lösen den Observer. Native Tab-Auswahl, Rollenfilter, Bearbeiten und Drag-and-drop bleiben in React.

## Verifikation

- `node --test src-admin/test/eos-navigation-906.test.mjs src-admin/test/eos-unified-navigation.test.mjs`: 10/10 bestanden. Rollen-/Zielverträge, Same-Origin-Rückwege, echte ausgelieferte Shell im DOM-Harness, Höhenänderung, Observer-Lebenszyklus, bestehende zentrale Sitzungs- und Lizenzverträge.
- `npm run typecheck --prefix ui/src-admin-tab`: bestanden.
- `npm run check-ts --prefix src-admin`: bestanden.
- `node --check src-admin/public/js/nexowatt-native-shell.js`: bestanden.
- Browser-Viewportprüfung hier blockiert: Chromium startet wegen `socket() failed: Operation not permitted` nicht; Pipe-/Single-Process-Versuch ebenfalls fehlgeschlagen. Kein visueller oder physischer Geräte-End-to-End-Nachweis wird daraus abgeleitet.

Die zentralen Frontend-Builds und die Gesamtrelease-Prüfung erfolgen nach Integration aller Änderungen. Vor Auslieferung auf 1920/1024/390 Pixeln prüfen: alle Tabs ohne horizontal abgeschnittene Titel erreichbar; Oberfläche beginnt unter Navigation; Kontomenü, Kompaktmodus, Editieren und Installer-Rücksprung funktionieren; direkte Modul-URLs für Nicht-Admins bleiben gesperrt.
