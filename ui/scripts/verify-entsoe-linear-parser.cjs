/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Fachliche ENTSO-E-Kompatibilität und begrenzte XML-Verarbeitung prüfen.
 * Daten: Nur lokale synthetische Preisantworten, keine Anbieter-/Zugangsdaten.
 * Geprüft wird die kanonische TS-Quelle; Angriffsfixtures laufen in Kindprozessen
 * mit äußerem Zeitlimit, damit ein Parserrückfall nicht den gesamten Test blockiert.
 */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexowatt-entsoe-'));
const compiled = path.join(temp, 'tariff-provider-registry.cjs');
const source = fs.readFileSync(path.join(__dirname, '../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts'), 'utf8');
fs.writeFileSync(compiled, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText);
process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));
const { normalizeEntsoe } = require(compiled);
test('legacy copy-mode source remains directly executable JavaScript', () => {
 const direct = path.join(temp, 'legacy-copy.cjs'); fs.writeFileSync(direct, source);
 const check = spawnSync(process.execPath, ['--check', direct], { encoding: 'utf8' });
 assert.equal(check.status, 0, check.stderr);
});
const point = (position, price) => `<Point><position>${position}</position><price.amount>${price}</price.amount></Point>`;
const period = (start = '2026-10-23T12:00Z', prices = ['100', '-50']) => `<Period><timeInterval><start>${start}</start><end>2026-10-23T13:00Z</end></timeInterval><resolution>PT15M</resolution>${prices.map((price, i) => point(i + 1, price)).join('')}</Period>`;
const document = content => `<Publication_MarketDocument><TimeSeries><currency_Unit.name>EUR</currency_Unit.name><price_Measure_Unit.name>MWH</price_Measure_Unit.name>${content}</TimeSeries></Publication_MarketDocument>`;
const valid = document(period());
const invalid = xml => assert.throws(() => normalizeEntsoe(xml), /^Error: (?:entsoe_invalid_response|provider_prices_invalid)$/);
test('quarter-hour, negative prices and MWh conversion stay correct', () => {
 const result = normalizeEntsoe(valid).intervals;
 assert.equal(result.length, 2); assert.equal(result[0].total, 0.1); assert.equal(result[1].total, -0.05);
 assert.equal(result[0].endsAt, '2026-10-23T12:15:00.000Z');
});
test('multiple periods preserve chronological boundaries', () => {
 const result = normalizeEntsoe(document(period() + period('2026-10-23T13:00Z', ['0', '+20.5']))).intervals;
 assert.deepEqual(result.map(row => row.total), [0.1, -0.05, 0, 0.0205]);
 assert.equal(result[2].startsAt, '2026-10-23T13:00:00.000Z');
});
test('namespace prefixes, XML declaration and quoted attribute delimiters', () => {
 const namespaced = valid.replace(/<(\/?)([A-Za-z_][A-Za-z0-9_.]*)/g, '<$1e:$2').replace('<e:Period>', '<e:Period type="A>B" id="one">');
 assert.equal(normalizeEntsoe('<?xml version="1.0"?>' + namespaced).intervals.length, 2);
});
test('comments cannot contribute false price or period elements', () => {
 const fixture = valid.replace('<Period>', '<!-- <Period><Point>fake</Point></Period> --><Period>');
 assert.equal(normalizeEntsoe(fixture).intervals.length, 2);
});
for (const [name, fixture] of [
 ['missing resolution', valid.replace('<resolution>PT15M</resolution>', '')],
 ['self-closing resolution', valid.replace('<resolution>PT15M</resolution>', '<resolution/>')],
 ['missing numeric price', valid.replace('>100<', '><')],
 ['nonsequential point', valid.replace('<position>2', '<position>3')],
 ['mismatched close', valid.replace('</Point>', '</Period>')],
 ['unclosed last period', valid.replace('</Period>', '')],
 ['nested same period', document('<Period>' + period() + '</Period>')],
 ['external declaration', '<!DOCTYPE x SYSTEM "https://invalid.test/entity">' + valid],
 ['oversized source', '<TimeSeries>' + 'x'.repeat(2 * 1024 * 1024)],
 ['oversized tag', document('<Period ' + 'x'.repeat(16385) + '>' + '</Period>')],
 ['unclosed quoted attribute', document('<Period name="unterminated>' + '</Period>')],
]) test(name + ' is rejected', () => invalid(fixture));
for (const tag of ['Period', 'Point', 'start']) test('bounded CPU for 512KiB unclosed ' + tag + ' tags', () => {
 const child = `const {normalizeEntsoe}=require(process.argv[1]);const tag=process.argv[2];const xml='<Publication_MarketDocument><TimeSeries>'+('<'+tag+'>').repeat(70000);const start=performance.now();let rejected=false;try{normalizeEntsoe(xml)}catch(e){if(e.message==='entsoe_invalid_response')rejected=true;}if(!rejected)process.exit(2);process.stdout.write(JSON.stringify({tag,bytes:Buffer.byteLength(xml),ms:performance.now()-start}));`;
 const result = spawnSync(process.execPath, ['-e', child, compiled, tag], { timeout: 2000, encoding: 'utf8' });
 assert.equal(result.error, undefined, 'Parser must finish before the external 2-second deadline');
 assert.equal(result.status, 0, result.stderr);
 const measured = JSON.parse(result.stdout); assert.equal(measured.tag, tag);
 console.log('ENTSO-E malformed-input bound: ' + JSON.stringify(measured));
});
