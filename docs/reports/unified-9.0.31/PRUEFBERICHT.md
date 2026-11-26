# EOS 9.0.31 – iPhone-Symbol auf dem Home-Bildschirm

## Feldbefund und Änderung

Ausgangspunkt ist der ausgelieferte Quellstand EOS 9.0.30. Der frühere Screenshot zeigt ein „N“ als Ersatzsymbol für die Startseite. Der aktuelle Screenshot zeigt den separaten Aufruf der Bilddatei mit 180×180 Pixeln. Das anschließende Teilen dieser Datei erzeugt eine Verknüpfung zur Datei. Die Vorschau der EOS-Startseite nach der Vertrauensfreigabe und die Ursache der ursprünglichen fehlenden Icon-Auswahl bleiben auf dem Zielgerät offen.

Dashboard, Login, Admin-Frontend und die bestehenden EOS-Webseiten melden `/apple-touch-icon-eos-v2.png` als Apple-Touch-Icon. Der URL-Pfad unterscheidet sich vom bisherigen, damit Safari eine neue Bildadresse erhält. Die üblichen Apple-Icon-Pfade liefern jetzt dasselbe 180×180-PNG. Das mitgelieferte 1024-Pixel-Original bleibt als Manifest-Ressource verfügbar. Der Zugriff auf die festen öffentlichen Bilddateien wird weiter über die vorhandenen Host- und Transportprüfungen vermittelt.

Apple beschreibt PNG-Bilder im Stammverzeichnis und die Auswahl über `apple-touch-icon`. WebKit beschreibt das Monogramm als Ersatzsymbol und den Vorrang von Apple-Touch-Icons vor Manifest-Symbolen. [Apple Safari Web Content Guide](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html) · [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

## Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Vollständiges `npm test` unter Node.js 22 | v22.23.4, 2740 erfasst, 2738 bestanden, 2 ausgelassen |
| Vollständiges `npm test` unter Node.js 24 | v24.22.3, 2740 erfasst, 2738 bestanden, 2 ausgelassen |
| Typprüfung, Lint und Builds | Bestanden |
| Gezielte HTTPS-, GUI- und Startprüfungen | Je 36 von 36 unter Node.js 22 und 24 bestanden. Die Prüfungen verwenden auch einen im Test erzeugten und aktivierten lokalen Vertrauensanker mit vollständiger IP-Zertifikatsprüfung und rufen das Bild bei gestoppter Laufzeit ab. |
| PWA-Metadaten und Bilddateien | Je 7 von 7 unter Node.js 22 und 24 bestanden. Die Prüfungen erfassen die vom Frontend-Build ausgegebenen Dateien und die vor der Anmeldung erreichbaren Bildpfade. |
| iPhone-Vorschau und installiertes Symbol am Zielgerät | Offen |

Die gezielten Prüfungen umfassen das öffentliche PNG über HTTPS per GET und HEAD, die üblichen Root-Pfade, den direkten Einstieg, die Seiten- und Proxy-Metadaten sowie den Schutz von Sitzungen und Betriebsdaten. Die Bildroute verwendet die vorhandenen statischen Datei-Handler und Sitzungstore. Zusätzliche eigene Timer, dauerhafte Bild-Caches oder Controllerabfragen sind hierfür nicht erforderlich. Die [Anleitung](../../start/START_HIER_9.0.31.md) beschreibt die Prüfung auf dem Gerät und den Rückfall.
