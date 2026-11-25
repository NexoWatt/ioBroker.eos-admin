'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const ui='/workspace/scratch/741f792566ea/source-921/iobroker.eos-admin/ui';
const raw='/workspace/scratch/741f792566ea/audit-921/ems';
const gate=require(path.join(ui,'scripts/verify-eslint-security.cjs'));
const file=path.join(ui,'docs/security/eslint-reviewed-findings.json');
const before=fs.readFileSync(file,'utf8');
const reviewed=JSON.parse(before);
const inv=JSON.parse(fs.readFileSync(path.join(raw,'ui-security-inventory-before.json'),'utf8'));
const evidence='EOS repository: docs/reports/unified-9.0.21/UI_SECURITY_GATE_REVIEW.md';
const notes={
 '52846315efe5cb1fd687f2d6436c4999102da11954b430f4bfad65a823670f5c':'Peerfehlerzähler weiterhin nur im lokalen Object.create(null)-Reducer; beide Zugriffe und feste Klassifikation gelesen, keine Änderung durch Farm-Serialisierung.',
 '284be3fe77000b1f5d8a5d7296f2772e4d14ee972e7415eab59412f88b64f8b8':'PartnerAppId stammt weiterhin aus dem validierten Partnervertrag; directMarketing wird fest auf grid abgebildet, anschließend Lizenz/installed/enabled. Neuer Farm-Wrapper liefert keine Schlüssel an diesen Pfad.',
 '48c91c7b19c3c39dd9f70b1244e95342cf66ab86a8ed71a4196272e0bbe5f2cc':'Availability bleibt eine im Storage-Control angelegte Null-Prototypmap; Ressource nur gelesen, farm ausgeschlossen, Boolean und maximal15s alter Messzeitpunkt erforderlich.',
 '012aeb1f3bb1907433fb0cc309a9c0a283544112b34658a997940c62b549cfbd':'readPartnerProjection ruft den Cache-Lesehook weiterhin ausschließlich mit seinen festen Messwertkennungen auf; kein fremder Schreibschlüssel und keine Änderung der Quelle durch das Farm-Delta.',
 'a0f055d4076a53efda1a6208fcda4930beaee6122331ab7c796c33238cc6c3e3':'Telemetry bleibt die von Storage-Control geführte Null-Prototypmap; gebundene Ressourcen werden nur gelesen und danach mit tatsächlichen Zahlen und Messzeitstempeln projiziert.',
 'f966fa825d8a063b62bc5ba98284ecfc6143e5e505d236e32b0d64f8cef0cd74':'queryNumber hat unverändert nur drei interne Aufrufe mit from/to/step; primitiver Typ, endliche Werte, Zeitfenster und maximal4096Punkte werden weiter geprüft.',
 '3b107b890285ab2c4f9e903614d6d34763f4a729659d8e0524d65d18317319fe':'History-Binärsuche liest normalisierte sortierte Zahlenpaare; mid bleibt ganzzahlig zwischen low und high<=(Arraylänge); keine Änderung dieses Blocks.',
 '27297a9d7c7c8eb7e9f5a89509e1698c9e57f876d603aa37ce4c6b296f00a41f':'History-Dezimalgrammatik bleibt verankert; die Alternativen beginnen disjunkt mit Ziffer oder Punkt, Exponent beginnt ausschließlich e/E. Nicht endliche Werte werden verworfen. Gesamter Block gegenüber920 unverändert.',
 'fcd35d67be3c6ad4dc2da331e649307c2e516ef1628a8daba7e789400a1eeda4':'Discovery-Fehlerlookup bleibt durch Object.hasOwn(errors,code) vor geerbten Namen geschützt; ausschließlich feste Status-/Meldungswerte oder feste Fallbackantwort.'
};
const main='src-ts/runtime-executables/main.ts';
const currentHash=gate.codeSha256(main,fs.readFileSync(path.join(ui,main),'utf8'));
assert.equal(currentHash,'68ebef5c4985ff739eee7aee192b28a00f0d3593d9704947ab7121879421b23b');
assert.equal(reviewed.findings.filter(f=>f.file===main).length,9);
const changes=[];
for(const f of reviewed.findings.filter(f=>f.file===main)){
 assert.equal(f.sourceCodeSha256,'a791c0b8135b6a832cda954c6de8b55cc2350c61af81cd507431a02c9ef467a1');
 assert.ok(notes[f.fingerprint]);
 const current=inv.findings.filter(v=>v.file===main&&v.fingerprint===f.fingerprint);
 assert.equal(current.length,f.count);
 changes.push({fingerprint:f.fingerprint,oldSourceCodeSha256:f.sourceCodeSha256,newSourceCodeSha256:currentHash,count:f.count,reason:notes[f.fingerprint]});
 f.sourceCodeSha256=currentHash;
 f.line=current[0].line;f.column=current[0].column;
 f.review+=' Nachprüfung 24.11.2026 für EOS9.0.21: '+notes[f.fingerprint]+' Siehe '+evidence+'.';
}
const added={
 'f4e38272c74a94fe601e4092e784a720242985b32e23435c6c0a1ef055ba1e52':'Unveränderte parseNum-Tokenregex nach Umzug in _nwUpdateStorageFarmDerivedSnapshot. Erster Zifferntoken mit optionalem Vorzeichen, danach Ziffer/Punkt/Komma-Lauf und optionaler disjunkter e/E-Exponent. Kein erzwungener Suffix nach dem optionalen Exponenten: ein begonnener Zifferntoken kann unabhängig davon erfolgreich enden; keine wiederholt scheiternde verschachtelte Alternative. Match wird numerisch normalisiert und endliche Zahl separat geprüft. Herkunftsfingerprint und identischer Statementhash sind im Einzelbeleg gebunden.',
 'ca90f2911eb092b3d5ca4fb48e9119d9e6fb32fad46ef240074ea74efce811f6':'Unveränderter Median-Lesezugriff nach Funktionsumzug. socListAll wird lokal aus endlichen SoC-Werten gebildet; leeres Array wird vorher abgefangen. mid=Math.floor(arr.length/2), ungerader nichtleerer Fall: 0<=mid<arr.length. Kein fremder Schlüssel und kein Objektwrite.',
 '1e2633deb0903a7c225e03dbc4e495168bde66fa166d70d7ef0489543d6989f3':'Unveränderter Median-Lesezugriff nach Funktionsumzug. Nichtleeres Array wurde zuvor geprüft; dieser Zweig gilt nur bei gerader Länge>=2. mid=Math.floor(arr.length/2) und mid-1 sind gültige ganzzahlige Arraypositionen; nur arithmetischer Lesezugriff.',
 '95d9eb9f5cac8fb9ea99f71d5e83496db3af5fa1f9139ef0ff214b4885e6fa23':'Versionsformat ist vollständig mit ^/$ verankert; drei disjunkte Dezimalsegmente haben jeweils höchstens6Ziffern, optionaler mit Bindestrich beginnender Suffix höchstens60Zeichen. Maximale akzeptierte Länge81, keine unbeschränkte oder überlappende Wiederholung. Nur Stringprüfung für Anzeige/Antwortvertrag; keine Installationsfreigabe aus diesem Browserwert.'
};
assert.equal(inv.introduced.length,4);
for(const f of inv.introduced){
 assert.ok(added[f.fingerprint]);
 assert.ok(f.rule==='security/detect-object-injection'||f.rule==='security/detect-unsafe-regex');
 assert.equal(f.fatal,false);assert.equal(f.severity,2);
 const sourceCodeSha256=gate.codeSha256(f.file,fs.readFileSync(path.join(ui,f.file),'utf8'));
 if(f.file===main) assert.equal(sourceCodeSha256,currentHash);
 else assert.equal(sourceCodeSha256,'c815598cb0b73a777ac517a57583a0d9c92663ea6a11f7742b97ddf9a9def6eb');
 reviewed.findings.push({...f,count:1,reason:added[f.fingerprint],evidence,review:'24.11.2026: Einzelprüfung des konkreten Ausdrucks, seiner Datenherkunft und seiner Grenzen für EOS9.0.21; keine Regelabschaltung oder Baseline-Neuaufnahme.',sourceCodeSha256});
 changes.push({fingerprint:f.fingerprint,added:true,count:1,sourceCodeSha256,reason:added[f.fingerprint]});
}
fs.writeFileSync(path.join(raw,'ui-reviewed-findings-before.json'),before);
fs.writeFileSync(file,JSON.stringify(reviewed,null,2)+'\n');
fs.writeFileSync(path.join(raw,'ui-reviewed-changes.json'),JSON.stringify(changes,null,2)+'\n');
console.log(JSON.stringify({reboundExistingGroups:9,addedIndividuallyReviewedGroups:4,legacyBaselineChanged:false,scannerRulesChanged:false}));
