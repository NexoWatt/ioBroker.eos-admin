# Zweiter technischer Review: Lizenzkompatibilität und Guard-Ausnahme

Stand: 23.10.2026, Entwicklungsversion 1.0.25. Review durch einen zweiten KI-Agenten; keine externe Prüfung, Zertifizierung oder Konformitätsbescheinigung.

## Auftrag und Ergebnis

Geprüft wurde die ausdrücklich beauftragte Rückkehr zur bisherigen Lizenzstrategie für den Feldtest. Fehlende oder fehlerhafte optionale Dienstkonfiguration darf gültige Bestandslizenzen nicht mehr aussperren. UUID-Bindung, Signaturprüfung, Editionen und zeitliche Trial-Grenzen müssen erhalten bleiben.

**Ergebnis: technische Freigabe für den geprüften Änderungsumfang.** Kein pauschaler Freigabe-, UUID-, Editions- oder Trial-Bypass festgestellt. Die Prüfung bezieht sich auf `src-ts/runtime-executables/main.ts`, `src-ts/runtime-mirrors/main.ts` und die begrenzte Ausnahme in `scripts/check-repository-secrets.cjs`. Die allgemeinen Release-Gates und das endgültig erzeugte Paket prüft der Hauptlauf separat.

## Tatsächlich ausgeführte Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Bestehender Kompatibilitätstest an kanonischer Main-Quelle | Erfolgreich: sechs historische/private Voll-/Trialformate, neun fehlende oder fehlerhafte ENV-Fälle, UUID-/Signaturabweichung, Trial-Fortsetzung, Ablauf und Uhr-Rückstellung |
| Derselbe Test an typisierter Main-Quelle | Erfolgreich |
| Differenzvergleich mit der bereitgestellten ursprünglichen 1.0.21-Quelle | Erfolgreich: 16 zufällige UUIDs × sechs Formate; erzeugte Signaturen identisch und weiterhin gültig |
| Unabhängige negative Lizenzproben | **44/44 erfolgreich abgewiesen**: Editionspräfix ändern, Trialdauer verlängern und Trial in Vollformat umdeuten; jeweils beide Main-Quellen und historische/optionale private Signaturbasis; keine Trial-State-Schreibvorgänge bei ungültiger Eingabe |
| Unabhängige Guard-Proben | **18/18 erfolgreich**: drei exakt zugelassene Pfade akzeptiert; abweichender Pfad, Methodenname, Variablenname, Wert, doppelte Definition, zusätzlicher HMAC und private ENV-Zuweisung blockiert |
| Bestehender Secret-Guard-Regressionslauf | Erfolgreich, einschließlich anderer Secret-Regeln, Index-/Hook-Prüfung und redigierter Fehlermeldungen |
| Vollständiger Repository-Secret-Scan nach Aufnahme von Vermerk und Test | Erfolgreich: 2602 Dateien, keine Findings in den unterstützten Regeln |

Die 44 und 18 unabhängigen Proben liefen zunächst ausschließlich im Speicher. Sie sind anschließend reproduzierbar in `test/license-compatibility-negative.test.cjs` übernommen und nochmals als zwei erfolgreiche Node-Tests ausgeführt worden. Historisches Material wird dafür nur aus dem tatsächlichen Produkthelper gelesen; private Testwerte entstehen zufällig zur Laufzeit. Keine Schlüssel oder Materialwerte werden protokolliert oder als Testliteral dupliziert.

Beim ersten Scan der neuen Testdatei erkannte der Guard zwei textuelle Muster in der synthetischen Fixture-Konstruktion. Die Konstruktion wurde angepasst; der Guard blieb unverändert. Der erneute Testlauf war erfolgreich, und `inspectContent` meldete für die neue Testdatei keine Findings.

## Ausgeführte Befehle und Methode

Aus dem Repository-Verzeichnis:

```sh
node scripts/verify-license-secret-externalization.cjs src-ts/runtime-executables/main.ts --legacy-reference /workspace/scratch/cd7c5428afc1/legacy-license-source/legacy-main.js
node scripts/verify-license-secret-externalization.cjs src-ts/runtime-mirrors/main.ts
node scripts/verify-stable-1.0.10-secret-guard.cjs
node --test test/license-compatibility-negative.test.cjs
node scripts/check-repository-secrets.cjs
```

Zusätzlich wurde die neue Testdatei über den exportierten `inspectContent`-Prüfer gescannt. Die Lizenztests extrahieren die tatsächlichen Methoden mittels TypeScript-AST und führen sie in einer isolierten VM mit simulierten ioBroker-States aus. Die Guard-Proben verändern nur In-Memory-Kopien und prüfen ausschließlich Fundstellen/Regeln, niemals ausgegebene Werte. Der historische Vergleich benötigt die lokal bereitgestellte Referenzquelle; sie wird nicht in den Test oder diesen Vermerk kopiert.

## Begrenzung der Aussage

Die Ausnahme betrifft ausschließlich die benannte historische Zuweisung in einer exakt benannten Methode, mit exaktem Variablennamen, geprüftem SHA-256-Fingerabdruck und drei zulässigen Main-Pfaden. Sie ist keine allgemeine Dateiausnahme. Der bestehende gezielte Scanner bleibt eine Textprüfung, keine vollständige Datenfluss- oder Geheimnisanalyse.

Das beibehaltene historische Lizenzmodell wird nicht als zusätzliche Geheimhaltung oder externe Authentifizierung aufgewertet. Geräteverhalten, Anlagenbetrieb und allgemeine Produktfreigabe sind nicht Gegenstand dieses Lizenzreviews.
