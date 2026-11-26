# Historischer v29-Updatehinweis – ersetzt für den gemeinsamen EOS-Adapter

Überarbeitet am 26.11.2026 nach Prüfung des ausgelieferten 9.0.26-Quellstands.
Diese Datei enthielt Anweisungen für die frühere eigenständige
Administrationsoberfläche. Sie ist keine aktuelle Installationsfreigabe.

## Heute gültige Vorgabe

Beim gemeinsamen EOS-Adapter muss `common.stopBeforeUpdate` den Wert `true`
aus `io-package.json` übernehmen. Dadurch kann der normale ioBroker-Upgradepfad
die laufenden Prozesse vor dem Austausch der Programmdateien beenden. Die
frühere Empfehlung, diesen Wert auf `false` zu setzen, gilt nicht mehr.
Repository-Generator und Repository-Patcher übernehmen auch die
Controllerabhängigkeiten aus derselben Paketmetadatei.

Der aktuelle Administrationsdialog verwendet den normalen ioBroker-Befehl
`upgrade <Adapter>@<Version>`. Der Kunden-Updateweg besitzt einen eigenen
begrenzten Worker mit bestätigtem Stoppen, Inhaltsprüfung und Starten. Die alten
Aussagen über einen einheitlichen Webserver-Selbstupdatepfad beschreiben den
heutigen Lieferstand nicht.

## Begrenzte Metadatenwartung

`tools/nexowatt-repair-eos-admin-update.cjs` bleibt ein ausdrücklich gestartetes
Linux-Wartungswerkzeug. Es setzt für das Paket `stopBeforeUpdate=true` und
entfernt die alten Löschsperrflags `dontDelete` und `nondeletable` am Paket sowie
an `eos-admin.0`. Es ändert weder `common.enabled` noch die Kundeneinstellungen,
installiert kein Update und startet keinen Prozess.

Ein fehlgeschlagener Controllerbefehl beendet das Werkzeug mit Fehler. Bereits
erfolgreiche Metadatenänderungen bleiben angewendet; ein Gesamterfolg wird dann
nicht gemeldet. Das Werkzeug ist kein allgemeines Mittel gegen eine gestoppte
Instanz und kein Nachweis eines erfolgreichen Wiederanlaufs.

## Einordnung des gemeldeten Ausfalls

Die widersprüchlichen Repository-Werkzeuge sind im 9.0.26-Ausgangsstand
reproduziert. Ohne den konkreten Updatepfad, den Instanzstatus und das
Controllerprotokoll ist damit die Ursache des auf der Anlage ausgebliebenen
Starts noch nicht nachgewiesen. Ein npm-404-Abbruch und ein anschließend
erfolgreicher Wiederholungsversuch müssen getrennt untersucht werden.

Ein bereits laufendes EOS kann eine absichtlich deaktivierte oder vom
Controller nicht gestartete eigene Instanz nicht selbst überwachen. Automatische
Wiederanlaufentscheidungen dürfen bestehende Deaktivierungen und einen unklaren
Installationszustand nicht übergehen. Die Prüfung eines erfolgreichen Updates
umfasst deshalb sowohl die installierte Version als auch den tatsächlichen
Hauptprozess und die Bereitschaft der freigegebenen Module.
