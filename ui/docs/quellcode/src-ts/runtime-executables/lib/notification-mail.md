# src-ts/runtime-executables/lib/notification-mail.ts

Sammelt wichtige Anlagenstörungen und versendet freigegebene Meldungsgruppen über verschlüsselt gespeicherte SMTP-Konfiguration.

**Daten und Wirkung:** Liest Kundenfreigabe, Empfänger und Diagnose-States; nutzt NotificationPolicy für die Auswahl und Nodemailer für den TLS-Versand. Die Konfiguration liegt AES-GCM-verschlüsselt im Instanzdatenverzeichnis.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/notification-mail.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:fs/promises` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:path` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./notification-policy` | [src-ts/runtime-executables/lib/notification-policy.ts](../../../../../src-ts/runtime-executables/lib/notification-policy.ts) |
| `@iobroker/adapter-core` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `nodemailer` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`validAddress`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L22) | v | ADDRESS.test |
| [`safeId`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L23) | v | String |
| [`normalizeConfig`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L29) | input, previous | Number, Number.isInteger, String |
| [`smtpError`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L43) | error | String |
| [`NotificationMail.constructor`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L55) | adapter, options | normalizeConfig |
| [`NotificationMail.init`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L71) | – | this._load |
| [`NotificationMail._load`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L78) | – | Buffer.concat, Buffer.from, JSON.parse, crypto.createDecipheriv, crypto.createHash, decipher.final, decipher.setAuthTag, decipher.update, fs.mkdir, fs.readFile, normalizeConfig, path.join, plain.toString, require (weitere in der Quelle) |
| [`NotificationMail.atomic`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L104) | name, value | JSON.stringify, crypto.randomBytes, directory.close, directory.sync, fs.open, fs.rename, fs.unlink, handle.close, handle.sync, handle.writeFile, path.join |
| [`NotificationMail.saveLedger`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L122) | – | JSON.stringify, this.atomic, this.policy.snapshot |
| [`NotificationMail.publicConfig`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L130) | – | – |
| [`NotificationMail.configure`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L137) | input | Buffer.concat, JSON.stringify, cipher.final, cipher.getAuthTag, cipher.update, crypto.createCipheriv, crypto.randomBytes, data.toString, iv.toString, normalizeConfig, this.atomic, this.init, this.publicConfig, this.transport?.close |
| [`NotificationMail.status`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L155) | message | this.adapter._notifySetDebugState |
| [`NotificationMail.send`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L163) | to, subject, text | Array.isArray, String, create, info.accepted.some, require, smtpError, this.transport.sendMail, validAddress |
| [`NotificationMail.deliver`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L187) | to, subject, text, batch, test | this.adapter._notifySetDebugState, this.now, this.policy.complete, this.policy.reserve, this.saveLedger, this.send, this.status |
| [`NotificationMail.test`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L204) | to | this.deliver, this.init, this.now, this.policy.quota, validAddress |
| [`NotificationMail.tick`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L219) | – | JSON.stringify, a._notifyGetSettingBool, a._notifyGetSettingString, a._notifySetDebugState, batch.filter, batch.flatMap, body.join, crypto.createHash, events.map, this.collect, this.deliver, this.init, this.now, this.policy.batch (weitere in der Quelle) |
| [`NotificationMail.collect`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L253) | categories | Array.isArray, JSON.parse, MODULES.has, Number, Number.isFinite, Object.fromEntries, Promise.all, String, a._meshCoordinator?.energy?.notificationEvent, a._meshCoordinator?.notificationEvent, a._notifyRefreshNwDevicesCache, a._notifyRefreshWatchedInstances, a.getForeignObjectAsync, a.getForeignStateAsync (weitere in der Quelle) |
| [`read`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L255) | id | a.getStateAsync |
| [`add`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L256) | id, category, title, message, persistMs, severity | events.push |
| [`retain`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L257) | prefix | events.push, id.startsWith |
| [`sourceDown`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L293) | id | Array.from, String |
| [`NotificationMail.close`](../../../../../src-ts/runtime-executables/lib/notification-mail.ts#L378) | – | this.transport?.close |
